using Microsoft.EntityFrameworkCore;
using PTSManagerYC.Core.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace PTSManagerYC.Infrastructure.Data;

public class FinzManagerDbContext : IdentityDbContext<ApplicationUser>
{
    public FinzManagerDbContext(DbContextOptions<FinzManagerDbContext> options) : base(options)
    {
    }

    public DbSet<Transaction> Transactions => Set<Transaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(user => user.FirstName).HasMaxLength(100);
            entity.Property(user => user.LastName).HasMaxLength(100);
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.HasKey(transaction => transaction.Id);

            entity.Property(transaction => transaction.UserId)
                .HasMaxLength(450);

            entity.Property(transaction => transaction.Date)
                .HasConversion(
                    value => value.ToUniversalTime(),
                    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

            entity.HasIndex(transaction => new { transaction.UserId, transaction.Date });

            entity.HasOne<ApplicationUser>()
                .WithMany()
                .HasForeignKey(transaction => transaction.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.OwnsOne(transaction => transaction.Metadata, metadata =>
            {
                metadata.ToJson();
                metadata.Property(value => value.RawDescription).HasMaxLength(500);
            });
        });
    }
}
