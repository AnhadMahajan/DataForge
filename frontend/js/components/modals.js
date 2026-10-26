/**
 * DataForge — Modal Dialog Component
 * Clean, accessible modal dialogs with backdrop blur and escape key handling.
 */

import { el, qs, icon } from '../utils/dom.js';

let activeModalOverlay = null;

export function showModal({ title, content, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm = () => {} }) {
  if (activeModalOverlay) {
    activeModalOverlay.remove();
  }

  const closeIcon = icon('M18 6L6 18M6 6l12 12', 16);

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal' });

  const header = el('div', { className: 'modal-header' }, [
    el('h3', { className: 'modal-title' }, title),
    el('button', {
      className: 'btn-ghost btn-icon',
      onClick: closeModal,
    }, [closeIcon]),
  ]);

  const body = el('div', { className: 'modal-body' });
  if (typeof content === 'string') {
    body.textContent = content;
  } else if (content instanceof Node) {
    body.appendChild(content);
  }

  const footer = el('div', { className: 'modal-footer' }, [
    el('button', {
      className: 'btn btn-secondary btn-sm',
      onClick: closeModal,
    }, cancelText),
    el('button', {
      className: 'btn btn-primary btn-sm',
      onClick: () => {
        onConfirm();
        closeModal();
      },
    }, confirmText),
  ]);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);
  activeModalOverlay = overlay;

  // Trigger smooth transition
  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);
}

export function closeModal() {
  if (!activeModalOverlay) return;
  activeModalOverlay.classList.remove('open');
  setTimeout(() => {
    activeModalOverlay?.remove();
    activeModalOverlay = null;
  }, 200);
}
