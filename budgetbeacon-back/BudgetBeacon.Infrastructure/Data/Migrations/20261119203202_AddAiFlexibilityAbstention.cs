using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAiFlexibilityAbstention : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AiFlexibilityAbstained",
                table: "Transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiFlexibilityAbstained",
                table: "Transactions");
        }
    }
}
