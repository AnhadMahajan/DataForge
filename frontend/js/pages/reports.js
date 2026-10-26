/**
 * DataForge — Reports Page Controller
 */

import { requireSession } from '../services/auth.js';
import { initSidebar } from '../components/sidebar.js';
import { getReports, getReportById, generateReportFromExperiment, deleteReport } from '../services/reports.js';
import { getExperimentById, getExperiments } from '../services/experiment.js';
import { getDatasetById } from '../services/dataset.js';
import { showModal } from '../components/modals.js';
import { toast } from '../components/toast.js';
import { formatRelativeTime } from '../utils/formatting.js';
import { el, qs, show, hide } from '../utils/dom.js';

const session = requireSession();
if (!session) {
  // redirect handled
}

initSidebar('sidebar');

const userId = session.userId;
const listState = qs('#reports-list-state');
const detailState = qs('#report-detail-state');
const pageTitle = qs('#reports-page-title');
const pageSubtitle = qs('#reports-page-subtitle');
const headerActions = qs('#reports-header-actions');
const tableContainer = qs('#reports-table-container');
const reportsSearch = qs('#reports-search');
const reportsVerdictFilter = qs('#reports-verdict-filter');
const reportsCount = qs('#reports-count');

const docTitle = qs('#doc-title');
const docDate = qs('#doc-date');
const docVerdictPill = qs('#doc-verdict-pill');
const docSectionsContainer = qs('#doc-sections-container');

reportsSearch.addEventListener('input', renderReportsList);
reportsVerdictFilter.addEventListener('change', renderReportsList);

// Check URL query parameters for ?id={experimentId or reportId}
const urlParams = new URLSearchParams(window.location.search);
const queryId = urlParams.get('id');

if (queryId) {
  // Check if it's an existing report ID
  let targetReport = getReportById(userId, queryId);
  if (!targetReport) {
    // Check if it's an experiment ID and compile report on-demand
    const exp = getExperimentById(userId, queryId);
    if (exp && exp.status === 'completed') {
      const ds = getDatasetById(userId, exp.datasetId);
      targetReport = generateReportFromExperiment(userId, exp, ds);
    }
  }

  if (targetReport) {
    renderReportDetail(targetReport);
  } else {
    renderReportsList();
  }
} else {
  renderReportsList();
}

function renderReportsList() {
  show(listState);
  hide(detailState);

  pageTitle.textContent = 'Intelligence Reports';
  pageSubtitle.textContent = 'Synthesized narrative findings and statistical deployment audits.';
  headerActions.innerHTML = '';

  const reports = getReports(userId);
  tableContainer.innerHTML = '';

  const searchTerm = reportsSearch.value.trim().toLowerCase();
  const verdictFilter = reportsVerdictFilter.value;
  const filteredReports = reports.filter(rep => {
    const matchesSearch = !searchTerm || `${rep.title} ${rep.summary}`.toLowerCase().includes(searchTerm);
    return matchesSearch && (verdictFilter === 'all' || rep.verdict === verdictFilter);
  });
  reportsCount.textContent = `${filteredReports.length} ${filteredReports.length === 1 ? 'report' : 'reports'}`;

  if (reports.length === 0) {
    // Check if there are completed experiments to generate from
    const completedExp = getExperiments(userId).filter(e => e.status === 'completed');
    if (completedExp.length > 0) {
      // Auto-compile reports for completed experiments
      completedExp.forEach(exp => {
        const ds = getDatasetById(userId, exp.datasetId);
        generateReportFromExperiment(userId, exp, ds);
      });
      renderReportsList();
      return;
    }

    tableContainer.appendChild(el('div', { className: 'empty-state' }, [
      el('div', { className: 'empty-state-title' }, 'No Reports Available'),
      el('p', { className: 'empty-state-text mb-md' }, 'Run a controlled experiment to compile your first intelligence report.'),
      el('a', { href: 'experiment.html', className: 'btn btn-primary btn-sm' }, 'Run Experiment'),
    ]));
    return;
  }

  if (filteredReports.length === 0) {
    tableContainer.appendChild(el('div', { className: 'empty-state' }, [
      el('div', { className: 'empty-state-title' }, 'No Matching Reports'),
      el('p', { className: 'empty-state-text' }, 'Try a different search term or verdict filter.'),
    ]));
    return;
  }

  filteredReports.forEach((rep, index) => {
    const isRecommended = rep.verdict === 'recommended';
    const isDegraded = rep.verdict === 'not_recommended';
    const pillClass = isRecommended ? 'pill-positive' : (isDegraded ? 'pill-negative' : 'pill-neutral');

    const item = el('div', {
      className: 'report-item',
      onClick: () => renderReportDetail(rep),
    }, [
      el('div', { className: 'report-item-main' }, [
        el('div', { className: 'report-item-index mono' }, String(index + 1).padStart(2, '0')),
        el('div', {}, [
          el('div', { className: 'font-semi text-primary' }, rep.title),
        el('div', { className: 'text-small text-muted mt-xs' }, [
          el('span', {}, formatRelativeTime(rep.generatedAt)),
          el('span', {}, ' • '),
          el('span', {}, rep.summary.slice(0, 75) + '...'),
        ]),
        ]),
      ]),
      el('div', { className: 'flex items-center gap-md' }, [
        el('span', { className: `pill ${pillClass}` }, rep.verdict.toUpperCase()),
        el('button', {
          className: 'btn btn-secondary btn-sm',
          onClick: (e) => {
            e.stopPropagation();
            renderReportDetail(rep);
          },
        }, 'Read Report →'),
      ]),
    ]);
    tableContainer.appendChild(item);
  });
}

