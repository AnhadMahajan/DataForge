/**
 * DataForge — Enhanced Settings Page Controller
 */

import { requireSession, getCurrentUser, updateProfile, changePassword, getPreferences, updatePreferences } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getStorageUsage, exportAll, importAll, clearAll } from '../services/storage.js';
import { getDatasets } from '../services/dataset.js';
import { getExperiments } from '../services/experiment.js';
import { getReports } from '../services/reports.js';
import { showModal } from '../components/modals.js';
import { toast } from '../components/toast.js';
import { qs, qsa, show, hide } from '../utils/dom.js';

const session = requireSession();
if (!session) {
  // redirect handled
}

initSidebar('sidebar');

const user = getCurrentUser();
const userId = session?.userId || user?.id;

// Profile Banner Elements
const avatarBadge = qs('#user-avatar-badge');
const bannerName = qs('#user-banner-name');
const bannerEmail = qs('#user-banner-email');

if (user) {
  const name = user.name || 'Researcher';
  const email = user.email || 'user@dataforge.ai';
  if (bannerName) bannerName.textContent = name;
  if (bannerEmail) bannerEmail.textContent = email;
  if (avatarBadge) {
    avatarBadge.textContent = name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}

// Tab Switching
const navBtns = qsa('.settings-nav-btn');
const tabs = {
  profile: qs('#tab-profile'),
  preferences: qs('#tab-preferences'),
  storage: qs('#tab-storage'),
  about: qs('#tab-about'),
};

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tabName = btn.dataset.tab;

    Object.entries(tabs).forEach(([k, pane]) => {
      if (k === tabName) show(pane);
      else hide(pane);
    });

    if (tabName === 'storage') updateStorageStats();
  });
});

// Profile Form
const profileForm = qs('#profile-form');
const profileNameInput = qs('#profile-name');
const profileEmailInput = qs('#profile-email');

if (user) {
  if (profileNameInput) profileNameInput.value = user.name || '';
  if (profileEmailInput) profileEmailInput.value = user.email || '';
}

if (profileForm) {
  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = profileNameInput.value.trim();
    if (!newName) {
      toast.error('Name cannot be empty.');
      return;
    }

    const res = updateProfile({ name: newName });
    if (res.success) {
      toast.success('Researcher profile updated.');
      if (bannerName) bannerName.textContent = newName;
      if (avatarBadge) {
        avatarBadge.textContent = newName
          .split(' ')
          .map(w => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
      }
      // Refresh sidebar name
      const sidebarName = qs('.sidebar-user-name');
      if (sidebarName) sidebarName.textContent = newName;
    } else {
      toast.error('Failed to update profile.');
    }
  });
}

// Password Form
const passwordForm = qs('#password-form');
const currentPwdInput = qs('#current-pwd');
const newPwdInput = qs('#new-pwd');

if (passwordForm) {
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (newPwdInput.value.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }

    const res = await changePassword(currentPwdInput.value, newPwdInput.value);
    if (res.success) {
      toast.success('Password updated successfully.');
      currentPwdInput.value = '';
      newPwdInput.value = '';
    } else {
      toast.error(res.error.message || 'Failed to update password.');
    }
  });
}

// Preferences Form
const prefForm = qs('#preferences-form');
const prefRunsSelect = qs('#pref-runs');
const prefSplitSelect = qs('#pref-split');
const prefModelSelect = qs('#pref-model');

const currentPrefs = getPreferences() || {};
if (prefRunsSelect && currentPrefs.defaultEvaluationRuns) prefRunsSelect.value = String(currentPrefs.defaultEvaluationRuns);
if (prefSplitSelect && currentPrefs.defaultTrainTestSplit) prefSplitSelect.value = String(currentPrefs.defaultTrainTestSplit);
if (prefModelSelect && currentPrefs.defaultModel) prefModelSelect.value = currentPrefs.defaultModel;

if (prefForm) {
  prefForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = updatePreferences({
      defaultEvaluationRuns: Number(prefRunsSelect.value),
      defaultTrainTestSplit: Number(prefSplitSelect.value),
      defaultModel: prefModelSelect.value,
    });
    if (res.success) {
      toast.success('Evaluation preferences saved.');
    } else {
      toast.error('Failed to save preferences.');
    }
  });
}

// Storage Management & Counts
function updateStorageStats() {
  const usage = getStorageUsage();
  const usageText = qs('#storage-usage-text');
  const barFill = qs('#storage-bar-fill');
  
  const bytes = usage.dataForgeBytes || usage.usedBytes || 0;
  const pct = Math.min(100, Math.max(2, Math.round((bytes / (5 * 1024 * 1024)) * 100)));
  if (usageText) usageText.textContent = `${usage.dataforgeMB} MB / 5.00 MB (${pct}% of quota)`;
  if (barFill) barFill.style.width = `${pct}%`;

  // Item counts
  const datasets = getDatasets(userId);
  const experiments = getExperiments(userId);
  const reports = getReports(userId);

  const dsCountEl = qs('#stat-count-datasets');
  const expCountEl = qs('#stat-count-experiments');
  const repCountEl = qs('#stat-count-reports');
  const keyCountEl = qs('#stat-count-keys');

  if (dsCountEl) dsCountEl.textContent = String(datasets.length);
  if (expCountEl) expCountEl.textContent = String(experiments.length);
  if (repCountEl) repCountEl.textContent = String(reports.length);
  if (keyCountEl) keyCountEl.textContent = String(usage.keyCount);
}

// Initial Storage Calculation
updateStorageStats();

// Export Data
const btnExport = qs('#btn-export-data');
if (btnExport) {
  btnExport.addEventListener('click', () => {
    const data = exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataforge_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Complete workspace manifest exported.');
  });
}

// Import Data
const inputImport = qs('#input-import-data');
if (inputImport) {
  inputImport.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const res = importAll(data);
        if (res.success) {
          toast.success('Workspace imported successfully. Refreshing...');
          setTimeout(() => window.location.reload(), 700);
        } else {
          toast.error('Failed to import backup data.');
        }
      } catch {
        toast.error('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  });
}

// Clear Workspace
const btnClear = qs('#btn-clear-data');
if (btnClear) {
  btnClear.addEventListener('click', () => {
    showModal({
      title: 'Wipe All Local Workspace Data?',
      content: 'This will permanently delete all datasets, historical experiment runs, compiled reports, and user preferences from your browser. This action cannot be undone.',
      confirmText: 'Yes, Wipe Workspace',
      onConfirm: () => {
        clearAll();
        toast.info('Workspace wiped. Redirecting to login...');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 600);
      },
    });
  });
}