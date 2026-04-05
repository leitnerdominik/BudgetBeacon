export interface ParsedCsvFile {
  rows: string[][];
  delimiter: string;
}

export interface CsvImportColumn {
  key: string;
  index: number;
  columnLetter: string;
  header: string;
  label: string;
  sampleValue: string;
}

export interface CsvImportPreview {
  columns: CsvImportColumn[];
  previewRows: string[][];
  totalRowCount: number;
}

export interface CsvImportMapping {
  hasHeaderRow: boolean;
  dateColumnKey: string;
  amountColumnKey: string;
  descriptionColumnKey: string;
}

const csvImportMappingStorageKey = "transactions.csvImportMapping.v2";
const previewRowLimit = 5;

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

export const defaultCsvImportMapping: CsvImportMapping = {
  hasHeaderRow: true,
  dateColumnKey: "",
  amountColumnKey: "",
  descriptionColumnKey: "",
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

const escapeCsvCell = (value: string) => {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const serializeCsvRows = (rows: string[][]) =>
  rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(";")).join("\r\n");

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

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
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

export const readStoredCsvImportMapping = (): CsvImportMapping => {
  if (typeof window === "undefined") {
    return defaultCsvImportMapping;
  }

  try {
    const rawValue = window.localStorage.getItem(csvImportMappingStorageKey);
    if (!rawValue) {
      return defaultCsvImportMapping;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<CsvImportMapping>;
    return {
      ...defaultCsvImportMapping,
      ...parsedValue,
    };
  } catch {
    return defaultCsvImportMapping;
  }
};

export const storeCsvImportMapping = (mapping: CsvImportMapping) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    csvImportMappingStorageKey,
    JSON.stringify(mapping),
  );
};

export const parseCsvFile = async (file: File): Promise<ParsedCsvFile> => {
  const csvText = await file.text();
  const delimiter = detectDelimiter(csvText);
  const rows = parseCsvRows(csvText, delimiter);

  if (rows.length === 0) {
    throw new Error("The selected CSV file is empty.");
  }

  return {
    rows,
    delimiter,
  };
};

export const getCsvImportPreview = (
  parsedCsv: ParsedCsvFile,
  hasHeaderRow: boolean,
): CsvImportPreview => {
  const maxColumnCount = getMaxColumnCount(parsedCsv.rows);
  const dataRows = getDataRows(parsedCsv.rows, hasHeaderRow);
  const headerRow = hasHeaderRow ? parsedCsv.rows[0] ?? [] : [];

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
  columns: CsvImportColumn[],
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
  columns: CsvImportColumn[],
  excludedKeys: Set<string>,
) => columns.find((column) => !excludedKeys.has(column.key))?.key ?? "";

export const suggestCsvImportMapping = (
  columns: CsvImportColumn[],
  previousMapping?: CsvImportMapping,
): CsvImportMapping => {
  const nextMapping: CsvImportMapping = {
    hasHeaderRow: previousMapping?.hasHeaderRow ?? defaultCsvImportMapping.hasHeaderRow,
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

  nextMapping.amountColumnKey = keepIfAvailable(previousMapping?.amountColumnKey ?? "");
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

export const getCsvImportMappingValidationMessage = (
  mapping: CsvImportMapping,
  columns: CsvImportColumn[],
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

const resolveColumnIndex = (key: string) => Number.parseInt(key, 10);

export const createMappedCsvFile = (
  originalFile: File,
  parsedCsv: ParsedCsvFile,
  mapping: CsvImportMapping,
) => {
  const preview = getCsvImportPreview(parsedCsv, mapping.hasHeaderRow);
  const validationMessage = getCsvImportMappingValidationMessage(
    mapping,
    preview.columns,
  );
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const dateColumnIndex = resolveColumnIndex(mapping.dateColumnKey);
  const amountColumnIndex = resolveColumnIndex(mapping.amountColumnKey);
  const descriptionColumnIndex = mapping.descriptionColumnKey
    ? resolveColumnIndex(mapping.descriptionColumnKey)
    : -1;
  const dataRows = getDataRows(parsedCsv.rows, mapping.hasHeaderRow);

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

  const remappedCsv = serializeCsvRows([
    ["Datum", "Betrag", "Verwendungszweck"],
    ...mappedRows,
  ]);
  const outputFileName = originalFile.name.replace(/\.csv$/i, "") || "transactions";

  return new File([remappedCsv], `${outputFileName}.mapped.csv`, {
    type: "text/csv",
  });
};
