using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAiSpendingFlexibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AiSpendingFlexibility",
                table: "Transactions",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "FlexibilityConfidence",
                table: "Transactions",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiSpendingFlexibility",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "FlexibilityConfidence",
                table: "Transactions");
        }
    }
}
