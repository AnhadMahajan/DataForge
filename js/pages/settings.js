/**
 * DataForge — Settings Page Controller
 */

import { requireSession, getCurrentUser, updateProfile, changePassword, getPreferences, updatePreferences } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getStorageUsage, exportAll, importAll, clearAll } from '../services/storage.js';
import { showModal } from '../components/modals.js';
import { toast } from '../components/toast.js';
import { qs, qsa, show, hide } from '../utils/dom.js';

const session = requireSession();
if (!session) {
  // redirect handled
}

initSidebar('sidebar');

const user = getCurrentUser();
const navBtns = qsa('.settings-nav-btn');
const tabs = {
  profile: qs('#tab-profile'),
  preferences: qs('#tab-preferences'),
  storage: qs('#tab-storage'),
  about: qs('#tab-about'),
};

// Tab switching
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
  profileNameInput.value = user.name || '';
  profileEmailInput.value = user.email || '';
}

profileForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const res = updateProfile({ name: profileNameInput.value.trim() });
  if (res.success) {
    toast.success('Profile updated.');
    // Refresh sidebar name
    const sidebarName = qs('.sidebar-user-name');
    if (sidebarName) sidebarName.textContent = profileNameInput.value.trim();
  } else {
    toast.error('Failed to update profile.');
  }
});

// Password Form
const passwordForm = qs('#password-form');
const currentPwdInput = qs('#current-pwd');
const newPwdInput = qs('#new-pwd');

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (newPwdInput.value.length < 8) {
    toast.error('New password must be at least 8 characters.');
    return;
  }

  const res = await changePassword(currentPwdInput.value, newPwdInput.value);
  if (res.success) {
    toast.success('Password changed successfully.');
    currentPwdInput.value = '';
    newPwdInput.value = '';
  } else {
    toast.error(res.error.message || 'Failed to update password.');
  }
});

// Preferences Form
const prefForm = qs('#preferences-form');
const prefRunsSelect = qs('#pref-runs');
const prefSplitSelect = qs('#pref-split');
const prefModelSelect = qs('#pref-model');

const currentPrefs = getPreferences() || {};
if (currentPrefs.defaultEvaluationRuns) prefRunsSelect.value = String(currentPrefs.defaultEvaluationRuns);
if (currentPrefs.defaultTrainTestSplit) prefSplitSelect.value = String(currentPrefs.defaultTrainTestSplit);
if (currentPrefs.defaultModel) prefModelSelect.value = currentPrefs.defaultModel;

prefForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const res = updatePreferences({
    defaultEvaluationRuns: Number(prefRunsSelect.value),
    defaultTrainTestSplit: Number(prefSplitSelect.value),
    defaultModel: prefModelSelect.value,
  });
  if (res.success) {
    toast.success('Preferences saved.');
  } else {
    toast.error('Failed to save preferences.');
  }
});

// Storage Management
function updateStorageStats() {
  const usage = getStorageUsage();
  const usageText = qs('#storage-usage-text');
  usageText.textContent = `DataForge is utilizing ${usage.dataforgeMB} MB of localStorage quota across ${usage.keyCount} stored records.`;
}

// Export Data
qs('#btn-export-data').addEventListener('click', () => {
  const data = exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dataforge_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Data exported as JSON.');
});

// Import Data
qs('#input-import-data').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      const res = importAll(data);
      if (res.success) {
        toast.success('Backup imported successfully. Refreshing workspace...');
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error('Failed to import backup data.');
      }
    } catch {
      toast.error('Invalid JSON file format.');
    }
  };
  reader.readAsText(file);
});

// Clear Workspace
qs('#btn-clear-data').addEventListener('click', () => {
  showModal({
    title: 'Wipe Workspace Data',
    content: 'This will permanently delete all uploaded datasets, experiments, reports, and preferences. You will need to log in again. Proceed?',
    confirmText: 'Wipe Everything',
    onConfirm: () => {
      clearAll();
      toast.info('Workspace wiped. Redirecting to login...');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 700);
    },
  });
});
