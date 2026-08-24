/**
 * DataForge — Canvas Charts Component
 * Zero-dependency, lightweight canvas charts with monochrome/muted palettes.
 */

import { el } from '../utils/dom.js';

const CHART_COLORS = {
  baseline: '#333333',
  positive: '#1a8a5c',
  negative: '#c43e3e',
  neutral:  '#b08a2e',
  blue:     '#4a7fb5',
  gray:     '#888888',
  teal:     '#2a9d8f',
  grid:     'rgba(0, 0, 0, 0.06)',
  text:     '#888888',
};

/**
 * Render a simple Bar Chart.
 * data = [{ label: 'Low', value: 196, color?: string }]
 */
export function renderBarChart(container, data, options = {}) {
  const { height = 220, title = '' } = options;
  const canvas = el('canvas', { height });
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  canvas.style.display = 'block';

  container.innerHTML = '';
  if (title) {
    container.appendChild(el('div', { className: 'card-title mb-md text-small font-semi' }, title));
  }
  container.appendChild(canvas);

  // Setup HiDPI Canvas
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 320;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padding = { top: 20, right: 20, bottom: 40, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1) * 1.15;
  const barCount = data.length;
  const barW = Math.min(48, (chartW / barCount) * 0.6);
  const gap = chartW / barCount;

  // Draw grid lines
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillStyle = CHART_COLORS.text;
  ctx.textAlign = 'right';

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = (maxVal / gridSteps) * i;
    const y = padding.top + chartH - (i / gridSteps) * chartH;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();

    ctx.fillText(Math.round(val), padding.left - 8, y + 4);
  }

  // Draw Bars
  data.forEach((item, idx) => {
    const x = padding.left + idx * gap + (gap - barW) / 2;
    const barH = (item.value / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    ctx.fillStyle = item.color || CHART_COLORS.baseline;
    
    // Draw rounded top bar
    const radius = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + barH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, y + barH);
    ctx.closePath();
    ctx.fill();

    // Value label on top
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0a0a';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(String(item.value), x + barW / 2, y - 6);

    // X-Axis label
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(item.label, x + barW / 2, padding.top + chartH + 20);
  });

  return canvas;
}

/**
 * Render a Grouped Comparison Bar Chart (Baseline vs Strategy 1, Strategy 2).
 * series = [
 *   { name: 'Baseline', values: [0.72, 0.65, 0.68], color: '#333333' },
 *   { name: 'SMOTE', values: [0.84, 0.81, 0.82], color: '#1a8a5c' }
 * ]
 * labels = ['Accuracy', 'Precision', 'F1']
 */
export function renderGroupedBarChart(container, labels, series, options = {}) {
  const { height = 240, title = '' } = options;
  const canvas = el('canvas', { height });
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;

  container.innerHTML = '';
  if (title) {
    container.appendChild(el('div', { className: 'card-title mb-md text-small font-semi' }, title));
  }
  container.appendChild(canvas);

  const rect = canvas.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 400;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padding = { top: 30, right: 20, bottom: 45, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Max value is always 1.0 (or 100%) for metric scores
  const maxVal = 1.0;
  const groupCount = labels.length;
  const groupGap = chartW / groupCount;
  const barCount = series.length;
  const barW = Math.min(24, (groupGap * 0.7) / barCount);
  const totalBarWidth = barW * barCount;

  // Grid lines
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillStyle = CHART_COLORS.text;
  ctx.textAlign = 'right';

  [0, 0.25, 0.5, 0.75, 1.0].forEach(val => {
    const y = padding.top + chartH - val * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    ctx.fillText(`${(val * 100).toFixed(0)}%`, padding.left - 6, y + 3);
  });

  // Groups and bars
  labels.forEach((label, gIdx) => {
    const groupX = padding.left + gIdx * groupGap + (groupGap - totalBarWidth) / 2;

    series.forEach((s, sIdx) => {
      const val = s.values[gIdx] || 0;
      const x = groupX + sIdx * barW;
      const barH = val * chartH;
      const y = padding.top + chartH - barH;

      ctx.fillStyle = s.color || CHART_COLORS.baseline;
      ctx.fillRect(x, y, barW - 2, barH);

      // Label on bar top
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0a0a0a';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${(val * 100).toFixed(1)}%`, x + (barW - 2) / 2, y - 5);
    });

    // Group Label
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, padding.left + gIdx * groupGap + groupGap / 2, padding.top + chartH + 20);
  });

  // Legend at top
  let legendX = padding.left;
  series.forEach(s => {
    ctx.fillStyle = s.color || CHART_COLORS.baseline;
    ctx.fillRect(legendX, 10, 10, 10);
    ctx.fillStyle = '#333333';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.name, legendX + 14, 19);
    legendX += ctx.measureText(s.name).width + 30;
  });

  return canvas;
}

/**
 * Render a Line Chart (for run variance tracking across evaluation seeds).
 * runs = [ { run: 1, baseline: 0.71, augmented: 0.83 }, ... ]
 */
