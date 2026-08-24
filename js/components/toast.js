/**
 * DataForge — Toast Notification Component
 * Slide-in notifications for success, error, and info messages.
 */

import { el, qs, icon } from '../utils/dom.js';

const TOAST_DURATION = 4000; // Auto-dismiss after 4 seconds
let container = null;

// Icon paths
const ICONS = {
  success: { tag: 'path', d: 'M20 6L9 17l-5-5' },
  error: [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'line', x1: '15', y1: '9', x2: '9', y2: '15' },
    { tag: 'line', x1: '9', y1: '9', x2: '15', y2: '15' },
  ],
  info: [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'line', x1: '12', y1: '16', x2: '12', y2: '12' },
    { tag: 'line', x1: '12', y1: '8', x2: '12.01', y2: '8' },
  ],
  close: 'M18 6L6 18M6 6l12 12',
};

function ensureContainer() {
  if (!container || !document.body.contains(container)) {
    container = el('div', { className: 'toast-container', id: 'toast-container' });
    document.body.appendChild(container);
  }
  return container;
}

function createToast(type, title, message) {
  const toastContainer = ensureContainer();

  const toastEl = el('div', { className: `toast toast-${type}` }, [
    el('div', { className: 'toast-icon' }, [
      icon(ICONS[type] || ICONS.info, 18),
    ]),
    el('div', { className: 'toast-content' }, [
      el('div', { className: 'toast-title' }, title),
      message ? el('div', { className: 'toast-message' }, message) : null,
    ]),
    el('button', {
      className: 'toast-close',
      onClick: () => dismissToast(toastEl),
    }, [
      icon(ICONS.close, 14),
    ]),
  ]);

  toastContainer.appendChild(toastEl);

  // Auto-dismiss
  const timer = setTimeout(() => {
    dismissToast(toastEl);
  }, TOAST_DURATION);

  // Store timer for manual dismiss cleanup
  toastEl._timer = timer;

  return toastEl;
}

function dismissToast(toastEl) {
  if (!toastEl || !toastEl.parentNode) return;

  clearTimeout(toastEl._timer);
  toastEl.classList.add('toast-exit');

  toastEl.addEventListener('animationend', () => {
    toastEl.remove();
  }, { once: true });
}

// ---- Public API ----

export const toast = {
  success(message, title = 'Success') {
    return createToast('success', title, message);
  },

  error(message, title = 'Error') {
    return createToast('error', title, message);
  },

  info(message, title = 'Info') {
    return createToast('info', title, message);
  },
};

export function showToast(message, type = 'info', title = '') {
  if (type === 'success') return toast.success(message, title || 'Success');
  if (type === 'error') return toast.error(message, title || 'Error');
  return toast.info(message, title || 'Info');
}

