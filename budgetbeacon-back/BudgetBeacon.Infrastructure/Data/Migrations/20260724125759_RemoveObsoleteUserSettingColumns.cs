using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveObsoleteUserSettingColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiLocationContext",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TransactionImportBlacklistRulesJson",
                table: "AspNetUsers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "This migration cannot be rolled back because doing so would recreate " +
                "obsolete columns that stored sensitive user settings.");
        }
    }
}
