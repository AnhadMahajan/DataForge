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
  ], 32);

  const dropzoneEl = el('div', {
    className: 'card flex flex-col items-center justify-center cursor-pointer p-xl text-center',
    style: {
      borderStyle: 'dashed',
      borderWidth: '2px',
      minHeight: '220px',
      transition: 'border-color var(--transition-fast), background var(--transition-fast)',
    },
    onClick: () => fileInput.click(),
  }, [
    uploadIcon,
    el('div', { className: 'card-title mt-md' }, 'Choose a CSV file or drag it here'),
    el('p', { className: 'text-secondary text-small mt-xs mb-md' }, 'Standard comma, semicolon or tab delimited CSV files up to 5MB'),
    el('div', { className: 'btn btn-secondary btn-sm' }, 'Browse computer'),
    fileInput,
  ]);

  // Drag and drop listeners
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.style.borderColor = '#111111';
      dropzoneEl.style.background = 'rgba(0, 0, 0, 0.04)';
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneEl.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneEl.style.borderColor = 'var(--border-light)';
      dropzoneEl.style.background = 'var(--bg-card)';
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
