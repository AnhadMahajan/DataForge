/**
 * DataForge — Data Table Component
 * Sortable, paginated, clean monochrome preview tables.
 */

import { el } from '../utils/dom.js';

export function renderDataTable(container, headers, rows, options = {}) {
  const { pageSize = 10, emptyMessage = 'No data available.' } = options;
  let currentPage = 1;
  let sortCol = null;
  let sortAsc = true;
  let currentRows = [...rows];

  function sortData(colIdx) {
    if (sortCol === colIdx) {
      sortAsc = !sortAsc;
    } else {
      sortCol = colIdx;
      sortAsc = true;
    }

    currentRows.sort((a, b) => {
      const vA = a[colIdx];
      const vB = b[colIdx];
      if (vA === vB) return 0;
      if (vA === null || vA === undefined) return 1;
      if (vB === null || vB === undefined) return -1;
      if (typeof vA === 'number' && typeof vB === 'number') {
        return sortAsc ? vA - vB : vB - vA;
      }
      return sortAsc ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
    });

    render();
  }

  function render() {
    container.innerHTML = '';
    if (rows.length === 0) {
      container.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-state-text' }, emptyMessage),
      ]));
      return;
    }

    const totalPages = Math.ceil(currentRows.length / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const pageRows = currentRows.slice(startIdx, startIdx + pageSize);

    // Table Container
    const tableWrapper = el('div', { className: 'table-responsive' });
    const table = el('table', { className: 'data-table' });

    // Head
    const thead = el('thead');
    const headerRow = el('tr');
    headers.forEach((h, idx) => {
      const isSorted = sortCol === idx;
      const arrow = isSorted ? (sortAsc ? ' ↑' : ' ↓') : '';
      const th = el('th', {
        className: 'cursor-pointer',
        style: { userSelect: 'none' },
        onClick: () => sortData(idx),
      }, `${h}${arrow}`);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = el('tbody');
    pageRows.forEach((row, pageRowIdx) => {
      const origIdx = currentRows.indexOf(row);
      const tr = el('tr', {
        className: options.onRowClick ? 'cursor-pointer' : '',
        onClick: options.onRowClick ? () => options.onRowClick(origIdx) : null,
      });

      row.forEach(cell => {
        const isNum = typeof cell === 'number';
        const td = el('td', { className: isNum ? 'mono' : '' });

        if (cell === null || cell === undefined) {
          td.textContent = '—';
        } else if (typeof cell === 'string' && cell.trim().startsWith('<') && cell.includes('>')) {
          td.innerHTML = cell;
        } else if (cell instanceof HTMLElement) {
          td.appendChild(cell);
        } else {
          td.textContent = String(cell);
        }

        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    // Pagination controls
    if (totalPages > 1) {
      const pagination = el('div', { className: 'flex items-center justify-between mt-md pt-sm flex-wrap gap-xs' }, [
        el('div', { className: 'text-small text-muted' }, `Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, currentRows.length)} of ${currentRows.length} rows`),
        el('div', { className: 'flex items-center gap-xs' }, [
          el('button', {
            className: 'btn btn-secondary btn-sm',
            disabled: currentPage === 1,
            onClick: () => { currentPage--; render(); },
          }, 'Prev'),
          el('span', { className: 'text-small font-mono px-sm' }, `${currentPage} / ${totalPages}`),
          el('button', {
            className: 'btn btn-secondary btn-sm',
            disabled: currentPage === totalPages,
            onClick: () => { currentPage++; render(); },
          }, 'Next'),
        ]),
      ]);
      container.appendChild(pagination);
    }
  }

  render();
}
