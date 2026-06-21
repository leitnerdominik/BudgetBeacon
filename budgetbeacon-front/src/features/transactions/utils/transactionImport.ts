import { readSheet } from "read-excel-file/browser";

export type TransactionImportFileKind = "csv" | "xlsx";

export interface ParsedTransactionImportFile {
  rows: string[][];
  delimiter: string;
  fileKind: TransactionImportFileKind;
}

export type CsvDelimiterOption = "auto" | "semicolon" | "comma" | "tab";

export interface TransactionImportColumn {
  key: string;
  index: number;
  columnLetter: string;
  header: string;
  label: string;
  sampleValue: string;
}

export interface TransactionImportPreview {
  columns: TransactionImportColumn[];
  previewRows: string[][];
  totalRowCount: number;
}

export interface TransactionImportMapping {
  hasHeaderRow: boolean;
  dateColumnKey: string;
  amountColumnKey: string;
  descriptionColumnKey: string;
}

type ExcelCellValue = string | number | boolean | Date | null;

const transactionImportMappingStorageKey = "transactions.importMapping.v3";
const previewRowLimit = 5;
export const maxTransactionImportFileSizeBytes = 5 * 1024 * 1024;
export const maxTransactionImportRowCount = 10_000;

const fieldHeaderAliases = {
  date: ["datum", "buchungstag", "date", "wertstellung", "valuta"],
  amount: ["betrag", "umsatz", "amount", "summe", "wert"],
  description: [
    "verwendungszweck",
    "beschreibung",
    "description",
    "buchungstext",
    "text",
    "referenz",
    "purpose",
    "payee",
    "empfaenger",
  ],
} as const;

export const defaultTransactionImportMapping: TransactionImportMapping = {
  hasHeaderRow: true,
  dateColumnKey: "",
  amountColumnKey: "",
  descriptionColumnKey: "",
};

export const getTransactionImportFileKind = (
  file: File,
): TransactionImportFileKind => {
  if (/\.xlsx$/i.test(file.name)) {
    return "xlsx";
  }

  if (/\.csv$/i.test(file.name)) {
    return "csv";
  }

  throw new Error("Select a .csv or .xlsx file to import transactions.");
};

const stripBom = (value: string) => value.replace(/^\uFEFF/, "");

const normalizeHeaderValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const resolveDelimiterOption = (delimiterOption: CsvDelimiterOption) => {
  switch (delimiterOption) {
    case "comma":
      return ",";
    case "tab":
      return "\t";
    case "semicolon":
      return ";";
    case "auto":
    default:
      return null;
  }
};

