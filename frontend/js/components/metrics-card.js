/**
 * DataForge — Metrics Card Component
 * Minimalist glass/dark cards with bold typography and count-up easing.
 */

import { el } from '../utils/dom.js';

export function createMetricsCard({ label, value, delta = null, isDark = true, subtitle = null, id = null }) {
  const card = el('div', {
    className: isDark ? 'card-dark' : 'card',
    id: id || '',
  });

  const body = el('div', { className: 'card-body' });
  
  if (subtitle) {
    body.appendChild(el('div', { className: 'text-caption mb-xs', style: { opacity: 0.7 } }, subtitle));
  }

  const valueEl = el('div', { className: 'metric-value' }, String(value));
  body.appendChild(valueEl);

  const labelEl = el('div', { className: 'metric-label' }, label);
  body.appendChild(labelEl);

  if (delta) {
    const deltaEl = el('div', {
      className: `pill ${delta.className} mt-sm`,
      style: { alignSelf: 'flex-start' },
    }, delta.text);
    body.appendChild(deltaEl);
  }

  card.appendChild(body);
  return card;
}
