using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BudgetBeacon.Infrastructure.Data;

public class BudgetBeaconDbContextFactory : IDesignTimeDbContextFactory<BudgetBeaconDbContext>
{
    public BudgetBeaconDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ??
            "Host=localhost;Port=5432;Database=budgetbeacon_design;Username=postgres;Password=postgres;SSL Mode=Disable";

        var optionsBuilder = new DbContextOptionsBuilder<BudgetBeaconDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new BudgetBeaconDbContext(optionsBuilder.Options);
    }
}
