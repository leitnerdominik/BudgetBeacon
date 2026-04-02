using Microsoft.EntityFrameworkCore;
using PTSManagerYC.Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Emit;
using System.Text;
using System.Threading.Tasks;

namespace PTSManagerYC.Infrastructure.Data
{
    public class FinzManagerDbContext : DbContext
    {
        public FinzManagerDbContext(DbContextOptions<FinzManagerDbContext> options) : base(options) { }

        public DbSet<Transaction> Transactions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Transaction>(entity =>
            {
                entity.HasKey(t => t.Id);

                entity.Property(t => t.Date)
                      .HasConversion(
                          v => v.ToUniversalTime(),
                          v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

                entity.OwnsOne(t => t.Metadata, metadata =>
                {
                    metadata.ToJson();
                    metadata.Property(m => m.RawDescription).HasMaxLength(500);
                });
            });
        }
    }
}
