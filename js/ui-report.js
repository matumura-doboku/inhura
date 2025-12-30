import {
  reportExportBtn,
  reportTable,
  reportCount,
  reportAvg,
  reportSourceSelect,
  reportOrderSelect,
  reportMetricSelect,
  reportMetricSourceSelect,
  reportLimitInput,
  reportRunBtn,
  reportRangeStartBtn,
  reportRangeClearBtn,
  reportRangeVisibility,
  reportRangeStatus,
  vizSelect,
  vizSecondarySelect,
} from './dom.js';
import { state } from './state.js';
import {
  loadGrid,
  loadRoads,
  setTopGridIds,
  setTopRoadIds,
  focusGridById,
  startReportRangeSelection,
  clearReportRangeSelection,
  setReportRangeHighlightVisible,
} from './map.js';
import { computeGridMetrics, computeRoadMetrics, loadRoadsData } from './data.js';
import { getGridFilterPredicate } from './ui-visualization.js';

const metricLabels = {
  traffic: '交通量',
  population: '人口',
  labor: '労働者数',
  floor: '床面積',
  road_area_total: '合計道路面積',
  road_area_nat: '国道面積',
  road_area_pref: '県道面積',
  road_area_muni: '市道面積',
  road_area_other: 'その他面積',
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

function renderReport(rows, metric, { clickable = false } = {}) {
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
    if (clickable) {
      tr.dataset.gridId = String(row.id || '');
      tr.classList.add('report-row');
      tr.title = 'クリックで該当セルへ移動';
    }
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
    const { gridData, stats } = await computeGridMetrics(state.gridData);
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
  if (metric === 'labor') return 'labor_value';
  if (metric === 'floor') return 'floor_value';
  if (metric === 'road_area_total') return 'road_area_total';
  if (metric === 'road_area_nat') return 'road_area_nat';
  if (metric === 'road_area_pref') return 'road_area_pref';
  if (metric === 'road_area_muni') return 'road_area_muni';
  if (metric === 'road_area_other') return 'road_area_other';
  if (metric === 'ratio_0_14') return 'ratio_0_14';
  if (metric === 'ratio_15_64') return 'ratio_15_64';
  if (metric === 'ratio_65_over') return 'ratio_65_over';
  if (metric === 'score') return 'score_norm';
  return 'traffic_value';
}

async function ensureGridTraffic() {
  if (state.gridTrafficLoaded) return;
  window.dispatchEvent(new Event('grid:traffic:ensure'));
  const start = Date.now();
  while (!state.gridTrafficLoaded && Date.now() - start < 8000) {
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

async function runReport() {
  const source = reportSourceSelect.value || 'grid';
  const metricSource = reportMetricSourceSelect?.value || 'primary';
  const metric = metricSource === 'secondary'
    ? (vizSecondarySelect?.value || vizSelect.value || 'traffic')
    : (vizSelect.value || 'traffic');
  const order = reportOrderSelect?.value === 'asc' ? 'asc' : 'desc';
  const limit = Math.max(1, Math.min(100, Number(reportLimitInput.value || 20)));
  reportLimitInput.value = String(limit);

  if (source === 'grid') {
    await ensureGridData();
    if (metric === 'traffic' || metric === 'score') {
      await ensureGridTraffic();
    }
    const { predicate, needsTraffic } = getGridFilterPredicate();
    if (needsTraffic) {
      await ensureGridTraffic();
    }
    const rangeIds = state.reportRange?.gridIds || [];
    const rangeSet = rangeIds.length ? new Set(rangeIds.map((id) => String(id))) : null;
    const key = metricKey(metric);
    const features = (state.gridData.features || []).filter((feature) => {
      if (predicate && !predicate(feature)) return false;
      if (rangeSet) {
        const id = feature.properties?.KEY_CODE;
        if (!id || !rangeSet.has(String(id))) return false;
      }
      return true;
    });
    const rows = features
      .map((feature) => {
        const props = feature.properties || {};
        return {
          id: props.KEY_CODE || '-',
          value: props[key] || 0,
        };
      })
      .sort((a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value))
      .slice(0, limit);

    renderReport(rows, metric, { clickable: true });
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
      .sort((a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value))
      .slice(0, limit);

    renderReport(rows, metric, { clickable: false });
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

  const setRangeStatus = (text) => {
    if (reportRangeStatus) reportRangeStatus.textContent = text;
  };

  if (reportRangeStartBtn) {
    reportRangeStartBtn.addEventListener('click', () => {
      setRangeStatus('範囲選択を開始しました（クリックで頂点、Enterで確定）');
      startReportRangeSelection();
    });
  }

  if (reportRangeClearBtn) {
    reportRangeClearBtn.addEventListener('click', () => {
      clearReportRangeSelection();
      setRangeStatus('範囲未選択');
    });
  }

  if (reportRangeVisibility) {
    reportRangeVisibility.checked = state.reportRangeVisible;
    reportRangeVisibility.addEventListener('change', () => {
      setReportRangeHighlightVisible(reportRangeVisibility.checked);
    });
  }

  reportExportBtn.addEventListener('click', exportReportCSV);

  window.addEventListener('report:range:updated', (event) => {
    const count = event?.detail?.count ?? 0;
    if (count > 0) {
      setRangeStatus(`選択セル: ${count}件`);
    } else if (state.reportRange?.active) {
      setRangeStatus('範囲選択を開始しました（クリックで頂点、Enterで確定）');
    } else {
      setRangeStatus('範囲未選択');
    }
  });

  if (reportTable) {
    reportTable.addEventListener('click', (event) => {
      const row = event.target.closest('tr');
      if (!row || row.classList.contains('placeholder')) return;
      const gridId = row.dataset.gridId;
      if (!gridId) return;
      focusGridById(gridId);
    });
  }
}
