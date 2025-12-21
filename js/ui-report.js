import {
  reportExportBtn,
  reportTable,
  reportCount,
  reportAvg,
  reportSourceSelect,
  reportMetricSelect,
  reportLimitInput,
  reportRunBtn,
  vizSelect,
} from './dom.js';
import { state } from './state.js';
import { loadGrid, loadRoads, setTopGridIds, setTopRoadIds } from './map.js';
import { computeGridMetrics, computeRoadMetrics, loadRoadsData } from './data.js';

const metricLabels = {
  traffic: '交通量',
  population: '人口',
  floor: '床面積',
  ratio_0_14: '年齢構成（0-15）',
  ratio_15_64: '年齢構成（15-65）',
  ratio_65_over: '年齢構成（65以上）',
  score: '必要度スコア',
};

function formatValue(metric, value) {
  if (metric.startsWith('ratio_')) {
    return `${Number(value || 0).toFixed(1)}%`;
  }
  if (metric === 'score') {
    return Number(value || 0).toFixed(1);
  }
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : '-';
}

function renderReport(rows, metric) {
  const tbody = reportTable.querySelector('tbody');
  tbody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.className = 'placeholder';
    tr.innerHTML = '<td colspan="4">データがありません。</td>';
    tbody.appendChild(tr);
    return;
  }

  let sumValue = 0;
  rows.forEach((row, index) => {
    sumValue += row.value || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.id}</td>
      <td>${metricLabels[metric] || metric}</td>
      <td>${formatValue(metric, row.value)}</td>
    `;
    tbody.appendChild(tr);
  });

  reportCount.textContent = rows.length;
  reportAvg.textContent = rows.length ? (sumValue / rows.length).toFixed(1) : '-';
}

function exportReportCSV() {
  const rows = Array.from(reportTable.querySelectorAll('tbody tr'))
    .filter((tr) => !tr.classList.contains('placeholder'))
    .map((tr) => Array.from(tr.children).map((td) => td.textContent));

  if (!rows.length) return;

  const header = ['順位', 'ID', '指標', '値'];
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'report.csv';
  link.click();
  URL.revokeObjectURL(url);
}

async function ensureGridData() {
  if (!state.gridData) {
    await loadGrid();
  }
  if (!state.gridMetricsLoaded && state.gridData) {
    const { gridData, stats } = await computeGridMetrics(state.gridData, state.roadsData);
    state.gridData = gridData;
    state.gridStats = stats;
    state.gridMetricsLoaded = true;
  }
}

async function ensureRoadMetrics() {
  if (state.roadsMetrics) return;
  let roadsData = state.roadsData;
  if (!roadsData) {
    roadsData = await loadRoadsData();
    state.roadsData = roadsData;
  }
  await ensureGridData();
  state.roadsMetrics = await computeRoadMetrics(roadsData, state.gridData);
}

function metricKey(metric) {
  if (metric === 'traffic') return 'traffic_value';
  if (metric === 'population') return 'population_value';
  if (metric === 'floor') return 'floor_value';
  if (metric === 'ratio_0_14') return 'ratio_0_14';
  if (metric === 'ratio_15_64') return 'ratio_15_64';
  if (metric === 'ratio_65_over') return 'ratio_65_over';
  if (metric === 'score') return 'score_norm';
  return 'traffic_value';
}

async function runReport() {
  const source = reportSourceSelect.value || 'grid';
  const metric = reportMetricSelect.value || vizSelect.value || 'traffic';
  const limit = Math.max(1, Math.min(100, Number(reportLimitInput.value || 20)));
  reportLimitInput.value = String(limit);

  if (source === 'grid') {
    await ensureGridData();
    const key = metricKey(metric);
    const rows = (state.gridData.features || [])
      .map((feature) => {
        const props = feature.properties || {};
        return {
          id: props.KEY_CODE || '-',
          value: props[key] || 0,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);

    renderReport(rows, metric);
    setTopRoadIds([]);
    setTopGridIds(rows.map((row) => String(row.id)));
  } else {
    await loadRoads();
    await ensureRoadMetrics();
    const key = metricKey(metric);
    const rows = Array.from(state.roadsMetrics.values())
      .map((entry) => ({
        id: entry.id,
        value: entry[key] || 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);

    renderReport(rows, metric);
    setTopGridIds([]);
    setTopRoadIds(rows.map((row) => String(row.id)));
  }
}

export function initReport() {
  if (vizSelect && reportMetricSelect) {
    reportMetricSelect.value = vizSelect.value;
    vizSelect.addEventListener('change', () => {
      reportMetricSelect.value = vizSelect.value;
    });
  }

  if (reportRunBtn) {
    reportRunBtn.addEventListener('click', runReport);
  }

  reportExportBtn.addEventListener('click', exportReportCSV);
}
