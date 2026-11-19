using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddManualSpendingFlexibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ManualSpendingFlexibility",
                table: "Transactions",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManualSpendingFlexibility",
                table: "Transactions");
        }
    }
}
