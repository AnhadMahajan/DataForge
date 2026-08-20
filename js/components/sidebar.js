/**
 * DataForge — Sidebar Component
 * Renders the persistent navigation sidebar on all authenticated pages.
 */

import { el, icon, qs } from '../utils/dom.js';
import { getCurrentUser, logout } from '../services/auth.js';

// ---- Lucide-style SVG icon paths ----
const ICONS = {
  dashboard: [
    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M9 22V12h6v10',
  ],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5',
    'M12 3v12',
  ],
  experiment: [
    { tag: 'path', d: 'M9 3h6v6l4 7H5l4-7V3z' },
    { tag: 'line', x1: '9', y1: '3', x2: '15', y2: '3' },
    { tag: 'path', d: 'M5 16h14' },
  ],
  results: [
    'M18 20V10',
    'M12 20V4',
    'M6 20v-6',
  ],
  reports: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  settings: [
    { tag: 'circle', cx: '12', cy: '12', r: '3' },
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  logout: [
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    'M16 17l5-5-5-5',
    'M21 12H9',
  ],
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard' },
  { id: 'upload', label: 'Upload', href: 'upload.html', icon: 'upload' },
  { id: 'experiment', label: 'Experiments', href: 'experiment.html', icon: 'experiment' },
  { id: 'results', label: 'Results', href: 'results.html', icon: 'results' },
  { id: 'reports', label: 'Reports', href: 'reports.html', icon: 'reports' },
];

const BOTTOM_ITEMS = [
  { id: 'settings', label: 'Settings', href: 'settings.html', icon: 'settings' },
];

/**
 * Initialize the sidebar into the target container.
 * Detects the current page and highlights the active nav item.
 */
export function initSidebar(containerId = 'sidebar') {
  const container = qs(`#${containerId}`) || document.body;
  const user = getCurrentUser();
  const currentPage = getCurrentPage();

  const sidebar = el('aside', { className: 'sidebar', id: 'app-sidebar' }, [
    // Header
    el('div', { className: 'sidebar-header' }, [
      el('div', { className: 'sidebar-logo' }, [
        document.createTextNode('Data'),
        el('span', {}, 'Forge'),
      ]),
    ]),

    // Navigation
    el('nav', { className: 'sidebar-nav' }, [
      el('div', { className: 'sidebar-section-label' }, 'Main'),
      ...NAV_ITEMS.map(item => createNavItem(item, currentPage)),
      el('div', { className: 'sidebar-section-label mt-lg' }, 'System'),
      ...BOTTOM_ITEMS.map(item => createNavItem(item, currentPage)),
    ]),

    // Footer
    el('div', { className: 'sidebar-footer' }, [
      el('div', { className: 'sidebar-user' }, [
        el('div', { className: 'sidebar-user-avatar' }, getInitials(user?.name || 'U')),
        el('div', { className: 'sidebar-user-info' }, [
          el('div', { className: 'sidebar-user-name' }, user?.name || 'User'),
          el('div', { className: 'sidebar-user-email' }, user?.email || ''),
        ]),
      ]),
      el('button', {
        className: 'nav-item mt-sm w-full',
        onClick: () => {
          logout();
        },
      }, [
        icon(ICONS.logout, 18),
        el('span', {}, 'Log Out'),
      ]),
    ]),
  ]);

  // If container is body, prepend the sidebar
  if (containerId === 'sidebar' && qs('#sidebar')) {
    qs('#sidebar').replaceWith(sidebar);
  } else {
    // Insert as first child of body for app shell
    const wrapper = qs('.app-shell');
    if (wrapper) {
      wrapper.prepend(sidebar);
    } else {
      document.body.prepend(sidebar);
    }
  }

  return sidebar;
}

function createNavItem(item, currentPage) {
  const isActive = currentPage === item.id;
  return el('a', {
    className: `nav-item${isActive ? ' active' : ''}`,
    href: item.href,
    id: `nav-${item.id}`,
  }, [
    icon(ICONS[item.icon], 18),
    el('span', {}, item.label),
  ]);
}

function getCurrentPage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'dashboard.html';

  if (filename.includes('dashboard')) return 'dashboard';
  if (filename.includes('upload')) return 'upload';
  if (filename.includes('experiment')) return 'experiment';
  if (filename.includes('results')) return 'results';
  if (filename.includes('reports')) return 'reports';
  if (filename.includes('settings')) return 'settings';
  return 'dashboard';
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
