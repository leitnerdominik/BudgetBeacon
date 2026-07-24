using System.Reflection;
using BudgetBeacon.Infrastructure.Data;
using BudgetBeacon.Infrastructure.Data.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class ObsoleteUserSettingColumnsMigrationTests
{
    [Fact]
    public void Up_DropsOnlyObsoleteColumnsFromAspNetUsers()
    {
        var migrationBuilder = new MigrationBuilder(
            "Npgsql.EntityFrameworkCore.PostgreSQL");

        InvokeMigrationMethod(
            new RemoveObsoleteUserSettingColumns(),
            "Up",
            migrationBuilder);

        Assert.Equal(2, migrationBuilder.Operations.Count);
        var dropColumns = migrationBuilder.Operations
            .Select(Assert.IsType<DropColumnOperation>)
            .ToList();
        Assert.All(
            dropColumns,
            operation => Assert.Equal("AspNetUsers", operation.Table));
        Assert.Equal(
            ["AiLocationContext", "TransactionImportBlacklistRulesJson"],
            dropColumns.Select(operation => operation.Name).Order().ToArray());
    }

    [Fact]
    public void Down_RejectsRecreatingSensitiveLegacyColumns()
    {
        var migrationBuilder = new MigrationBuilder(
            "Npgsql.EntityFrameworkCore.PostgreSQL");

        var exception = Assert.Throws<TargetInvocationException>(() =>
            InvokeMigrationMethod(
                new RemoveObsoleteUserSettingColumns(),
                "Down",
                migrationBuilder));
        var rollbackException = Assert.IsType<NotSupportedException>(
            exception.InnerException);

        Assert.Contains(
            "sensitive user settings",
            rollbackException.Message,
            StringComparison.Ordinal);
        Assert.Empty(migrationBuilder.Operations);
    }

    [Fact]
    public void CurrentModel_MapsSettingsOnlyOnUserSettings()
    {
        var options = new DbContextOptionsBuilder<BudgetBeaconDbContext>()
            .UseNpgsql(
                "Host=localhost;Database=budgetbeacon_model_test;" +
                "Username=model_test;Password=model_test")
            .Options;
        using var context = new BudgetBeaconDbContext(options);

        var applicationUser = context.Model.FindEntityType(
            typeof(ApplicationUser));
        Assert.NotNull(applicationUser);
        Assert.Null(applicationUser.FindProperty("AiLocationContext"));
        Assert.Null(
            applicationUser.FindProperty(
                "TransactionImportBlacklistRulesJson"));

        var userSettings = context.Model.FindEntityType(typeof(UserSettings));
        Assert.NotNull(userSettings);
        Assert.NotNull(userSettings.FindProperty("AiLocationContext"));
        Assert.NotNull(
            userSettings.FindProperty(
                "TransactionImportBlacklistRulesJson"));
    }

    private static void InvokeMigrationMethod(
        Migration migration,
        string methodName,
        MigrationBuilder migrationBuilder)
    {
        var method = migration.GetType().GetMethod(
            methodName,
            BindingFlags.Instance | BindingFlags.NonPublic);

        Assert.NotNull(method);
        method.Invoke(migration, [migrationBuilder]);
    }
}
