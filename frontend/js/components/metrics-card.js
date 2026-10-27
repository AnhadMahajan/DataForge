/**
 * DataForge — Metrics Card Component
 * High-density mission-control cards with monospace metrics, technical bracket labels,
 * and illuminated emerald/cyan telemetry borders.
 */

import { el } from '../utils/dom.js';

export function createMetricsCard({ label, value, delta = null, isDark = true, subtitle = null, id = null, codeTag = null }) {
  const card = el('div', {
    className: isDark ? 'card-dark metric-hud-tile' : 'card metric-hud-tile',
    id: id || '',
  });

  const body = el('div', { className: 'card-body', style: { position: 'relative' } });
  
  // Technical sub-header / codeTag (e.g. [SYSTEM_TELEMETRY])
  const tagText = codeTag || (subtitle ? subtitle : `[${label.toUpperCase().replace(/\s+/g, '_')}]`);
  const tagEl = el('div', {
    className: 'text-caption font-mono mb-xs',
    style: {
      color: 'var(--text-muted)',
      fontSize: '0.68rem',
      letterSpacing: '0.08em',
      opacity: '0.85',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, [
    el('span', {}, tagText),
    delta ? el('span', {
      className: `pill ${delta.className}`,
      style: { fontSize: '0.65rem', padding: '1px 6px' }
    }, delta.text) : null,
  ].filter(Boolean));
  body.appendChild(tagEl);

  const valueEl = el('div', {
    className: 'metric-value font-mono',
    style: {
      fontSize: '2.1rem',
      fontWeight: '700',
      letterSpacing: '-0.03em',
      color: 'var(--text-primary)',
      lineHeight: '1.1',
      margin: '0.2rem 0'
    }
  }, String(value));
  body.appendChild(valueEl);

  const labelEl = el('div', {
    className: 'metric-label',
    style: {
      fontSize: '0.78rem',
      color: 'var(--text-secondary)',
      fontWeight: '500',
      marginTop: '0.25rem'
    }
  }, label);
  body.appendChild(labelEl);

  card.appendChild(body);
  return card;
}
