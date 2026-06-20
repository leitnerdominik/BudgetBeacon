using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BudgetBeacon.Infrastructure.Data;

public class BudgetBeaconDbContextFactory : IDesignTimeDbContextFactory<BudgetBeaconDbContext>
{
    public BudgetBeaconDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings__DefaultConnection is required for design-time DbContext creation. " +
                "Use a local secret or environment variable; production PostgreSQL connections should use SSL Mode=VerifyFull or SSL Mode=Require.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<BudgetBeaconDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new BudgetBeaconDbContext(optionsBuilder.Options);
    }
}
