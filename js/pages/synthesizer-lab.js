/**
 * DataForge — Synthesizer Lab Page Controller
 * Orchestrates the UI for the Synthesizer Lab:
 * dataset selection, algorithm config, synthesis execution, and results rendering.
 */

import { initSidebar } from '../components/sidebar.js';
import { getCurrentUser } from '../services/auth.js';
import { getDatasets } from '../services/dataset.js';
import { synthesizeDataset } from '../services/synthesizer.js';
import { correlationMatrix } from '../utils/linalg.js';
import { generateCSV } from '../utils/csv.js';
import { renderDataTable } from '../components/tables.js';
import {
  renderDistributionComparison,
  renderCorrelationHeatmap,
  renderQualityGauge,
} from '../components/charts.js';
import { showToast } from '../components/toast.js';

// ---- State ----
let datasets = [];
let selectedDataset = null;
let lastResult = null;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  initSidebar('synthesizer-lab');
  loadDatasets(user.id);
  initAlgorithmPicker();
  initRowSlider();
  initForm();
});

// ---- Load Datasets ----
function loadDatasets(userId) {
  const select = document.getElementById('dataset-select');
  datasets = getDatasets(userId) || [];

  select.innerHTML = '<option value="">— Select a dataset —</option>';
  datasets.forEach(ds => {
    const opt = document.createElement('option');
    opt.value = ds.id;
    opt.textContent = `${ds.name} (${ds.rowCount} rows, ${ds.headers?.length || 0} cols)`;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const dsId = select.value;
    selectedDataset = datasets.find(d => d.id === dsId) || null;
    renderDatasetSummary();
  });
}

function renderDatasetSummary() {
  const box = document.getElementById('dataset-summary');
  if (!selectedDataset) {
    box.classList.add('hidden');
    return;
  }

  const analysis = selectedDataset.analysisResult || {};
  const numericCount = analysis.numericIndices?.length || 0;
  const catCount = analysis.categoricalIndices?.length || 0;

  box.innerHTML = `
    <strong>${selectedDataset.name}</strong> — 
    ${selectedDataset.rowCount} rows × ${selectedDataset.headers?.length || 0} columns 
    (${numericCount} numeric, ${catCount} categorical)
    ${analysis.imbalanceSeverity && analysis.imbalanceSeverity !== 'none'
      ? ` · Class imbalance: <strong>${analysis.imbalanceSeverity}</strong> (${analysis.imbalanceRatio}:1)`
      : ''}
  `;
  box.classList.remove('hidden');
}

// ---- Algorithm Picker ----
function initAlgorithmPicker() {
  const grid = document.getElementById('algo-grid');
  const cards = grid.querySelectorAll('.synth-algo-card');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      // Update visual selection
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // Update radio
      const radio = card.querySelector('input[type="radio"]');
      radio.checked = true;

      // Show/hide parameter panels
      const algo = card.dataset.algo;
      document.querySelectorAll('.synth-params-panel').forEach(p => p.classList.add('hidden'));
      const panel = document.getElementById(`params-${algo}`);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

// ---- Logarithmic Row Slider ----
function initRowSlider() {
  const slider = document.getElementById('row-count-slider');
  const display = document.getElementById('row-count-display');

  function updateDisplay() {
    // Logarithmic scale: 10^1 to 10^3.7 (≈5000)
    const value = Math.round(Math.pow(10, parseFloat(slider.value)));
    const clamped = Math.min(5000, Math.max(10, value));
    display.textContent = clamped.toLocaleString();
  }

  slider.addEventListener('input', updateDisplay);
  updateDisplay();
}

function getRowCount() {
  const slider = document.getElementById('row-count-slider');
  return Math.min(5000, Math.max(10, Math.round(Math.pow(10, parseFloat(slider.value)))));
}

// ---- Get Algorithm Parameters ----
function getAlgorithmParams() {
  const algo = document.querySelector('input[name="algorithm"]:checked')?.value || 'copula';

  switch (algo) {
    case 'copula':
      return {
        correlationMethod: document.getElementById('copula-corr-method')?.value || 'pearson',
      };
    case 'bayesian_network':
      return {
        maxParents: parseInt(document.getElementById('bn-max-parents')?.value) || 3,
        significanceThreshold: parseFloat(document.getElementById('bn-threshold')?.value) || 0.01,
      };
    case 'kde':
      return {
        bandwidthMultiplier: parseFloat(document.getElementById('kde-bandwidth')?.value) || 1.0,
      };
    case 'vae':
      return {
        latentDim: parseInt(document.getElementById('vae-latent')?.value) || 4,
        epochs: parseInt(document.getElementById('vae-epochs')?.value) || 50,
        learningRate: 0.01,
      };
    default:
      return {};
  }
}

// ---- Form Submission ----
function initForm() {
  const form = document.getElementById('synth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await runSynthesis();
  });
}

