export interface CsvColumnMapping {
  enabled: boolean;
  hasHeaderRow: boolean;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
}

const csvColumnMappingStorageKey = "transactions.csvColumnMapping.v1";
const columnReferencePattern = /^[A-Z]+$/;

export const defaultCsvColumnMapping: CsvColumnMapping = {
  enabled: false,
  hasHeaderRow: true,
  dateColumn: "B",
  amountColumn: "E",
  descriptionColumn: "H",
};

const stripBom = (value: string) => value.replace(/^\uFEFF/, "");

const normalizeColumnReference = (value: string) => value.trim().toUpperCase();

export const normalizeCsvColumnMapping = (
  mapping: CsvColumnMapping,
): CsvColumnMapping => ({
  enabled: mapping.enabled,
  hasHeaderRow: mapping.hasHeaderRow,
  dateColumn: normalizeColumnReference(mapping.dateColumn),
  amountColumn: normalizeColumnReference(mapping.amountColumn),
  descriptionColumn: normalizeColumnReference(mapping.descriptionColumn),
});

export const getCsvColumnMappingValidationMessage = (
  mapping: CsvColumnMapping,
) => {
  if (!mapping.enabled) {
    return null;
  }

  const normalizedMapping = normalizeCsvColumnMapping(mapping);
  const columnEntries = [
    { label: "Date", value: normalizedMapping.dateColumn },
    { label: "Amount", value: normalizedMapping.amountColumn },
    { label: "Description", value: normalizedMapping.descriptionColumn },
  ];

  const invalidEntry = columnEntries.find(
    (entry) => !columnReferencePattern.test(entry.value),
  );
  if (invalidEntry) {
    return `${invalidEntry.label} column must use letters like B, E, or H.`;
  }

  const uniqueColumns = new Set(columnEntries.map((entry) => entry.value));
  if (uniqueColumns.size !== columnEntries.length) {
    return "Each mapped field must point to a different column.";
  }

  return null;
};

export const describeCsvColumnMapping = (mapping: CsvColumnMapping) => {
  const normalizedMapping = normalizeCsvColumnMapping(mapping);
  return `${normalizedMapping.dateColumn}/${normalizedMapping.amountColumn}/${normalizedMapping.descriptionColumn}`;
};

export const readStoredCsvColumnMapping = (): CsvColumnMapping => {
  if (typeof window === "undefined") {
    return defaultCsvColumnMapping;
  }

  try {
    const rawValue = window.localStorage.getItem(csvColumnMappingStorageKey);
    if (!rawValue) {
      return defaultCsvColumnMapping;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<CsvColumnMapping>;
    return normalizeCsvColumnMapping({
      ...defaultCsvColumnMapping,
      ...parsedValue,
    });
  } catch {
    return defaultCsvColumnMapping;
  }
};

export const storeCsvColumnMapping = (mapping: CsvColumnMapping) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    csvColumnMappingStorageKey,
    JSON.stringify(normalizeCsvColumnMapping(mapping)),
  );
};

const convertColumnReferenceToIndex = (value: string) => {
  const normalizedValue = normalizeColumnReference(value);

  if (!columnReferencePattern.test(normalizedValue)) {
    throw new Error(`Invalid column reference "${value}".`);
  }

  let result = 0;
  for (const character of normalizedValue) {
    result = result * 26 + (character.charCodeAt(0) - 64);
  }

  return result - 1;
};

const detectDelimiter = (csvText: string) => {
  const firstLine = stripBom(csvText).split(/\r?\n/, 1)[0] ?? "";
  const supportedDelimiters = [";", ",", "\t"];

  const [bestDelimiter] = supportedDelimiters
    .map((delimiter) => ({
      delimiter,
      occurrences: firstLine.split(delimiter).length - 1,
    }))
    .sort((left, right) => right.occurrences - left.occurrences);

  return bestDelimiter?.occurrences ? bestDelimiter.delimiter : ";";
};

const parseCsvRows = (csvText: string, delimiter: string) => {
  const rows: string[][] = [];
  const normalizedText = stripBom(csvText);

  let currentField = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (character === '"') {
      if (insideQuotes && normalizedText[index + 1] === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === delimiter && !insideQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && normalizedText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
};

const escapeCsvCell = (value: string) => {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const serializeCsvRows = (rows: string[][]) =>
  rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(";")).join("\r\n");

export const prepareCsvFileForUpload = async (
  file: File,
  mapping: CsvColumnMapping,
) => {
  const validationMessage = getCsvColumnMappingValidationMessage(mapping);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  if (!mapping.enabled) {
    return file;
  }

  const normalizedMapping = normalizeCsvColumnMapping(mapping);
  const csvText = await file.text();
  const rows = parseCsvRows(csvText, detectDelimiter(csvText)).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );

  if (rows.length === 0) {
    throw new Error("The selected CSV file is empty.");
  }

  const dataRows = normalizedMapping.hasHeaderRow ? rows.slice(1) : rows;
  if (dataRows.length === 0) {
    throw new Error("No transaction rows were found after applying the header setting.");
  }

  const dateColumnIndex = convertColumnReferenceToIndex(normalizedMapping.dateColumn);
  const amountColumnIndex = convertColumnReferenceToIndex(normalizedMapping.amountColumn);
  const descriptionColumnIndex = convertColumnReferenceToIndex(
    normalizedMapping.descriptionColumn,
  );
  const highestRequiredColumnIndex = Math.max(
    dateColumnIndex,
    amountColumnIndex,
    descriptionColumnIndex,
  );

  const rowWithMissingColumnIndex = dataRows.findIndex(
    (row) => row.length <= highestRequiredColumnIndex,
  );
  if (rowWithMissingColumnIndex >= 0) {
    const sourceRowNumber =
      rowWithMissingColumnIndex + (normalizedMapping.hasHeaderRow ? 2 : 1);
    throw new Error(
      `Row ${sourceRowNumber} does not contain all mapped columns.`,
    );
  }

  const mappedRows = dataRows
    .map((row, rowIndex) => {
      const mappedRow = [
        row[dateColumnIndex]?.trim() ?? "",
        row[amountColumnIndex]?.trim() ?? "",
        row[descriptionColumnIndex]?.trim() ?? "",
      ];

      if (mappedRow.every((cell) => cell.length === 0)) {
        return null;
      }

      if (!mappedRow[0] || !mappedRow[1]) {
        const sourceRowNumber = rowIndex + (normalizedMapping.hasHeaderRow ? 2 : 1);
        throw new Error(
          `Row ${sourceRowNumber} is missing a value in the mapped date or amount column.`,
        );
      }

      return mappedRow;
    })
    .filter((row): row is string[] => row !== null);

  if (mappedRows.length === 0) {
    throw new Error("The selected mapping did not produce any importable rows.");
  }

  const remappedCsv = serializeCsvRows([
    ["Datum", "Betrag", "Verwendungszweck"],
    ...mappedRows,
  ]);
  const outputFileName = file.name.replace(/\.csv$/i, "") || "transactions";

  return new File([remappedCsv], `${outputFileName}.mapped.csv`, {
    type: "text/csv",
  });
};
