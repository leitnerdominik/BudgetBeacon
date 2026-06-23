using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    [Migration("20260623120000_AddTransactionTreatment")]
    public partial class AddTransactionTreatment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Treatment",
                table: "Transactions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Expense");

            migrationBuilder.Sql("""
                UPDATE "Transactions"
                SET "Treatment" = CASE
                    WHEN "Category" = 'Income' OR "Amount" > 0 THEN 'Income'
                    WHEN "Category" = 'Transfers & Adjustments' THEN 'InternalTransfer'
                    WHEN "Category" = 'Savings & Investments' THEN 'SavingsInvestment'
                    ELSE 'Expense'
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Treatment",
                table: "Transactions");
        }
    }
}
