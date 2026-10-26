/**
 * DataForge — Skeleton Loading Component
 * Reusable shimmering placeholder templates.
 */

import { el } from '../utils/dom.js';

export function renderCardSkeleton(container, count = 1) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = el('div', { className: 'card skeleton-card flex flex-col justify-between' }, [
      el('div', {}, [
        el('div', { className: 'skeleton skeleton-heading' }),
        el('div', { className: 'skeleton skeleton-text' }),
        el('div', { className: 'skeleton skeleton-text-short' }),
      ]),
      el('div', { className: 'skeleton', style: { height: '24px', width: '90px' } }),
    ]);
    container.appendChild(card);
  }
}

export function renderMetricsSkeleton(container, count = 4) {
  container.innerHTML = '';
  const row = el('div', { className: 'stats-row' });
  for (let i = 0; i < count; i++) {
    const card = el('div', { className: 'card-dark p-lg' }, [
      el('div', { className: 'skeleton skeleton-metric' }),
      el('div', { className: 'skeleton skeleton-text-short', style: { width: '80px' } }),
    ]);
    row.appendChild(card);
  }
  container.appendChild(row);
}
