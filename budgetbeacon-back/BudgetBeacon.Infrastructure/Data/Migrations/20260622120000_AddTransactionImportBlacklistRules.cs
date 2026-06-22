using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(BudgetBeaconDbContext))]
    [Migration("20260622120000_AddTransactionImportBlacklistRules")]
    public partial class AddTransactionImportBlacklistRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TransactionImportBlacklistRulesJson",
                table: "AspNetUsers",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TransactionImportBlacklistRulesJson",
                table: "AspNetUsers");
        }
    }
}
