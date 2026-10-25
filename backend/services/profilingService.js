/**
 * DataForge — Automated Schema Profiling Service
 * Architecture: MVC Service Layer (Assigned to: Person 3 / Dataset Ingestion & Profiling)
 *
 * Infers column data types for raw tabular data (headers + 2D row matrix)
 * and produces per-column quality profiles.
 */

// Tokens treated as missing values (compared case-insensitively after trimming)
const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', 'nil', 'undefined', '?', '#n/a']);

// A column is classified as numeric/datetime when at least this share of its
// non-missing values parse as that type. Non-conforming values are treated as missing.
const TYPE_INFERENCE_THRESHOLD = 0.95;

const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const THOUSANDS_RE = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/;

// ISO-8601 date / datetime: 2024-01-31, 2024-01-31T10:20:30Z, 2024-01-31 10:20, 2024/01/31
const ISO_DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;
// Day/month-first numeric dates: 31/01/2024, 01-31-2024, 31.01.2024 (optional HH:mm[:ss])
const DMY_DATE_RE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
// Textual month dates (year required): "Jan 31 2024", "January 31, 2024", "31 Jan 2024"
const MONTH_NAME = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const TEXT_DATE_RE = new RegExp(
  `^(?:${MONTH_NAME}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+${MONTH_NAME},?\\s+\\d{4})$`,
  'i'
);

/**
 * Whether a raw cell value should be considered missing.
 */
export function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'string') return MISSING_TOKENS.has(value.trim().toLowerCase());
  return false;
}

/**
 * Parse a raw cell into a finite number, or null if it is not numeric.
 */
export function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const s = value.trim();
  if (NUMERIC_RE.test(s)) return Number(s);
  if (THOUSANDS_RE.test(s)) return Number(s.replace(/,/g, ''));
  return null;
}

/**
 * Parse a raw cell into a Date, or null if it does not look like a date.
 * Plain numbers are intentionally NOT treated as dates (avoids "2024" / epoch ambiguity).
 * Values without an explicit timezone are interpreted as UTC for deterministic results.
 */