const escapeCsvCell = (value: string, delimiter: string) => {
  if (value.includes(delimiter) || /["\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const serializeCsvRows = (rows: string[][], delimiter: string) =>
  rows
    .map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter))
    .join("\r\n");

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

const formatDateCell = (value: Date) => {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
};

const formatCellValue = (value: ExcelCellValue) => {
  if (value === null) {
    return "";
  }

  if (value instanceof Date) {
    return formatDateCell(value);
  }

  return String(value).trim();
};

const isNonEmptyRow = (row: string[]) =>
  row.some((cell) => cell.trim().length > 0);

const assertTransactionImportRowLimit = (rows: string[][]) => {
  if (rows.length > maxTransactionImportRowCount) {
    throw new Error(
      `The selected file contains more than ${maxTransactionImportRowCount.toLocaleString(
        "en-US",
      )} data row(s). Split the file and import it in smaller batches.`,
    );
  }
};

const pushParsedRow = (rows: string[][], row: string[]) => {
  if (!isNonEmptyRow(row)) {
    return;
  }

  rows.push(row);
  assertTransactionImportRowLimit(rows);
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
      pushParsedRow(rows, currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    pushParsedRow(rows, currentRow);
  }

  if (insideQuotes) {
    throw new Error("The selected CSV file contains an unterminated quoted field.");
  }

  return rows;
};

const toColumnLetter = (index: number) => {
  let result = "";
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
};

const getMaxColumnCount = (rows: string[][]) =>
  rows.reduce((maxColumns, row) => Math.max(maxColumns, row.length), 0);

const resolveColumnKey = (index: number) => String(index);

const getDataRows = (rows: string[][], hasHeaderRow: boolean) =>
  hasHeaderRow ? rows.slice(1) : rows;

const getFallbackColumnLabel = (index: number) => `Column ${toColumnLetter(index)}`;

export const readStoredTransactionImportMapping = (): TransactionImportMapping => {
  if (typeof window === "undefined") {
    return defaultTransactionImportMapping;
  }

  try {
    const rawValue = window.localStorage.getItem(transactionImportMappingStorageKey);
    if (!rawValue) {
      return defaultTransactionImportMapping;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<TransactionImportMapping>;
    return {
      ...defaultTransactionImportMapping,
      ...parsedValue,
    };
  } catch {
    return defaultTransactionImportMapping;
  }
};

export const storeTransactionImportMapping = (
  mapping: TransactionImportMapping,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    transactionImportMappingStorageKey,
    JSON.stringify(mapping),
  );
};

export const parseCsvText = (
  csvText: string,
  delimiterOption: CsvDelimiterOption = "auto",
): ParsedTransactionImportFile => {
  const delimiter = resolveDelimiterOption(delimiterOption) ?? detectDelimiter(csvText);
  const rows = parseCsvRows(csvText, delimiter);

  if (rows.length === 0) {
    throw new Error("The selected CSV file is empty.");
  }

  return {
    rows,
    delimiter,
    fileKind: "csv",
  };
};

const parseXlsxFile = async (
  file: File,
): Promise<ParsedTransactionImportFile> => {
  const rows = ((await readSheet(file)) as ExcelCellValue[][])
    .map((row) => row.map(formatCellValue))
    .filter(isNonEmptyRow);

  assertTransactionImportRowLimit(rows);

  if (rows.length === 0) {
    throw new Error("The selected XLSX file is empty.");
  }

  return {
    rows,
    delimiter: ";",
    fileKind: "xlsx",
  };
};

export const parseTransactionImportFile = async (
  file: File,
  delimiterOption: CsvDelimiterOption = "auto",
): Promise<ParsedTransactionImportFile> => {
  if (file.size > maxTransactionImportFileSizeBytes) {
    throw new Error(
      `The selected file is too large. The maximum size is ${Math.floor(
        maxTransactionImportFileSizeBytes / 1024 / 1024,
      )} MB.`,
    );
  }

  const fileKind = getTransactionImportFileKind(file);

  return fileKind === "xlsx"
    ? parseXlsxFile(file)
    : parseCsvText(await file.text(), delimiterOption);
};

export const getTransactionImportPreview = (
  parsedFile: ParsedTransactionImportFile,
  hasHeaderRow: boolean,
): TransactionImportPreview => {
  const maxColumnCount = getMaxColumnCount(parsedFile.rows);
  const dataRows = getDataRows(parsedFile.rows, hasHeaderRow);
  const headerRow = hasHeaderRow ? parsedFile.rows[0] ?? [] : [];

  const columns = Array.from({ length: maxColumnCount }, (_, index) => {
    const columnLetter = toColumnLetter(index);
    const header = headerRow[index]?.trim() ?? "";
    const sampleValue =
      dataRows.find((row) => (row[index] ?? "").trim().length > 0)?.[index]?.trim() ??
      "";

    return {
      key: resolveColumnKey(index),
      index,
      columnLetter,
      header,
      label:
        hasHeaderRow && header
          ? `${header} (${columnLetter})`
          : getFallbackColumnLabel(index),
      sampleValue,
    };
  });

  return {
    columns,
    previewRows: dataRows.slice(0, previewRowLimit),
    totalRowCount: dataRows.length,
  };
};

const findSuggestedColumnKey = (
  columns: TransactionImportColumn[],
  aliases: readonly string[],
  excludedKeys: Set<string>,
) => {
  const match = columns.find((column) => {
    if (excludedKeys.has(column.key) || !column.header) {
      return false;
    }

    const normalizedHeader = normalizeHeaderValue(column.header);
    return aliases.some((alias) => normalizedHeader.includes(alias));
  });

  return match?.key ?? "";
};

const pickFirstAvailableColumnKey = (
  columns: TransactionImportColumn[],
  excludedKeys: Set<string>,
) => columns.find((column) => !excludedKeys.has(column.key))?.key ?? "";

export const suggestTransactionImportMapping = (
  columns: TransactionImportColumn[],
  previousMapping?: TransactionImportMapping,
): TransactionImportMapping => {
  const nextMapping: TransactionImportMapping = {
    hasHeaderRow:
      previousMapping?.hasHeaderRow ?? defaultTransactionImportMapping.hasHeaderRow,
    dateColumnKey: "",
    amountColumnKey: "",
    descriptionColumnKey: "",
  };
  const excludedKeys = new Set<string>();
  const keepIfAvailable = (key: string) =>
    columns.some((column) => column.key === key) ? key : "";

  nextMapping.dateColumnKey = keepIfAvailable(previousMapping?.dateColumnKey ?? "");
  if (nextMapping.dateColumnKey) {
    excludedKeys.add(nextMapping.dateColumnKey);
  } else {
    nextMapping.dateColumnKey =
      findSuggestedColumnKey(columns, fieldHeaderAliases.date, excludedKeys) ||
      pickFirstAvailableColumnKey(columns, excludedKeys);
    if (nextMapping.dateColumnKey) {
      excludedKeys.add(nextMapping.dateColumnKey);
    }
  }

  nextMapping.amountColumnKey = keepIfAvailable(
    previousMapping?.amountColumnKey ?? "",
  );
  if (nextMapping.amountColumnKey && !excludedKeys.has(nextMapping.amountColumnKey)) {
    excludedKeys.add(nextMapping.amountColumnKey);
  } else {
    nextMapping.amountColumnKey =
      findSuggestedColumnKey(columns, fieldHeaderAliases.amount, excludedKeys) ||
      pickFirstAvailableColumnKey(columns, excludedKeys);
    if (nextMapping.amountColumnKey) {
      excludedKeys.add(nextMapping.amountColumnKey);
    }
  }

  nextMapping.descriptionColumnKey = keepIfAvailable(
    previousMapping?.descriptionColumnKey ?? "",
  );
  if (
    nextMapping.descriptionColumnKey &&
    !excludedKeys.has(nextMapping.descriptionColumnKey)
  ) {
    excludedKeys.add(nextMapping.descriptionColumnKey);
  } else {
    nextMapping.descriptionColumnKey =
      findSuggestedColumnKey(columns, fieldHeaderAliases.description, excludedKeys) ||
      pickFirstAvailableColumnKey(columns, excludedKeys);
  }

  return nextMapping;
};

export const getTransactionImportMappingValidationMessage = (
  mapping: TransactionImportMapping,
  columns: TransactionImportColumn[],
) => {
  const requiredFields = [
    { label: "Date", key: mapping.dateColumnKey },
    { label: "Amount", key: mapping.amountColumnKey },
  ];

  const missingField = requiredFields.find((field) => !field.key);
  if (missingField) {
    return `${missingField.label} must be mapped before importing.`;
  }

  const selectedKeys = [
    mapping.dateColumnKey,
    mapping.amountColumnKey,
    mapping.descriptionColumnKey,
  ].filter(Boolean);

  if (new Set(selectedKeys).size !== selectedKeys.length) {
    return "Each target field must use a different source column.";
  }

  const unknownField = selectedKeys.find(
    (selectedKey) => !columns.some((column) => column.key === selectedKey),
  );
  if (unknownField) {
    return "One of the selected columns is no longer available in the preview.";
  }

  return null;
};

export const resolveImportColumnIndex = (key: string) => Number.parseInt(key, 10);

export const createMappedCsvFile = (
  originalFile: File,
  parsedFile: ParsedTransactionImportFile,
  mapping: TransactionImportMapping,
) => {
  const preview = getTransactionImportPreview(parsedFile, mapping.hasHeaderRow);
  const validationMessage = getTransactionImportMappingValidationMessage(
    mapping,
    preview.columns,
  );
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const dateColumnIndex = resolveImportColumnIndex(mapping.dateColumnKey);
  const amountColumnIndex = resolveImportColumnIndex(mapping.amountColumnKey);
  const descriptionColumnIndex = mapping.descriptionColumnKey
    ? resolveImportColumnIndex(mapping.descriptionColumnKey)
    : -1;
  const dataRows = getDataRows(parsedFile.rows, mapping.hasHeaderRow);

  if (dataRows.length === 0) {
    throw new Error("No transaction rows were found in the selected CSV file.");
  }

  const mappedRows = dataRows
    .map((row, rowIndex) => {
      const date = row[dateColumnIndex]?.trim() ?? "";
      const amount = row[amountColumnIndex]?.trim() ?? "";
      const description =
        descriptionColumnIndex >= 0 ? row[descriptionColumnIndex]?.trim() ?? "" : "";

      if (!date && !amount && !description) {
        return null;
      }

      if (!date || !amount) {
        const sourceRowNumber = rowIndex + (mapping.hasHeaderRow ? 2 : 1);
        throw new Error(
          `Row ${sourceRowNumber} is missing a value in the mapped date or amount column.`,
        );
      }

      return [date, amount, description];
    })
    .filter((row): row is string[] => row !== null);

  if (mappedRows.length === 0) {
    throw new Error("The selected mapping did not produce any importable rows.");
  }

  const remappedCsv = serializeCsvRows(
    [
      ["Datum", "Betrag", "Verwendungszweck"],
      ...mappedRows,
    ],
    parsedFile.delimiter,
  );
  const outputFileName = originalFile.name.replace(/\.csv$/i, "") || "transactions";

  return new File([remappedCsv], `${outputFileName}.mapped.csv`, {
    type: "text/csv",
  });
};
