// services/currencyStripper.ts — Universal Currency & Financial Number Sanitizer
// Strips ALL global currency symbols ($ PKR, Rs, €, £, ¥, ₹, ₩, ₪, ฿, ₫, CHF, CAD, AUD, etc.)
// accounting parentheses (1,234.50) -> -1234.50, commas, thousands separators, and returns clean raw IEEE-754 floats.

/**
 * Exhaustive regex matching currency ISO codes, symbols, prefixes, and suffixes
 */
const CURRENCY_SYMBOLS_REGEX = /(?:PKR|Rs\.?|USD|\$|EUR|€|GBP|£|INR|₹|JPY|¥|CNY|AUD|CAD|CHF|SGD|HKD|NZD|AED|SAR|QAR|KWD|OMR|BHD|EGP|ZAR|BRL|RUB|KRW|₩|ILS|₪|THB|฿|VND|₫|TRY|₺|PLN|zł|SEK|NOK|DKK|IDR|Rp|MYR|RM|PHP|₱|CZK|Kč|HUF|Ft|MXN|ARS|CLP|COP)/gi;

/**
 * Checks if a string or value contains currency formatting or financial currency cues
 */
export function hasCurrencyFormatting(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return CURRENCY_SYMBOLS_REGEX.test(trimmed) || /^\(.*\)$/.test(trimmed);
}

/**
 * Strips all currency symbols, accounting formatting, commas, spaces, and parses to a clean raw number/float.
 * Returns { value: number, wasStripped: boolean, original: unknown }
 */
export function stripCurrencyAndParseFloat(val: unknown): { value: number; wasStripped: boolean } {
  if (typeof val === 'number') {
    return { value: isNaN(val) ? 0 : val, wasStripped: false };
  }
  if (val === null || val === undefined) {
    return { value: 0, wasStripped: false };
  }

  const str = String(val).trim();
  if (str === '') {
    return { value: 0, wasStripped: false };
  }

  // Detect whether currency tokens or accounting formatting existed
  const hadCurrencyCues = CURRENCY_SYMBOLS_REGEX.test(str);
  CURRENCY_SYMBOLS_REGEX.lastIndex = 0; // reset regex state

  // Check accounting negative format: (1,250.00) or ($ 1,250.00) or (PKR 50,000)
  const isAccountingNegative = /^\s*\((.*)\)\s*$/.test(str);

  // 1. Remove currency symbols and word tokens
  let cleaned = str.replace(CURRENCY_SYMBOLS_REGEX, '').trim();

  // 2. Remove accounting parentheses
  if (isAccountingNegative) {
    cleaned = cleaned.replace(/^\(|\)$/g, '').trim();
  }

  // 3. Remove spaces and common thousands separators (commas)
  // Watch out for European format: 1.234,56 where comma is decimal and dot is thousands
  const hasCommaDecimal = /^\d{1,3}(?:\.\d{3})*,\d+$/.test(cleaned) || (!cleaned.includes('.') && /,\d{1,2}$/.test(cleaned));

  if (hasCommaDecimal) {
    // European style: replace dots, replace comma with dot
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
  } else {
    // Standard style: remove commas
    cleaned = cleaned.replace(/,/g, '');
  }

  // 4. Strip any non-numeric characters except leading minus and single decimal point
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');

  let parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    return { value: 0, wasStripped: hadCurrencyCues };
  }

  if (isAccountingNegative && parsed > 0) {
    parsed = -parsed;
  }

  const wasStripped = hadCurrencyCues || isAccountingNegative || str.includes(',') || str.includes(' ');
  return { value: parsed, wasStripped };
}

/**
 * Evaluates whether an unknown value is a numeric or financial value (including currency-formatted numbers)
 */
export function isFinancialOrNumeric(val: unknown): boolean {
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'boolean') return false;
  if (!val) return false;

  const str = String(val).trim();
  if (str === '') return false;

  const { value, wasStripped } = stripCurrencyAndParseFloat(str);
  if (value === 0 && !['0', '0.0', '0.00', '$0', 'PKR 0', '€0', '£0'].includes(str.replace(/\s+/g, ''))) {
    // Verify if it was truly a zero or non-numeric string
    const testClean = str.replace(CURRENCY_SYMBOLS_REGEX, '').replace(/[^0-9]/g, '');
    return testClean.length > 0;
  }

  return true;
}

/**
 * Normalizes a number to force absolute values (Math.abs) for positive KPI totals,
 * financial metrics, and chart values, eliminating negative zeros (-0) or accidental negative signs (-).
 */
export function normalizePositiveNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.abs(val);
  }
  const { value } = stripCurrencyAndParseFloat(val);
  return Math.abs(value);
}

/**
 * Universal Currency & KPI value formatting utility enforcing absolute positive numbers across UI elements.
 */
export function formatPositiveKpi(val: unknown, decimals: number = 0): string {
  const absVal = normalizePositiveNumber(val);
  if (decimals > 0) {
    return absVal.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  return Math.round(absVal).toLocaleString();
}
