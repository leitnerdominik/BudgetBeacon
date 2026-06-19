using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(BudgetBeaconDbContext))]
    [Migration("20260528120000_AddTransactionImportFingerprint")]
    public partial class AddTransactionImportFingerprint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImportFingerprint",
                table: "Transactions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.Sql("""
                WITH fingerprinted AS (
                    SELECT
                        "Id",
                        "UserId",
                        upper(encode(sha256(convert_to(
                            concat_ws(E'\n',
                                to_char("Date" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
                                trim_scale("Amount")::text,
                                upper(regexp_replace(btrim(coalesce("Metadata" ->> 'RawDescription', '')), '[[:space:]]+', ' ', 'g'))
                            ),
                            'UTF8')),
                            'hex')) AS "Fingerprint"
                    FROM "Transactions"
                    WHERE "UserId" IS NOT NULL
                ),
                ranked AS (
                    SELECT
                        "Id",
                        "Fingerprint",
                        row_number() OVER (PARTITION BY "UserId", "Fingerprint" ORDER BY "Id") AS "RowNumber"
                    FROM fingerprinted
                )
                UPDATE "Transactions" AS target
                SET "ImportFingerprint" = CASE
                    WHEN ranked."RowNumber" = 1 THEN ranked."Fingerprint"
                    ELSE NULL
                END
                FROM ranked
                WHERE target."Id" = ranked."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId_ImportFingerprint",
                table: "Transactions",
                columns: new[] { "UserId", "ImportFingerprint" },
                unique: true,
                filter: "\"ImportFingerprint\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_UserId_ImportFingerprint",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ImportFingerprint",
                table: "Transactions");
        }
    }
}
