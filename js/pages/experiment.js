/**
 * DataForge — Experiment Lab Page Controller
 */

import { requireSession } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getDatasets, getDatasetById } from '../services/dataset.js';
import { runExperiment } from '../services/experiment.js';
import { toast } from '../components/toast.js';
import { qs, show, hide } from '../utils/dom.js';

const session = requireSession();
if (!session) {
  // redirect handled
}

initSidebar('sidebar');

const userId = session.userId;
const form = qs('#experiment-form');
const expNameInput = qs('#exp-name');
const datasetSelect = qs('#dataset-select');
const datasetSummaryBox = qs('#dataset-summary-box');
const evalRunsSelect = qs('#eval-runs');
const splitRatioSelect = qs('#split-ratio');
const modelTypeSelect = qs('#model-type');

const progressOverlay = qs('#progress-overlay');
const progressStatus = qs('#progress-status');
const progressBarFill = qs('#progress-bar-fill');

// Strategy card elements
const strategyCards = {
  smote: qs('#card-smote'),
  adasyn: qs('#card-adasyn'),
  smote_tomek: qs('#card-tomek'),
  oversampling: qs('#card-oversampling'),
  noise_injection: qs('#card-noise'),
};

const strategyChecks = {
  smote: qs('#check-smote'),
  adasyn: qs('#check-adasyn'),
  smote_tomek: qs('#check-tomek'),
  oversampling: qs('#check-oversampling'),
  noise_injection: qs('#check-noise'),
};

// Toggle strategy selection on card click
Object.entries(strategyCards).forEach(([strat, card]) => {
  if (!card) return;
  const checkbox = strategyChecks[strat];
  card.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
    if (e.target !== checkbox && checkbox) {
      checkbox.checked = !checkbox.checked;
    }
    if (checkbox) card.classList.toggle('selected', checkbox.checked);
  });
});

// Populate datasets dropdown
const datasets = getDatasets(userId);
if (datasets.length === 0) {
  datasetSelect.innerHTML = '<option value="">No datasets available — upload one first</option>';
  datasetSelect.disabled = true;
} else {
  datasetSelect.innerHTML = datasets.map(d => `<option value="${d.id}">${d.name} (${d.rowCount} rows)</option>`).join('');
}

// Check for pre-selected dataset in URL
const urlParams = new URLSearchParams(window.location.search);
const datasetIdParam = urlParams.get('datasetId');
if (datasetIdParam && getDatasetById(userId, datasetIdParam)) {
  datasetSelect.value = datasetIdParam;
}

function updateDatasetPreview() {
  const dsId = datasetSelect.value;
  const ds = getDatasetById(userId, dsId);
  if (ds) {
    expNameInput.value = `${ds.name}_Augmentation_Study`;
    datasetSummaryBox.innerHTML = `
      <strong>${ds.name}</strong> • ${ds.rowCount} rows • ${ds.columnCount - 1} features • Target: <code>${ds.targetColumn}</code>
      <br><span class="text-caption">Health Score: ${ds.healthScore}/100 • Imbalance: ${ds.analysisResult?.imbalanceRatio || 1}:1</span>
    `;
    show(datasetSummaryBox);
  } else {
    hide(datasetSummaryBox);
  }
}

datasetSelect.addEventListener('change', updateDatasetPreview);
if (datasets.length > 0) updateDatasetPreview();

// Form Submit Handler
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const datasetId = datasetSelect.value;
  if (!datasetId) {
    toast.error('Please select an uploaded dataset.');
    return;
  }

  const dataset = getDatasetById(userId, datasetId);
  if (!dataset) {
    toast.error('Selected dataset not found.');
    return;
  }

  // Collect selected strategies
  const selectedStrategies = [];
  if (strategyChecks.smote?.checked) selectedStrategies.push('smote');
  if (strategyChecks.adasyn?.checked) selectedStrategies.push('adasyn');
  if (strategyChecks.smote_tomek?.checked) selectedStrategies.push('smote_tomek');
  if (strategyChecks.oversampling?.checked) selectedStrategies.push('oversampling');
  if (strategyChecks.noise_injection?.checked) selectedStrategies.push('noise_injection');

  if (selectedStrategies.length === 0) {
    toast.error('Please select at least one augmentation strategy to test.');
    return;
  }

  const strategyParams = {
    smote: { k: Number(qs('#smote-k')?.value || 5) },
    adasyn: { k: Number(qs('#adasyn-k')?.value || 5) },
    smote_tomek: { k: Number(qs('#smote-k')?.value || 5) },
    oversampling: { jitterStd: Number(qs('#oversampling-jitter')?.value || 5) / 100 },
    noise_injection: { noiseFactor: Number(qs('#noise-factor')?.value || 8) / 100 },
  };

  // Show progress modal
  progressOverlay.classList.add('active');
  progressBarFill.style.width = '5%';
  progressStatus.textContent = 'Preparing model pipeline...';

  // Small timeout to allow overlay animation
  await new Promise(r => setTimeout(r, 100));

  const result = await runExperiment({
    userId,
    dataset,
    name: expNameInput.value.trim() || `${dataset.name}_Experiment`,
    strategies: selectedStrategies,
    strategyParams,
    runs: Number(evalRunsSelect.value),
    trainTestSplit: Number(splitRatioSelect.value),
    modelType: modelTypeSelect.value,
    baseSeed: 42,
    onProgress: (msg, pct) => {
      progressStatus.textContent = msg;
      progressBarFill.style.width = `${pct}%`;
    },
  });

  if (result.success) {
    toast.success('Experiment completed.');
    setTimeout(() => {
      window.location.href = `results.html?id=${result.data.id}`;
    }, 600);
  } else {
    progressOverlay.classList.remove('active');
    toast.error(result.error.message || 'Experiment execution failed.');
  }
});
