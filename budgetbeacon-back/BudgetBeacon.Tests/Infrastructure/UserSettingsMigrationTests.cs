using System.Reflection;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using BudgetBeacon.Infrastructure.Data.Migrations;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class UserSettingsMigrationTests
{
    [Fact]
    public void Up_CreatesUserSettingsTableAndCopiesExistingUserValues()
    {
        var operations = BuildOperations(new AddUserSettingsTable(), "Up");

        var createTable = Assert.Single(
            operations.OfType<CreateTableOperation>(),
            operation => operation.Name == "UserSettings");
        Assert.Equal("UserId", Assert.Single(createTable.PrimaryKey!.Columns));
        Assert.Contains(
            createTable.Columns,
            column => column.Name == "AiLocationContext" && column.MaxLength == 120);
        Assert.Contains(
            createTable.Columns,
            column => column.Name == "TransactionImportBlacklistRulesJson" &&
                column.ColumnType == "jsonb" &&
                column.DefaultValueSql == "'[]'::jsonb");
        Assert.Contains(
            createTable.ForeignKeys,
            foreignKey => foreignKey.PrincipalTable == "AspNetUsers" &&
                Assert.Single(foreignKey.Columns) == "UserId");

        var copySql = Assert.Single(
            operations.OfType<SqlOperation>(),
            operation => operation.Sql.Contains("INSERT INTO \"UserSettings\"", StringComparison.Ordinal));
        Assert.Contains("\"AiLocationContext\"", copySql.Sql);
        Assert.Contains("\"TransactionImportBlacklistRulesJson\"", copySql.Sql);
        Assert.Contains("FROM \"AspNetUsers\"", copySql.Sql);
    }

    [Fact]
    public void Down_CopiesSettingsBackBeforeDroppingUserSettingsTable()
    {
        var operations = BuildOperations(new AddUserSettingsTable(), "Down");

        var copyBackSql = Assert.Single(
            operations.OfType<SqlOperation>(),
            operation => operation.Sql.Contains("UPDATE \"AspNetUsers\"", StringComparison.Ordinal));
        Assert.Contains("FROM \"UserSettings\"", copyBackSql.Sql);

        var dropTable = Assert.Single(operations.OfType<DropTableOperation>());
        Assert.Equal("UserSettings", dropTable.Name);
    }

    private static IReadOnlyList<MigrationOperation> BuildOperations(
        Migration migration,
        string methodName)
    {
        var migrationBuilder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
        var method = migration.GetType().GetMethod(
            methodName,
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(method);
        method.Invoke(migration, [migrationBuilder]);

        return migrationBuilder.Operations;
    }
}
