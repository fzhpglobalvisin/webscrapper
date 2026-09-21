// services/dataLoader.ts — Layer 1: Unified Data Loader
// Accepts any supported file format and returns raw unvalidated rows.

import * as XLSX from 'xlsx';
import { extractSalesDataFromMedia } from './gemini';
import { LoaderResult, LoaderMetadata } from '../types';

// ─── Public API ──────────────────────────────────────────────────────

export async function loadFile(file: File): Promise<LoaderResult> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const fileSize = formatFileSize(file.size);

  if (lowerName.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    return loadZip(file, fileName, fileSize);
  }

  return loadSingleFile({
    name: fileName,
    type: file.type,
    getText: () => file.text(),
    getArrayBuffer: () => file.arrayBuffer(),
    getBase64: () => fileToBase64(file),
  }, fileSize);
}

// ─── Single File Routing ─────────────────────────────────────────────

interface FileAccessor {
  name: string;
  type: string;
  getText: () => Promise<string>;
  getArrayBuffer: () => Promise<ArrayBuffer>;
  getBase64: () => Promise<string>;
}

async function loadSingleFile(accessor: FileAccessor, fileSize: string): Promise<LoaderResult> {
  const lowerName = accessor.name.toLowerCase();

  // Excel (.xlsx, .xls)
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    return loadExcel(accessor, fileSize);
  }

  // JSON
  if (lowerName.endsWith('.json')) {
    return loadJSON(accessor, fileSize);
  }

  // CSV / TSV / TXT (including SAP-exported CSV)
  if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
    return loadCSV(accessor, fileSize);
  }

  // PDF / Images — delegate to Gemini multimodal extraction
  if (lowerName.match(/\.(pdf|png|jpg|jpeg|webp)$/)) {
    return loadMediaViaGemini(accessor, fileSize);
  }

  throw new Error(`Unsupported file format: ${accessor.name}`);
}

// ─── Excel Loader ────────────────────────────────────────────────────

async function loadExcel(accessor: FileAccessor, fileSize: string): Promise<LoaderResult> {
  const buffer = await accessor.getArrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetNames = workbook.SheetNames;
  const sheets: Record<string, Record<string, unknown>[]> = {};
  const allRows: Record<string, unknown>[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
    sheets[sheetName] = jsonRows;
    allRows.push(...jsonRows);
  }

  return {
    rows: allRows,
    sheets,
    metadata: {
      fileName: accessor.name,
      fileSize,
      format: accessor.name.toLowerCase().endsWith('.xls') ? 'xls' : 'xlsx',
      sheetNames,
      rawRowCount: allRows.length,
      multiSheet: sheetNames.length > 1,
    },
  };
}

// ─── CSV / TSV / SAP-CSV Loader ──────────────────────────────────────

async function loadCSV(accessor: FileAccessor, fileSize: string): Promise<LoaderResult> {
  const text = await accessor.getText();
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], metadata: { fileName: accessor.name, fileSize, format: 'csv', rawRowCount: 0 } };
  }

  const firstLine = lines[0];

  // Detect delimiter: pipe (SAP), tab, semicolon, or comma
  let delimiter = ',';
  let format: LoaderMetadata['format'] = 'csv';

  if (firstLine.includes('|') && !firstLine.includes(',')) {
    delimiter = '|';
    format = 'sap-csv';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
    format = 'tsv';
  } else if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  }

  const headers = splitCSVLine(firstLine, delimiter).map(h => h.trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx]?.trim() ?? '';
    });
    rows.push(row);
  }

  return {
    rows,
    metadata: {
      fileName: accessor.name,
      fileSize,
      format,
      rawRowCount: rows.length,
      detectedDelimiter: delimiter,
    },
  };
}

function splitCSVLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t' || delimiter === '|') {
    return line.split(delimiter).map(s => s.trim());
  }

  // Handle quoted CSV fields
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── JSON Loader ─────────────────────────────────────────────────────

async function loadJSON(accessor: FileAccessor, fileSize: string): Promise<LoaderResult> {
  const text = await accessor.getText();
  const parsed = JSON.parse(text);

  const array = Array.isArray(parsed)
    ? parsed
    : (parsed.records || parsed.data || parsed.sales || parsed.items || parsed.results || []);

  return {
    rows: array as Record<string, unknown>[],
    metadata: {
      fileName: accessor.name,
      fileSize,
      format: 'json',
      rawRowCount: array.length,
    },
  };
}

// ─── PDF / Image via Gemini ──────────────────────────────────────────

async function loadMediaViaGemini(accessor: FileAccessor, fileSize: string): Promise<LoaderResult> {
  const base64 = await accessor.getBase64();
  const mimeType = accessor.type || getMimeType(accessor.name);

  // extractSalesDataFromMedia returns SalesRecord[], but for the pipeline
  // we convert them to raw rows so they go through validation too
  const records = await extractSalesDataFromMedia(base64, mimeType);

  const rows: Record<string, unknown>[] = records.map(r => ({ ...r }));

  const isPdf = accessor.name.toLowerCase().endsWith('.pdf');

  return {
    rows,
    metadata: {
      fileName: accessor.name,
      fileSize,
      format: isPdf ? 'pdf' : 'image',
      rawRowCount: rows.length,
    },
  };
}

// ─── ZIP Loader ──────────────────────────────────────────────────────

async function loadZip(file: File, fileName: string, fileSize: string): Promise<LoaderResult> {
  throw new Error('ZIP archive extraction is disabled. Please upload your .xlsx or .csv dataset directly.');
}

// ─── Utilities ───────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
