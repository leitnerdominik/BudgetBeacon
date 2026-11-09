using System.Text;
using System.Text.Json;
using BudgetBeacon.Api.Infrastructure;
using BudgetBeacon.Core.Entities;

namespace BudgetBeacon.Tests.Api;

public sealed class TransactionExportWriterTests
{
    private static async IAsyncEnumerable<Transaction> Rows()
    {
        yield return new Transaction
        {
            Date = new DateTime(2026, 2, 3, 0, 0, 0, DateTimeKind.Utc),
            Amount = -12.34m,
            Category = "Other",
            Treatment = "Expense",
            Notes = "line 1\nline 2",
            Metadata = new TransactionMetadata { RawDescription = "=SUM(1,2), \"test\"" }
        };
        await Task.CompletedTask;
    }

    [Fact]
    public async Task Csv_UsesStableColumnsAndProtectsSpreadsheetText()
    {
        using var stream = new AsyncOnlyResponseStream();
        await TransactionExportWriter.WriteAsync(stream, Rows(), "csv", CancellationToken.None);
        var text = Encoding.UTF8.GetString(stream.ToArray());
        Assert.StartsWith("\uFEFFdate,description,amount,category,treatment,notes\r\n", text);
        Assert.Contains("\"'=SUM(1,2), \"\"test\"\"\"", text);
        Assert.Contains(",-12.34,Other,Expense,\"line 1\nline 2\"\r\n", text);
    }

    [Fact]
    public async Task Json_ContainsOnlyVisibleFields()
    {
        using var stream = new AsyncOnlyResponseStream();
        await TransactionExportWriter.WriteAsync(stream, Rows(), "json", CancellationToken.None);
        using var document = JsonDocument.Parse(stream.ToArray());
        var row = document.RootElement[0];
        Assert.Equal(6, row.EnumerateObject().Count());
        Assert.Equal("2026-02-03", row.GetProperty("date").GetString());
        Assert.Equal(-12.34m, row.GetProperty("amount").GetDecimal());
        Assert.Equal("=SUM(1,2), \"test\"", row.GetProperty("description").GetString());
    }

    [Theory]
    [InlineData("csv", "\uFEFFdate,description,amount,category,treatment,notes\r\n")]
    [InlineData("json", "[]")]
    public async Task EmptyExport_IsAValidFile(string format, string expected)
    {
        using var stream = new AsyncOnlyResponseStream();
        await TransactionExportWriter.WriteAsync(stream, Empty(), format, CancellationToken.None);
        Assert.Equal(expected, Encoding.UTF8.GetString(stream.ToArray()));
    }

    private static async IAsyncEnumerable<Transaction> Empty()
    {
        await Task.CompletedTask;
        yield break;
    }

    [Fact]
    public async Task Json_FlushesLargeExportsWithoutSynchronousIo()
    {
        using var stream = new AsyncOnlyResponseStream();
        await TransactionExportWriter.WriteAsync(stream, ManyRows(), "json", CancellationToken.None);
        using var document = JsonDocument.Parse(stream.ToArray());
        Assert.Equal(500, document.RootElement.GetArrayLength());
        Assert.True(stream.LengthWritten > 16 * 1024);
    }

    private static async IAsyncEnumerable<Transaction> ManyRows()
    {
        for (var i = 0; i < 500; i++)
            await foreach (var row in Rows()) yield return row;
    }

    // Match Kestrel's default response stream: synchronous writes and flushes fail.
    private sealed class AsyncOnlyResponseStream : Stream
    {
        private readonly MemoryStream _buffer = new();
        public long LengthWritten => _buffer.Length;
        public byte[] ToArray() => _buffer.ToArray();
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() => throw new InvalidOperationException("Synchronous I/O is disallowed.");
        public override void Write(byte[] buffer, int offset, int count) => throw new InvalidOperationException("Synchronous I/O is disallowed.");
        public override Task FlushAsync(CancellationToken cancellationToken) => _buffer.FlushAsync(cancellationToken);
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
            _buffer.WriteAsync(buffer, offset, count, cancellationToken);
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default) =>
            _buffer.WriteAsync(buffer, cancellationToken);
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        protected override void Dispose(bool disposing)
        {
            if (disposing) _buffer.Dispose();
            base.Dispose(disposing);
        }
    }
}
