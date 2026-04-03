using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PTSManagerYC.Infrastructure.Data;

public class FinzManagerDbContextFactory : IDesignTimeDbContextFactory<FinzManagerDbContext>
{
    public FinzManagerDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ??
            "Host=localhost;Port=5432;Database=ptsmanager_design;Username=postgres;Password=postgres;SSL Mode=Disable";

        var optionsBuilder = new DbContextOptionsBuilder<FinzManagerDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new FinzManagerDbContext(optionsBuilder.Options);
    }
}