export function parseDatetime(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;

  const s = value.trim();
  if (!s) return null;

  const iso = ISO_DATE_RE.exec(s);
  if (iso) {
    const [, y, mo, d, hh = '0', mi = '0', ss = '0', frac = '', tz] = iso;
    const pad = (x) => String(x).padStart(2, '0');
    let zone = 'Z';
    if (tz && tz.toUpperCase() !== 'Z') {
      zone = tz.includes(':') ? tz : `${tz.slice(0, 3)}:${tz.slice(3)}`;
    }
    const date = new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mi)}:${pad(ss)}${frac}${zone}`);
    if (Number.isNaN(date.getTime())) return null;
    // Reject roll-over dates such as 2024-02-31 (compare in UTC only when no offset was given)
    if (zone === 'Z' && date.getUTCMonth() !== Number(mo) - 1) return null;
    return date;
  }

  if (TEXT_DATE_RE.test(s)) {
    const d = new Date(`${s} UTC`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = DMY_DATE_RE.exec(s);
  if (m) {
    const [, a, b, y, hh = '0', mi = '0', ss = '0'] = m;
    // Prefer day-first unless that is impossible (e.g. 01/31/2024 is clearly month-first)
    let day = Number(a);
    let month = Number(b);
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const d = new Date(Date.UTC(Number(y), month - 1, day, Number(hh), Number(mi), Number(ss)));
    // Reject roll-over dates such as 31/02/2024
    if (d.getUTCMonth() !== month - 1) return null;
    return d;
  }

  return null;
}

/**
 * Infer the data type of a column from its raw values.
 * @param {Array<*>} values - raw column values (may include missing tokens)
 * @returns {'numeric'|'categorical'|'datetime'}
 */
export function inferColumnType(values) {
  let present = 0;
  let numeric = 0;
  let datetime = 0;

  for (const v of values) {
    if (isMissing(v)) continue;
    present++;
    if (parseNumeric(v) !== null) numeric++;
    else if (parseDatetime(v) !== null) datetime++;
  }

  if (present === 0) return 'categorical';
  if (numeric / present >= TYPE_INFERENCE_THRESHOLD) return 'numeric';
  if (datetime / present >= TYPE_INFERENCE_THRESHOLD) return 'datetime';
  return 'categorical';
}

/**
 * Coerce a raw cell into its typed representation for the given column type.
 * Missing / non-conforming values become null.
 *  - numeric     -> Number
 *  - datetime    -> ISO-8601 string
 *  - categorical -> trimmed String
 */
export function coerceValue(value, dataType) {
  if (isMissing(value)) return null;

  switch (dataType) {
    case 'numeric':
      return parseNumeric(value);
    case 'datetime': {
      const d = parseDatetime(value);
      return d ? d.toISOString() : null;
    }
    default:
      return typeof value === 'string' ? value.trim() : String(value);
  }
}

const round = (x, digits = 4) => (x === null || !Number.isFinite(x) ? null : Number(x.toFixed(digits)));

// Cap on distinct categories reported in classBalance (remaining ones are aggregated)
export const MAX_CLASS_BALANCE_CATEGORIES = 50;
export const OTHER_CATEGORY_LABEL = '__other__';

/**
 * Summary statistics for a numeric sample.
 *  - std:      sample standard deviation (n - 1 denominator)
 *  - skewness: adjusted Fisher-Pearson coefficient G1 (same as pandas.Series.skew)
 * @param {number[]} nums - finite numbers
 */
export function computeNumericStats(nums) {
  const n = nums.length;
  if (n === 0) {
    return { min: null, max: null, mean: null, std: null, skewness: null };
  }

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const x of nums) {
    if (x < min) min = x;
    if (x > max) max = x;
    sum += x;
  }
  const mean = sum / n;

  // Constant column: avoid floating-point noise producing spurious std / skew
  if (min === max) {
    return { min, max, mean: min, std: 0, skewness: n >= 3 ? 0 : null };
  }

  // Second pass for central moments (numerically stabler than single-pass sums)
  let m2 = 0;
  let m3 = 0;
  for (const x of nums) {
    const d = x - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
  }

  const std = n > 1 ? Math.sqrt(m2 / (n - 1)) : 0;

  let skewness = null;
  if (n >= 3) {
    const popVar = m2 / n;
    const g1 = m3 / n / Math.pow(popVar, 1.5);
    skewness = (Math.sqrt(n * (n - 1)) / (n - 2)) * g1;
  }

  return {
    min: round(min, 6),
    max: round(max, 6),
    mean: round(mean, 6),
    std: round(std, 6),
    skewness: round(skewness, 6),
  };
}

/**
 * Category frequency counts, sorted by descending count.
 * Categories beyond MAX_CLASS_BALANCE_CATEGORIES are aggregated into OTHER_CATEGORY_LABEL.
 * @param {string[]} values - non-null categorical values
 * @returns {Array<{ value: string, count: number, pct: number }>}
 */
export function computeClassBalance(values, maxCategories = MAX_CLASS_BALANCE_CATEGORIES) {
  const total = values.length;
  if (total === 0) return [];

  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  const top = sorted.slice(0, maxCategories);
  const restCount = sorted.slice(maxCategories).reduce((acc, [, c]) => acc + c, 0);

  const balance = top.map(([value, count]) => ({
    value: String(value),
    count,
    pct: round((count / total) * 100, 2),
  }));

  if (restCount > 0) {
    balance.push({
      value: OTHER_CATEGORY_LABEL,
      count: restCount,
      pct: round((restCount / total) * 100, 2),
    });
  }

  return balance;
}

/**
 * Profile raw tabular data.
 * Infers column types, then computes missing-value rates, unique counts,
 * numeric statistics (min, max, mean, std, skewness) and categorical class balance.
 * For datetime columns, min/max are epoch milliseconds.
 *
 * @param {string[]} headers - column names
 * @param {Array<Array<*>>} rows - row-major 2D matrix aligned with headers
 * @returns {{ rowCount: number, columnCount: number, columns: object[], summary: object }}
 */
export function profileRawData(headers, rows) {
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    throw new Error('profileRawData expects a headers array and a 2D rows array');
  }

  const rowCount = rows.length;

  const columns = headers.map((name, colIdx) => {
    const rawValues = rows.map((row) => (Array.isArray(row) ? row[colIdx] : undefined));
    const dataType = inferColumnType(rawValues);

    let nullCount = 0;
    const uniques = new Set();
    const present = [];

    for (const raw of rawValues) {
      const v = coerceValue(raw, dataType);
      if (v === null) {
        nullCount++;
        continue;
      }
      uniques.add(v);
      present.push(v);
    }

    const profile = {
      name: String(name),
      dataType,
      nullCount,
      missingPct: rowCount ? round((nullCount / rowCount) * 100, 2) : 0,
      uniqueCount: uniques.size,
      min: null,
      max: null,
      mean: null,
      std: null,
      skewness: null,
      classBalance: null,
    };

    if (dataType === 'numeric') {
      Object.assign(profile, computeNumericStats(present));
    } else if (dataType === 'datetime') {
      // Manual loop: Math.min(...arr) overflows the call stack on large columns
      for (const iso of present) {
        const t = Date.parse(iso);
        if (profile.min === null || t < profile.min) profile.min = t;
        if (profile.max === null || t > profile.max) profile.max = t;
      }
    } else {
      profile.classBalance = computeClassBalance(present);
    }

    return profile;
  });

  const totalCells = rowCount * headers.length;
  const totalMissing = columns.reduce((acc, c) => acc + c.nullCount, 0);

  return {
    rowCount,
    columnCount: headers.length,
    columns,
    summary: {
      numericColumns: columns.filter((c) => c.dataType === 'numeric').length,
      categoricalColumns: columns.filter((c) => c.dataType === 'categorical').length,
      datetimeColumns: columns.filter((c) => c.dataType === 'datetime').length,
      totalCells,
      totalMissing,
      missingPct: totalCells ? round((totalMissing / totalCells) * 100, 2) : 0,
    },
  };
}

/**
 * Convert a raw row matrix into typed values using an existing column profile
 * (numbers for numeric columns, ISO strings for datetimes, null for missing).
 */
export function coerceRows(rows, columns) {
  return rows.map((row) =>
    columns.map((col, i) => coerceValue(Array.isArray(row) ? row[i] : undefined, col.dataType))
  );
}

export default {
  isMissing,
  parseNumeric,
  parseDatetime,
  inferColumnType,
  coerceValue,
  computeNumericStats,
  computeClassBalance,
  profileRawData,
  coerceRows,
};
