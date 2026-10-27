/**
 * DataForge — Dropzone Component
 * Drag-and-drop file upload with CSV validation and click-to-browse.
 */

import { el, icon } from '../utils/dom.js';
import { validateCSVFile } from '../utils/validation.js';

export function createDropzone(container, onFileSelected) {
  const fileInput = el('input', {
    type: 'file',
    accept: '.csv,text/csv',
    className: 'hidden',
    onChange: (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    },
  });

  const uploadIcon = icon([
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5',
    'M12 3v12',
  ], 36);
  uploadIcon.style.color = 'var(--accent-emerald)';
  uploadIcon.style.filter = 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.4))';

  const dropzoneEl = el('div', {
    className: 'card flex flex-col items-center justify-center cursor-pointer p-xl text-center',
    style: {
      borderStyle: 'dashed',
      borderWidth: '2px',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      background: 'rgba(16, 21, 32, 0.6)',
      minHeight: '230px',
      transition: 'all var(--transition-fast)',
      position: 'relative',
    },
    onClick: () => fileInput.click(),
  }, [
    uploadIcon,
    el('div', { className: 'card-title mt-md', style: { color: 'var(--text-primary)' } }, 'Select CSV or Drag to Upload'),
    el('p', { className: 'text-secondary text-small mt-xs mb-sm' }, 'Auto-detects headers, delimiters, types & class imbalance'),
    el('div', { className: 'flex gap-xs mb-md' }, [
      el('span', { className: 'pill pill-dark font-mono', style: { fontSize: '0.68rem' } }, '.CSV'),
      el('span', { className: 'pill pill-dark font-mono', style: { fontSize: '0.68rem' } }, 'UTF-8'),
      el('span', { className: 'pill pill-dark font-mono', style: { fontSize: '0.68rem' } }, 'TAB / COMMA'),
      el('span', { className: 'pill pill-dark font-mono', style: { fontSize: '0.68rem' } }, 'MAX 5MB'),
    ]),
    el('div', { className: 'btn btn-primary btn-sm' }, 'Browse Local Files'),
    fileInput,
  ]);

  // Drag and drop listeners
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.style.borderColor = 'var(--accent-emerald)';
      dropzoneEl.style.background = 'rgba(16, 185, 129, 0.1)';
      dropzoneEl.style.boxShadow = '0 0 24px rgba(16, 185, 129, 0.25)';
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      dropzoneEl.style.background = 'rgba(16, 21, 32, 0.6)';
      dropzoneEl.style.boxShadow = 'none';
    });
  });

  dropzoneEl.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  });

  function handleFile(file) {
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      onFileSelected({ success: false, error: { message: validation.errors.join(', ') } });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onFileSelected({
        success: true,
        file,
        content: event.target.result,
        name: file.name,
      });
    };
    reader.onerror = () => {
      onFileSelected({ success: false, error: { message: 'Failed to read file.' } });
    };
    reader.readAsText(file);
  }

  container.innerHTML = '';
  container.appendChild(dropzoneEl);
}