async function runSynthesis() {
  if (!selectedDataset) {
    showToast('Please select a dataset first.', 'error');
    return;
  }

  const algo = document.querySelector('input[name="algorithm"]:checked')?.value || 'copula';
  const rowCount = getRowCount();
  const seed = parseInt(document.getElementById('synth-seed')?.value) || 42;
  const params = getAlgorithmParams();

  const btn = document.getElementById('generate-btn');
  const btnText = document.getElementById('generate-btn-text');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  // Disable button and show progress
  btn.disabled = true;
  btnText.textContent = 'Synthesizing...';
  progressContainer.classList.remove('hidden');

  const { headers, fullData, analysisResult } = selectedDataset;
  const targetIndex = headers.indexOf(selectedDataset.targetColumn);

  // Extract data rows (excluding target column for synthesis)
  const numericIndices = [];
  const categoricalIndices = [];

  headers.forEach((_, idx) => {
    const col = selectedDataset.columns[idx];
    const isId = analysisResult?.idIndices?.includes(idx);
    if (isId) return; // Skip ID columns
    if (col.type === 'numeric') numericIndices.push(idx);
    else categoricalIndices.push(idx);
  });

  try {
    const result = await synthesizeDataset({
      data: fullData,
      headers,
      numericIndices,
      categoricalIndices,
      algorithm: algo,
      rowCount,
      algorithmParams: params,
      seed,
      onProgress: (stage, pct) => {
        progressBar.style.setProperty('--progress', `${pct}%`);
        progressText.textContent = stage;
      },
    });

    lastResult = result;
    renderResults(result);
    showToast(`Generated ${result.syntheticData.length} synthetic rows via ${algo.toUpperCase()}.`, 'success');
  } catch (err) {
    console.error('[SynthLab] Synthesis failed:', err);
    showToast(`Synthesis failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = '⚗️ Generate Synthetic Dataset';
    progressContainer.classList.add('hidden');
  }
}

// ---- Render Results ----
function renderResults(result) {
  const section = document.getElementById('results-section');
  section.classList.remove('hidden');

  renderQualityReport(result.qualityReport);
  renderCorrelationComparison(result);
  renderDistributionCharts(result);
  renderPreviewTable(result);
  renderMetadata(result.metadata);
  initDownload(result);

  // Scroll to results
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderQualityReport(quality) {
  const corrScore = Math.round((quality.correlationFidelity || 0) * 100);
  const distScore = Math.round((quality.distributionFidelity || 0) * 100);
  const divScore = quality.diversityScore || 0;
  // Invert redundancy: lower is better → higher gauge score
  const redScore = Math.max(0, 100 - (quality.redundancyScore || 0));

  renderQualityGauge(document.getElementById('gauge-correlation'), corrScore, {
    label: 'Correlation', size: 130, thresholds: [50, 80],
  });
  renderQualityGauge(document.getElementById('gauge-distribution'), distScore, {
    label: 'Distribution', size: 130, thresholds: [50, 80],
  });
  renderQualityGauge(document.getElementById('gauge-diversity'), divScore, {
    label: 'Diversity', size: 130, thresholds: [30, 60],
  });
  renderQualityGauge(document.getElementById('gauge-redundancy'), redScore, {
    label: 'Uniqueness', size: 130, thresholds: [50, 80],
  });

  // Summary text
  const summaryEl = document.getElementById('quality-summary');
  const overall = Math.round((corrScore + distScore + divScore + redScore) / 4);
  let verdict = 'Poor';
  let verdictClass = 'text-negative';
  if (overall >= 75) { verdict = 'Excellent'; verdictClass = 'text-positive'; }
  else if (overall >= 55) { verdict = 'Good'; verdictClass = 'text-neutral'; }
  else if (overall >= 35) { verdict = 'Moderate'; verdictClass = 'text-caution'; }

  summaryEl.innerHTML = `
    Overall synthesis quality: <strong class="${verdictClass}">${verdict} (${overall}/100)</strong><br>
    <span class="text-secondary">
      Correlation fidelity: ${corrScore}% · 
      Distribution fidelity: ${distScore}% · 
      Diversity: ${divScore}/100 · 
      Uniqueness: ${redScore}% (${quality.redundancyScore}% near-duplicates)
    </span>
  `;
}

function renderCorrelationComparison(result) {
  if (!selectedDataset || selectedDataset.analysisResult?.numericIndices?.length < 2) {
    document.getElementById('corr-original').innerHTML = '<div class="text-secondary text-small">Need ≥2 numeric columns for correlation.</div>';
    document.getElementById('corr-synthetic').innerHTML = '';
    return;
  }

  const headers = selectedDataset.headers;
  const numIdx = result.metadata.correlationMatrix
    ? selectedDataset.analysisResult.numericIndices
    : selectedDataset.analysisResult.numericIndices;

  const origCorr = correlationMatrix(selectedDataset.fullData, numIdx, headers);
  const synthCorr = correlationMatrix(result.syntheticData, numIdx, headers);

  renderCorrelationHeatmap(document.getElementById('corr-original'), origCorr.labels, origCorr.matrix, {
    title: '',
  });
  renderCorrelationHeatmap(document.getElementById('corr-synthetic'), synthCorr.labels, synthCorr.matrix, {
    title: '',
  });
}

function renderDistributionCharts(result) {
  const container = document.getElementById('dist-charts');
  container.innerHTML = '';

  const headers = selectedDataset.headers;
  const numIndices = selectedDataset.analysisResult?.numericIndices || [];

  // Show distribution comparison for each numeric column (max 8)
  const displayIndices = numIndices.slice(0, 8);
  displayIndices.forEach(idx => {
    const wrapper = document.createElement('div');
    const origVals = selectedDataset.fullData.map(r => Number(r[idx])).filter(v => !isNaN(v));
    const synthVals = result.syntheticData.map(r => Number(r[idx])).filter(v => !isNaN(v));

    renderDistributionComparison(wrapper, origVals, synthVals, {
      title: headers[idx] || `Column ${idx}`,
      height: 180,
    });
    container.appendChild(wrapper);
  });

  if (displayIndices.length === 0) {
    container.innerHTML = '<div class="text-secondary text-small">No numeric columns to compare.</div>';
  }
}

function renderPreviewTable(result) {
  const container = document.getElementById('preview-table');
  const headers = result.syntheticHeaders;
  const previewRows = result.syntheticData.slice(0, 50);

  renderDataTable(container, headers, previewRows, {
    maxRows: 50,
    compact: true,
  });
}

function renderMetadata(metadata) {
  const grid = document.getElementById('metadata-grid');
  const items = [
    { label: 'Algorithm', value: metadata.algorithm?.toUpperCase() || '—' },
    { label: 'Rows Generated', value: metadata.rowCount?.toLocaleString() || '—' },
    { label: 'Original Rows', value: metadata.originalRowCount?.toLocaleString() || '—' },
    { label: 'Generation Time', value: `${metadata.generationTime || 0}s` },
    { label: 'Random Seed', value: metadata.seed || '—' },
    { label: 'Fallback Used', value: metadata.fallback ? 'Yes (Copula)' : 'No' },
  ];

  grid.innerHTML = items.map(item => `
    <div class="meta-item">
      <div class="meta-label">${item.label}</div>
      <div class="meta-value">${item.value}</div>
    </div>
  `).join('');
}

// ---- CSV Download ----
function initDownload(result) {
  const btn = document.getElementById('download-csv-btn');
  btn.onclick = () => {
    if (!result) return;
    const csv = generateCSV(result.syntheticHeaders, result.syntheticData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthetic_${selectedDataset?.name || 'data'}_${result.metadata.algorithm}_${result.metadata.rowCount}rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded successfully.', 'success');
  };
}
