/**
 * DataForge — Command Palette Component
 * Global keyboard launcher (Cmd+K / Ctrl+K / "/") for rapid navigation & workflow triggers.
 */

import { el, icon, qs } from '../utils/dom.js';
import { logout } from '../services/auth.js';

const COMMANDS = [
  {
    id: 'nav-dash',
    title: 'Go to Workspace Dashboard',
    category: 'Navigation',
    icon: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
    action: () => { window.location.href = 'dashboard.html'; },
  },
  {
    id: 'nav-upload',
    title: 'Upload Dataset (CSV)',
    category: 'Datasets',
    icon: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
    action: () => { window.location.href = 'upload.html'; },
  },
  {
    id: 'nav-exp',
    title: 'Configure New Controlled Experiment',
    category: 'Lab',
    icon: [{ tag: 'path', d: 'M9 3h6v6l4 7H5l4-7V3z' }, { tag: 'path', d: 'M5 16h14' }],
    action: () => { window.location.href = 'experiment.html'; },
  },
  {
    id: 'nav-synth',
    title: 'Synthesizer Lab (Copula, BN, KDE, VAE)',
    category: 'Generative',
    icon: [{ tag: 'path', d: 'M10 2v7.31L4.41 18.2A2 2 0 0 0 6.06 21h11.88a2 2 0 0 0 1.65-2.8L14 9.31V2' }, { tag: 'line', x1: '7', y1: '15', x2: '17', y2: '15' }],
    action: () => { window.location.href = 'synthesizer-lab.html'; },
  },
  {
    id: 'nav-results',
    title: 'View Latest Evaluation Matrix',
    category: 'Results',
    icon: ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
    action: () => { window.location.href = 'results.html'; },
  },
  {
    id: 'nav-reports',
    title: 'Browse Intelligence Reports',
    category: 'Reports',
    icon: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
    action: () => { window.location.href = 'reports.html'; },
  },
  {
    id: 'nav-settings',
    title: 'Workspace Settings & Profile',
    category: 'System',
    icon: [{ tag: 'circle', cx: '12', cy: '12', r: '3' }],
    action: () => { window.location.href = 'settings.html'; },
  },
  {
    id: 'action-logout',
    title: 'Log Out of Workspace',
    category: 'Session',
    icon: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
    action: () => { logout(); },
  },
];

let paletteContainer = null;
let activeIndex = 0;
let filteredCommands = [...COMMANDS];

export function initCommandPalette() {
  if (qs('#cmd-palette-backdrop')) return;

  const backdrop = el('div', {
    className: 'cmd-palette-backdrop',
    id: 'cmd-palette-backdrop',
    onClick: (e) => {
      if (e.target === backdrop) closeCommandPalette();
    },
  });

  const modal = el('div', { className: 'cmd-palette-modal' });

  // Search Bar
  const searchIcon = el('svg', {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
  }, [
    el('circle', { cx: '11', cy: '11', r: '8' }),
    el('path', { d: 'm21 21-4.3-4.3' }),
  ]);

  const input = el('input', {
    type: 'text',
    className: 'cmd-palette-input',
    placeholder: 'Type a command or jump to page...',
    id: 'cmd-palette-input',
    autocomplete: 'off',
    onInput: (e) => {
      const q = e.target.value.toLowerCase().trim();
      filteredCommands = COMMANDS.filter(cmd => 
        cmd.title.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
      );
      activeIndex = 0;
      renderList();
    },
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % (filteredCommands.length || 1);
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + filteredCommands.length) % (filteredCommands.length || 1);
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[activeIndex]) {
          const act = filteredCommands[activeIndex].action;
          closeCommandPalette();
          act();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
      }
    },
  });

  const badge = el('span', { className: 'cmd-palette-shortcut-badge' }, 'ESC');

  const searchBar = el('div', { className: 'cmd-palette-search-bar' }, [
    searchIcon,
    input,
    badge,
  ]);

  const listContainer = el('div', { className: 'cmd-palette-list', id: 'cmd-palette-list' });

  const footer = el('div', { className: 'cmd-palette-footer' }, [
    el('span', {}, 'Navigation: ↑ / ↓  |  Select: Enter  |  Exit: Esc'),
    el('span', { className: 'font-mono' }, 'DataForge Engine'),
  ]);

  modal.appendChild(searchBar);
  modal.appendChild(listContainer);
  modal.appendChild(footer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  paletteContainer = backdrop;

  function renderList() {
    listContainer.innerHTML = '';
    if (filteredCommands.length === 0) {
      listContainer.appendChild(el('div', { className: 'p-md text-small text-muted text-center' }, 'No matching commands found.'));
      return;
    }

    filteredCommands.forEach((cmd, idx) => {
      const item = el('div', {
        className: `cmd-palette-item${idx === activeIndex ? ' active' : ''}`,
        onClick: () => {
          closeCommandPalette();
          cmd.action();
        },
        onMouseEnter: () => {
          activeIndex = idx;
          renderList();
        },
      }, [
        el('div', { className: 'cmd-palette-item-left' }, [
          icon(cmd.icon, 16),
          el('span', { className: 'font-medium text-small' }, cmd.title),
        ]),
        el('span', { className: 'text-caption text-muted font-mono' }, cmd.category),
      ]);
      listContainer.appendChild(item);
    });

    const activeEl = listContainer.children[activeIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  // Global keydown listeners
  window.addEventListener('keydown', (e) => {
    // Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }
    // "/" trigger when not inside form field
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      openCommandPalette();
      return;
    }
  });

  renderList();
}

export function openCommandPalette() {
  if (!paletteContainer) initCommandPalette();
  filteredCommands = [...COMMANDS];
  activeIndex = 0;
  paletteContainer?.classList.add('open');
  const input = qs('#cmd-palette-input');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

export function closeCommandPalette() {
  paletteContainer?.classList.remove('open');
}

export function toggleCommandPalette() {
  if (paletteContainer?.classList.contains('open')) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}