export function renderRunVarianceChart(container, runs, options = {}) {
  const { height = 220, title = 'Per-Run Performance Variance' } = options;
  const canvas = el('canvas', { height });
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;

  container.innerHTML = '';
  if (title) {
    container.appendChild(el('div', { className: 'card-title mb-md text-small font-semi' }, title));
  }
  container.appendChild(canvas);

  const rect = canvas.getBoundingClientRect();
  const width = rect.width || container.clientWidth || 380;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padding = { top: 30, right: 25, bottom: 35, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Grid lines
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillStyle = CHART_COLORS.text;
  ctx.textAlign = 'right';

  [0.5, 0.65, 0.8, 1.0].forEach(val => {
    const y = padding.top + chartH - ((val - 0.5) / 0.5) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    ctx.fillText(`${(val * 100).toFixed(0)}%`, padding.left - 6, y + 3);
  });

  const stepX = runs.length > 1 ? chartW / (runs.length - 1) : chartW / 2;

  // Draw Baseline line (dark gray dashed)
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  runs.forEach((r, idx) => {
    const x = padding.left + idx * stepX;
    const y = padding.top + chartH - ((r.baseline - 0.5) / 0.5) * chartH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Augmented line (emerald solid)
  ctx.strokeStyle = CHART_COLORS.positive;
  ctx.lineWidth = 2;
  ctx.beginPath();
  runs.forEach((r, idx) => {
    const x = padding.left + idx * stepX;
    const y = padding.top + chartH - ((r.augmented - 0.5) / 0.5) * chartH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw dots and X labels
  runs.forEach((r, idx) => {
    const x = padding.left + idx * stepX;
    const yAug = padding.top + chartH - ((r.augmented - 0.5) / 0.5) * chartH;
    const yBase = padding.top + chartH - ((r.baseline - 0.5) / 0.5) * chartH;

    // Base point
    ctx.fillStyle = '#555555';
    ctx.beginPath();
    ctx.arc(x, yBase, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Aug point
    ctx.fillStyle = CHART_COLORS.positive;
    ctx.beginPath();
    ctx.arc(x, yAug, 4, 0, Math.PI * 2);
    ctx.fill();

    // X Axis Label
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`R${r.run || idx + 1}`, x, padding.top + chartH + 18);
  });

  return canvas;
}

/**
 * Render a Pearson Correlation Matrix Heatmap
 * @param {HTMLElement} container - DOM container element
 * @param {string[]} features - Array of feature names
 * @param {number[][]} matrix - 2D square matrix of correlation coefficients (-1 to 1)
 * @param {Object} options - Custom options (height, title, cellSize)
 */
export function renderCorrelationHeatmap(container, features, matrix, options = {}) {
  const n = features.length;
  if (!n || !matrix || matrix.length !== n) {
    container.innerHTML = '<div class="text-small text-muted p-md text-center">Insufficient numeric features for correlation heatmap.</div>';
    return;
  }

  container.innerHTML = '';
  const { title = '' } = options;
  if (title) {
    container.appendChild(el('div', { className: 'card-title mb-md text-small font-semi' }, title));
  }

  const wrapper = el('div', { className: 'heatmap-wrapper overflow-x-auto' });
  container.appendChild(wrapper);

  const cellSize = Math.max(38, Math.min(64, Math.floor(400 / n)));
  const labelMarginLeft = 120;
  const labelMarginTop = 80;
  const totalW = labelMarginLeft + n * cellSize + 20;
  const totalH = labelMarginTop + n * cellSize + 20;

  const canvas = el('canvas', {});
  canvas.style.width = `${totalW}px`;
  canvas.style.height = `${totalH}px`;
  canvas.style.display = 'block';
  wrapper.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
  ctx.fillRect(0, 0, totalW, totalH);

  // Render Top Labels (rotated 45deg)
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = '#444444';
  features.forEach((feat, col) => {
    const x = labelMarginLeft + col * cellSize + cellSize / 2;
    const y = labelMarginTop - 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'left';
    const truncated = feat.length > 12 ? feat.substring(0, 10) + '..' : feat;
    ctx.fillText(truncated, 0, 0);
    ctx.restore();
  });

  // Render Left Labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  features.forEach((feat, row) => {
    const x = labelMarginLeft - 10;
    const y = labelMarginTop + row * cellSize + cellSize / 2;
    const truncated = feat.length > 14 ? feat.substring(0, 12) + '..' : feat;
    ctx.fillText(truncated, x, y);
  });

  // Render Cells
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const val = matrix[r][c];
      const cellX = labelMarginLeft + c * cellSize;
      const cellY = labelMarginTop + r * cellSize;

      // Determine cell fill color based on correlation value
      let fillCol;
      let textCol = '#ffffff';

      if (r === c) {
        fillCol = '#222222';
      } else if (val >= 0) {
        const alpha = Math.min(0.9, Math.max(0.08, val * 0.9));
        fillCol = `rgba(26, 138, 92, ${alpha.toFixed(2)})`;
        if (alpha < 0.45) textCol = '#222222';
      } else {
        const alpha = Math.min(0.9, Math.max(0.08, Math.abs(val) * 0.9));
        fillCol = `rgba(196, 62, 62, ${alpha.toFixed(2)})`;
        if (alpha < 0.45) textCol = '#222222';
      }

      ctx.fillStyle = fillCol;
      ctx.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);

      // Cell border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);

      // Cell text
      ctx.fillStyle = textCol;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const formatted = (val >= 0 ? '+' : '') + val.toFixed(2);
      ctx.fillText(formatted, cellX + cellSize / 2, cellY + cellSize / 2);
    }
  }

  // Legend at bottom
  const legendY = labelMarginTop + n * cellSize + 15;
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'left';
  ctx.fillText('Emerald: Positive Correlation (+)  |  Burgundy: Negative Correlation (-)  |  Range: -1.00 to +1.00', labelMarginLeft, legendY);

  return canvas;
}

