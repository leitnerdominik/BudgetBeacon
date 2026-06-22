using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSettingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserSettings",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    AiLocationContext = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    TransactionImportBlacklistRulesJson = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSettings", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_UserSettings_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT INTO "UserSettings" (
                    "UserId",
                    "AiLocationContext",
                    "TransactionImportBlacklistRulesJson"
                )
                SELECT
                    "Id",
                    "AiLocationContext",
                    COALESCE("TransactionImportBlacklistRulesJson", '[]'::jsonb)
                FROM "AspNetUsers"
                ON CONFLICT ("UserId") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "AspNetUsers" AS users
                SET
                    "AiLocationContext" = settings."AiLocationContext",
                    "TransactionImportBlacklistRulesJson" = settings."TransactionImportBlacklistRulesJson"
                FROM "UserSettings" AS settings
                WHERE users."Id" = settings."UserId";
                """);

            migrationBuilder.DropTable(
                name: "UserSettings");
        }
    }
}
