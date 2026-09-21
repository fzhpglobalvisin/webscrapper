// services/relationalModelEngine.ts — Automated Multi-Sheet Relational Schema & ER Engine
// Ingests multiple worksheets, detects Primary Keys (PK) & Foreign Keys (FK),
// cleans all financial currency columns to raw floats, and outputs a normalized Entity-Relationship graph.

import { 
  ColumnProfile, 
  SheetEntity, 
  RelationalRelationship, 
  RelationalDataModel, 
  SalesRecord 
} from '../types';
import { stripCurrencyAndParseFloat, isFinancialOrNumeric } from './currencyStripper';

// ─── Primary Key & Foreign Key Detection Heuristics ─────────────────

const PK_NAME_PATTERNS = [
  /^(?:id|_id|pk|uuid|guid)$/i,
  /^(?:.*_id|.*id|.*code|.*key|.*number|.*no|.*num)$/i,
  /^(?:invoice_?no|inv_?no|order_?no|order_?id|cust_?id|customer_?id|item_?id|sku|distributor_?id)$/i
];

/**
 * Generates an Entity profile for a single worksheet
 */
export function profileSheet(
  sheetName: string, 
  rawRows: Record<string, unknown>[]
): { entity: SheetEntity; cleanRows: Record<string, any>[] } {
  const cleanSheetName = sheetName.trim();
  const sheetId = cleanSheetName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  // 1. Gather all unique column headers
  const colSet = new Set<string>();
  rawRows.forEach(row => {
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
  const sampleSize = Math.min(rawRows.length, 250);

  // 2. Classify columns and detect numeric, categorical, date
  const numericColumns: string[] = [];
  const dateColumns: string[] = [];
  const categoricalColumns: string[] = [];
  const columnProfiles: Record<string, ColumnProfile> = {};

  let sheetCurrencyStrippedCount = 0;

  columns.forEach(col => {
    let numericCount = 0;
    let dateCount = 0;
    let nonEmptyCount = 0;
    let currencyCount = 0;

    const valuesSeen = new Set<string>();
    const samples: any[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const v = rawRows[i]?.[col];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        nonEmptyCount++;
        const strVal = String(v).trim();
        valuesSeen.add(strVal.toLowerCase());
        if (samples.length < 5) samples.push(v);

        if (isFinancialOrNumeric(v)) {
          numericCount++;
          const { wasStripped } = stripCurrencyAndParseFloat(v);
          if (wasStripped) currencyCount++;
        } else if (isDateVal(v)) {
          dateCount++;
        }
      }
    }

    const isNumeric = nonEmptyCount > 0 && (numericCount / nonEmptyCount >= 0.6);
    const isDate = !isNumeric && nonEmptyCount > 0 && (dateCount / nonEmptyCount >= 0.6);
    const isCategorical = !isNumeric && !isDate;

    if (isNumeric) numericColumns.push(col);
    else if (isDate) dateColumns.push(col);
    else categoricalColumns.push(col);

    const uniqueCount = valuesSeen.size;
    const uniquenessRatio = rawRows.length > 0 ? uniqueCount / rawRows.length : 0;

    // Primary key heuristic:
    // High uniqueness (>= 0.95), non-empty, and preferably matches ID pattern or is non-numeric/string code
    const matchesPkPattern = PK_NAME_PATTERNS.some(p => p.test(col));
    const isPkCandidate = (uniquenessRatio >= 0.95 && nonEmptyCount === rawRows.length && rawRows.length > 1) ||
                          (matchesPkPattern && uniquenessRatio >= 0.90 && nonEmptyCount > 0);

    const isFkCandidate = matchesPkPattern && !isPkCandidate;

    columnProfiles[col] = {
      name: col,
      dataType: isNumeric ? 'number' : isDate ? 'date' : 'string',
      isNumeric,
      isDate,
      uniqueCount,
      totalCount: rawRows.length,
      nullCount: rawRows.length - nonEmptyCount,
      uniquenessRatio,
      isPrimaryKeyCandidate: isPkCandidate,
      isForeignKeyCandidate: isFkCandidate,
      sampleValues: samples,
      currencyStrippedCount: currencyCount
    };

    sheetCurrencyStrippedCount += currencyCount;
  });

  // 3. Select best Primary Key candidate
  let primaryKey: string | undefined;
  // First priority: matches ID pattern and has 100% uniqueness
  const candidateKeys = Object.values(columnProfiles).filter(p => p.isPrimaryKeyCandidate);
  if (candidateKeys.length > 0) {
    // Sort by: matches pattern first, then uniqueness ratio descending
    candidateKeys.sort((a, b) => {
      const aPattern = PK_NAME_PATTERNS.some(p => p.test(a.name)) ? 1 : 0;
      const bPattern = PK_NAME_PATTERNS.some(p => p.test(b.name)) ? 1 : 0;
      if (aPattern !== bPattern) return bPattern - aPattern;
      return b.uniquenessRatio - a.uniquenessRatio;
    });
    primaryKey = candidateKeys[0].name;
  }

  // 4. Sanitize all rows: Clean and strip currency globally!
  const cleanRows: Record<string, any>[] = [];

  rawRows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;
    const clean: Record<string, any> = {};
    let hasData = false;

    columns.forEach(col => {
      const rawVal = row[col];
      if (numericColumns.includes(col)) {
        const { value, wasStripped } = stripCurrencyAndParseFloat(rawVal);
        clean[col] = value;
        if (value !== 0) hasData = true;
      } else if (dateColumns.includes(col)) {
        const dateStr = cleanDate(rawVal);
        clean[col] = dateStr;
        if (dateStr) hasData = true;
      } else {
        const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
        clean[col] = strVal;
        if (strVal) hasData = true;
      }
    });

    if (hasData) {
      cleanRows.push(clean);
    }
  });

  const entity: SheetEntity = {
    id: sheetId,
    name: cleanSheetName,
    rowCount: cleanRows.length,
    columns,
    columnProfiles,
    primaryKey,
    numericColumns,
    categoricalColumns,
    dateColumns,
    rows: cleanRows,
    currencyStrippedFields: sheetCurrencyStrippedCount
  };

  return { entity, cleanRows };
}

