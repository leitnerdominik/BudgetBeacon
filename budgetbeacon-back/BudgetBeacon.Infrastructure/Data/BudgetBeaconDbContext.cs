using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace BudgetBeacon.Infrastructure.Data;

public class BudgetBeaconDbContext : IdentityDbContext<ApplicationUser>
{
    public BudgetBeaconDbContext(DbContextOptions<BudgetBeaconDbContext> options) : base(options)
    {
    }

    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(user => user.FirstName).HasMaxLength(100);
            entity.Property(user => user.LastName).HasMaxLength(100);
            entity.Property(user => user.AiLocationContext).HasMaxLength(120);
            entity.Property(user => user.TransactionImportBlacklistRulesJson)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("'[]'::jsonb");
        });

        modelBuilder.Entity<UserSettings>(entity =>
        {
            entity.HasKey(settings => settings.UserId);

            entity.Property(settings => settings.UserId)
                .HasMaxLength(450);

            entity.Property(settings => settings.AiLocationContext)
                .HasMaxLength(120);

            entity.Property(settings => settings.TransactionImportBlacklistRulesJson)
                .HasColumnType("jsonb")
                .HasDefaultValueSql("'[]'::jsonb");

            entity.HasOne(settings => settings.User)
                .WithOne()
                .HasForeignKey<UserSettings>(settings => settings.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.HasKey(transaction => transaction.Id);

            entity.Property(transaction => transaction.UserId)
                .HasMaxLength(450);

            entity.Property(transaction => transaction.ImportFingerprint)
                .HasMaxLength(64);

            entity.Property(transaction => transaction.Notes)
                .HasMaxLength(500);

            entity.Property(transaction => transaction.Treatment)
                .HasMaxLength(32)
                .HasDefaultValue(TransactionTreatment.Expense);

            entity.Property(transaction => transaction.Date)
                .HasConversion(
                    value => value.ToUniversalTime(),
                    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

            entity.Property(transaction => transaction.Amount)
                .HasPrecision(18, 2);

            entity.HasIndex(transaction => new { transaction.UserId, transaction.Date });

            entity.HasIndex(transaction => new { transaction.UserId, transaction.ImportFingerprint })
                .IsUnique()
                .HasDatabaseName("IX_Transactions_UserId_ImportFingerprint")
                .HasFilter("\"ImportFingerprint\" IS NOT NULL");

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
