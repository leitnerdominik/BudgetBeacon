using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BudgetBeacon.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSpendingFlexibilityRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SpendingFlexibilityRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    MatchType = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    Pattern = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    NormalizedPattern = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false, collation: "C"),
                    SpendingFlexibility = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SpendingFlexibilityRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SpendingFlexibilityRules_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpendingFlexibilityRules_UserId_MatchType_NormalizedPattern",
                table: "SpendingFlexibilityRules",
                columns: new[] { "UserId", "MatchType", "NormalizedPattern" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SpendingFlexibilityRules");
        }
    }
}