function renderReportDetail(rep) {
  hide(listState);
  show(detailState);

  pageTitle.textContent = 'Report View';
  pageSubtitle.textContent = rep.title;

  headerActions.innerHTML = '';
  const btnBack = el('button', {
    className: 'btn btn-secondary btn-sm',
    onClick: () => {
      window.history.pushState({}, '', 'reports.html');
      renderReportsList();
    },
  }, '← Back to Reports');

  const btnPrint = el('button', {
    className: 'btn btn-secondary btn-sm',
    onClick: () => window.print(),
  }, 'Print / PDF');

  const btnDelete = el('button', {
    className: 'btn btn-danger btn-sm',
    onClick: () => {
      showModal({
        title: 'Delete Report',
        content: 'Are you sure you want to permanently delete this report?',
        confirmText: 'Delete',
        onConfirm: () => {
          deleteReport(userId, rep.id);
          toast.success('Report deleted.');
          renderReportsList();
        },
      });
    },
  }, 'Delete');

  headerActions.appendChild(btnBack);
  headerActions.appendChild(btnPrint);
  headerActions.appendChild(btnDelete);

  docTitle.textContent = rep.title;
  docDate.textContent = `Generated on ${new Date(rep.generatedAt).toLocaleString()}`;
  docVerdictPill.textContent = rep.verdict.toUpperCase();

  const isRecommended = rep.verdict === 'recommended';
  const isDegraded = rep.verdict === 'not_recommended';
  docVerdictPill.className = `pill ${isRecommended ? 'pill-positive' : (isDegraded ? 'pill-negative' : 'pill-neutral')}`;

  const detailMeta = el('div', { className: 'report-detail-meta' }, [
    el('span', {}, rep.summary),
    el('span', { className: 'report-detail-id mono' }, `REPORT ${rep.id.slice(0, 8).toUpperCase()}`),
  ]);
  const existingMeta = document.querySelector('#report-document .report-detail-meta');
  existingMeta?.remove();
  docTitle.closest('.flex').after(detailMeta);

  docSectionsContainer.innerHTML = '';
  (rep.sections || []).forEach(sec => {
    const block = el('div', { className: 'report-section-block' }, [
      el('h2', { className: 'report-section-heading' }, sec.heading),
      el('div', { className: 'report-section-text' }, sec.content),
    ]);
    docSectionsContainer.appendChild(block);
  });
}