/**
 * Builds the complete Relational Data Model across all sheets
 */
export function buildRelationalDataModel(
  sheetsData: Record<string, Record<string, unknown>[]>,
  modelName: string = 'Enterprise Relational Model'
): RelationalDataModel {
  const sheetNames = Object.keys(sheetsData);
  const entities: Record<string, SheetEntity> = {};
  let totalRowsAcrossSheets = 0;
  let totalColumnsAcrossSheets = 0;
  let totalCurrencyFieldsStripped = 0;

  // 1. Profile and clean each sheet
  sheetNames.forEach(sheetName => {
    const rawRows = sheetsData[sheetName] || [];
    const { entity } = profileSheet(sheetName, rawRows);
    entities[sheetName] = entity;
    totalRowsAcrossSheets += entity.rowCount;
    totalColumnsAcrossSheets += entity.columns.length;
    totalCurrencyFieldsStripped += entity.currencyStrippedFields;
  });

  // 2. Discover Relationships (PK <-> FK) across sheets
  const relationships: RelationalRelationship[] = [];
  const relationshipIdSet = new Set<string>();

  for (let i = 0; i < sheetNames.length; i++) {
    for (let j = 0; j < sheetNames.length; j++) {
      if (i === j) continue;
      const sheetA = entities[sheetNames[i]];
      const sheetB = entities[sheetNames[j]];

      // Check if Sheet A has a primary key (or candidate) that Sheet B references
      const pkCandidates = sheetA.primaryKey 
        ? [sheetA.columnProfiles[sheetA.primaryKey]].filter(Boolean)
        : Object.values(sheetA.columnProfiles).filter(p => p.isPrimaryKeyCandidate);

      pkCandidates.forEach(pkProfile => {
        const pkCol = pkProfile.name;
        const normPk = normalizeColName(pkCol);

        // Check columns in Sheet B
        sheetB.columns.forEach(colB => {
          const normColB = normalizeColName(colB);

          // Direct match or foreign key naming match
          // e.g. Customer.customer_id <-> Orders.customer_id
          // or Customer.id <-> Orders.customer_id
          let isMatch = false;
          let confidence = 0;

          if (normPk === normColB) {
            isMatch = true;
            confidence = 0.95;
          } else if (
            normColB === `${normalizeColName(sheetA.name)}_${normPk}` ||
            normColB === `${normalizeColName(sheetA.name)}${normPk}` ||
            normPk === `${normalizeColName(sheetB.name)}_${normColB}`
          ) {
            isMatch = true;
            confidence = 0.85;
          } else if (normPk.endsWith('id') && normColB.endsWith('id') && (normPk.includes(normColB) || normColB.includes(normPk))) {
            isMatch = true;
            confidence = 0.75;
          }

          if (isMatch) {
            // Validate value overlap between Sheet A[pkCol] and Sheet B[colB]
            const setA = new Set(sheetA.rows.map(r => String(r[pkCol] || '').trim().toLowerCase()).filter(Boolean));
            let matchesFound = 0;
            let checksPerformed = 0;

            const bSample = sheetB.rows.slice(0, 100);
            bSample.forEach(rB => {
              const valB = String(rB[colB] || '').trim().toLowerCase();
              if (valB) {
                checksPerformed++;
                if (setA.has(valB)) matchesFound++;
              }
            });

            const overlapRatio = checksPerformed > 0 ? matchesFound / checksPerformed : 0;
            if (overlapRatio > 0.3 || (checksPerformed === 0 && confidence >= 0.85)) {
              const relId = `${sheetA.name}.${pkCol}->${sheetB.name}.${colB}`;
              if (!relationshipIdSet.has(relId)) {
                relationshipIdSet.add(relId);
                relationships.push({
                  id: relId,
                  fromSheet: sheetA.name,
                  fromColumn: pkCol,
                  toSheet: sheetB.name,
                  toColumn: colB,
                  cardinality: '1:N',
                  confidence: Math.min(1.0, confidence * (overlapRatio > 0 ? (0.5 + 0.5 * overlapRatio) : 1)),
                  description: `${sheetA.name}.${pkCol} (PK) links to ${sheetB.name}.${colB} (FK) with ${(overlapRatio * 100).toFixed(0)}% reference overlap`
                });
              }
            }
          }
        });
      });
    }
  }

  // 3. Determine Primary Fact Sheet
  // Fact sheet usually has the most numeric metrics and/or the highest row count
  let primaryFactSheet = sheetNames[0];
  let maxFactScore = -1;

  sheetNames.forEach(sheetName => {
    const ent = entities[sheetName];
    // Score based on numeric columns and row count
    const score = ent.numericColumns.length * 3 + Math.log10(Math.max(1, ent.rowCount));
    if (score > maxFactScore) {
      maxFactScore = score;
      primaryFactSheet = sheetName;
    }
  });

  return {
    id: `model-${Date.now()}`,
    name: modelName,
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
    sheets: entities,
    sheetOrder: sheetNames,
    relationships,
    primaryFactSheet,
    totalRowsAcrossSheets,
    totalColumnsAcrossSheets,
    totalCurrencyFieldsStripped
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normalizeColName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDateVal(val: unknown): boolean {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (!val || typeof val === 'number' || typeof val === 'boolean') return false;
  const str = String(val).trim();
  if (str.length < 6 || str.length > 30) return false;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(str)) return true;
  const timestamp = Date.parse(str);
  return !isNaN(timestamp) && timestamp > 0;
}

function cleanDate(val: unknown): string {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().slice(0, 10);
  }
  if (!val) return '';
  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return str;
}
