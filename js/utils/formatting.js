/**
 * DataForge — Formatting Utilities
 * Numbers, dates, file sizes, metric deltas
 */

/**
 * Format a number to a fixed number of decimal places.
 */
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return Number(value).toFixed(decimals);
}

/**
 * Format a number as a percentage.
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return (Number(value) * 100).toFixed(decimals) + '%';
}

/**
 * Format a number that's already a percentage (0-100).
 */
export function formatPercentRaw(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return Number(value).toFixed(decimals) + '%';
}

/**
 * Format a number with compact notation (1.2K, 3.5M, etc.).
 */
export function formatCompact(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

/**
 * Format a metric delta with sign and optional color class.
 * Returns { text: '+2.3%', className: 'delta-positive' }
 */
export function formatDelta(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return { text: '—', className: 'delta-neutral' };
  }
  const num = Number(value);
  const sign = num > 0 ? '+' : '';
  const text = sign + num.toFixed(decimals) + '%';

  let className = 'delta-neutral';
  if (num > 0.5) className = 'delta-positive';
  else if (num < -0.5) className = 'delta-negative';

  return { text, className };
}

/**
 * Format bytes into human-readable file size.
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

/**
 * Format an ISO timestamp to a readable date string.
 */
export function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format an ISO timestamp to a readable date+time string.
 */
export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a timestamp as relative time ("2 hours ago", "just now", etc.).
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(isoString);
}

/**
 * Format a dataset dimension (e.g., "500 × 8").
 */
export function formatDimensions(rows, cols) {
  return `${formatCompact(rows)} × ${cols}`;
}

/**
 * Format an experiment status into a display label.
 */
export function formatStatus(status) {
  const labels = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[status] || status;
}

/**
 * Format a verdict into a display label.
 */
export function formatVerdict(verdict) {
  const labels = {
    recommended: 'Augmentation Recommended',
    not_recommended: 'Augmentation Not Recommended',
    inconclusive: 'Inconclusive',
  };
  return labels[verdict] || verdict;
}

/**
 * Truncate a string to maxLength and add ellipsis.
 */
export function truncate(str, maxLength = 30) {
  if (!str || str.length <= maxLength) return str || '';
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a strategy type into a readable label.
 */
export function formatStrategy(type) {
  const labels = {
    smote: 'SMOTE',
    adasyn: 'ADASYN',
    smote_tomek: 'SMOTE-Tomek',
    oversampling: 'Random Oversampling',
    noise_injection: 'Noise Injection',
    combined: 'Combined Strategy',
  };
  return labels[type] || type;
}
