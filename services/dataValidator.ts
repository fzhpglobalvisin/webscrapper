// services/dataValidator.ts — Pure Dynamic Dataset Extraction & Schema Detection
// Zero mock column names. Zero mock data. Extracts true columns and data directly from user file.

import { SalesRecord, ValidationResult, ValidationIssue, ValidationSummary, DatasetSchema } from '../types';
import { stripCurrencyAndParseFloat, isFinancialOrNumeric } from './currencyStripper';

// ─── Public API ──────────────────────────────────────────────────────

export function validateRows(rows: Record<string, unknown>[]): ValidationResult {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    const emptySchema: DatasetSchema = {
      columns: [],
      numericColumns: [],
      categoricalColumns: [],
      dateColumns: [],
    };
    return {
      valid: [],
      schema: emptySchema,
      warnings: [],
      errors: [{ row: 0, field: 'file', value: null, rule: 'empty_file', message: 'Dataset contains 0 records', severity: 'error' }],
      summary: { totalRows: 0, validRows: 0, warningRows: 0, errorRows: 0, autoFixedFields: 0 }
    };
  }

  // 1. Extract ALL unique columns present in the raw rows in their original order
  const colSet = new Set<string>();
  rows.forEach(row => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach(k => {
        const trimmed = k.trim();
        if (trimmed && !trimmed.startsWith('__EMPTY')) {
          colSet.add(trimmed);
        }
      });
    }
  });

  const columns = Array.from(colSet);

  if (columns.length === 0) {
    return {
      valid: [],
      schema: { columns: [], numericColumns: [], categoricalColumns: [], dateColumns: [] },
      warnings: [],
      errors: [{ row: 0, field: 'header', value: null, rule: 'no_columns', message: 'No valid column headers found in dataset', severity: 'error' }],
      summary: { totalRows: rows.length, validRows: 0, warningRows: 0, errorRows: rows.length, autoFixedFields: 0 }
    };
  }

  // 2. Classify each column dynamically based on actual row values
  const numericColumns: string[] = [];
  const dateColumns: string[] = [];
  const categoricalColumns: string[] = [];

  columns.forEach(col => {
    let numericCount = 0;
    let dateCount = 0;
    let nonEmptyCount = 0;

    const sampleSize = Math.min(rows.length, 100);
    for (let i = 0; i < sampleSize; i++) {
      const val = rows[i]?.[col];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        nonEmptyCount++;
        if (isNumericValue(val)) {
          numericCount++;
        } else if (isDateValue(val)) {
          dateCount++;
        }
      }
    }

    if (nonEmptyCount > 0 && numericCount / nonEmptyCount >= 0.55) {
      numericColumns.push(col);
    } else if (nonEmptyCount > 0 && dateCount / nonEmptyCount >= 0.55) {
      dateColumns.push(col);
    } else {
      categoricalColumns.push(col);
    }
  });

  const schema: DatasetSchema = {
    columns,
    numericColumns,
    categoricalColumns,
    dateColumns,
  };

  // 3. Clean and sanitize rows preserving exact column names
  let autoFixedFields = 0;
  const valid: SalesRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw || typeof raw !== 'object') continue;

    const rowNum = i + 1;
    const cleanRow: Record<string, any> = {};

    let hasAnyData = false;

    columns.forEach(col => {
      const rawVal = raw[col];

      if (numericColumns.includes(col)) {
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
          cleanRow[col] = 0;
        } else if (typeof rawVal === 'number') {
          cleanRow[col] = isNaN(rawVal) ? 0 : rawVal;
          hasAnyData = true;
        } else {
          const { value: parsedNum, wasStripped } = parseNumber(rawVal);
          cleanRow[col] = parsedNum;
          if (parsedNum !== 0) hasAnyData = true;
          if (wasStripped || String(rawVal) !== String(parsedNum)) {
            autoFixedFields++;
          }
        }
      } else if (dateColumns.includes(col)) {
        const dateStr = cleanDateString(rawVal);
        cleanRow[col] = dateStr;
        if (dateStr) hasAnyData = true;
      } else {
        const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
        cleanRow[col] = strVal;
        if (strVal) hasAnyData = true;
      }
    });

    if (hasAnyData) {
      valid.push(cleanRow);
    } else {
      warnings.push({
        row: rowNum,
        field: 'row',
        value: null,
        rule: 'empty_row_skipped',
        message: `Row ${rowNum} was empty and omitted`,
        severity: 'warning'
      });
    }
  }

  const summary: ValidationSummary = {
    totalRows: rows.length,
    validRows: valid.length,
    warningRows: warnings.length,
    errorRows: errors.length,
    autoFixedFields,
  };

  return {
    valid,
    schema,
    warnings,
    errors,
    summary,
  };
}

// ─── Type Detection & Coercion Helpers ───────────────────────────────

function isNumericValue(val: unknown): boolean {
  return isFinancialOrNumeric(val);
}

function parseNumber(val: unknown): { value: number; wasStripped: boolean } {
  return stripCurrencyAndParseFloat(val);
}

function isDateValue(val: unknown): boolean {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (!val || typeof val === 'number' || typeof val === 'boolean') return false;

  const str = String(val).trim();
  if (str.length < 6 || str.length > 30) return false;

  // Common patterns
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(str)) return true;

  const timestamp = Date.parse(str);
  return !isNaN(timestamp) && timestamp > 0;
}

function cleanDateString(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().slice(0, 10);
  }
  if (!val) return '';

  const str = String(val).trim();
  if (!str) return '';

  // Standardize YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // Try parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return str;
}
