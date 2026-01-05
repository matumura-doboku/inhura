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
  reportModeSelect,
  reportModeSearch,
  reportModeAggregation,
  reportAggMetric,
  reportAggYearRadios,
  reportAggRunBtn,
  aggSum,
  aggAvgRange,
  aggAvgTotal,
  aggCount,
  aggMax,
  aggMin,
  cardAggMax,
  cardAggMin,
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
      <td>${formatValue(metric, row.value)}</td>
    `;
    tbody.appendChild(tr);
  });

  reportCount.textContent = rows.length;
  reportAvg.textContent = rows.length ? (sumValue / rows.length).toFixed(1) : '-';
}

function exportReportCSV() {
  const dataset = state.reportResults || [];
  if (!dataset.length) return;

  // Get metadata for filename
  let year = 2020;
  const yearRadios = document.getElementsByName('stats-year');
  if (yearRadios.length > 0) {
    const selected = Array.from(yearRadios).find(r => r.checked);
    if (selected) year = selected.value;
  }

  const metricSource = reportMetricSourceSelect?.value || 'primary';
  const metricKeySelected = metricSource === 'secondary'
    ? (vizSecondarySelect?.value || vizSelect.value || 'traffic')
    : (vizSelect.value || 'traffic');
  const metricLabel = metricLabels[metricKeySelected] || metricKeySelected;

  const orderLabel = (reportOrderSelect?.value === 'asc') ? '下位' : '上位';
  const filename = `${year}_${metricLabel}_${orderLabel}.csv`;

  // Define column order: Rank, kye_code, then all defined metrics
  const allMetricKeys = Object.keys(metricLabels);

  // Header row
  const header = ['順位', 'kye_code', ...allMetricKeys.map(k => metricLabels[k])];

  const csvRows = dataset.map((row, index) => {
    const props = row.properties || {};

    // Map each metric key to its value from the properties object
    const metricValues = allMetricKeys.map(key => {
      const propKey = metricKey(key);
      const val = props[propKey];
      // Format value but remove commas for CSV safety
      return String(formatValue(key, val)).replace(/,/g, '');
    });

    return [index + 1, row.id, ...metricValues].join(',');
  });

  const csv = [header.join(','), ...csvRows].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function ensureGridData() {
  if (!state.gridData) {
    await loadGrid();
  }
  if (!state.gridMetricsLoaded && state.gridData) {
    let year = 2020;
    const radios = document.getElementsByName('stats-year');
    if (radios.length > 0) {
      const selected = Array.from(radios).find(r => r.checked);
      if (selected) year = Number(selected.value);
    }
    const { gridData, stats } = await computeGridMetrics(state.gridData, year);
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
      const id = feature.properties?.KEY_CODE;
      // If range is selected, only cells within the range are considered.
      // We ignore the search predicate to ensure ALL cells in the range are included.
      if (rangeSet) {
        return id && rangeSet.has(String(id));
      }
      // If no range, apply the search predicate (if any).
      if (predicate && !predicate(feature)) return false;
      return true;
    });
    const allRows = features
      .map((feature) => {
        const props = feature.properties || {};
        return {
          id: props.KEY_CODE || '-',
          value: props[key] || 0,
          properties: props,
        };
      })
      .sort((a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value));

    state.reportResults = allRows;
    const rows = allRows.slice(0, limit);

    renderReport(rows, metric, { clickable: true });
    setTopRoadIds([]);
    setTopGridIds(rows.map((row) => String(row.id)));
  } else {
    await loadRoads();
    await ensureRoadMetrics();
    const rangeIds = state.reportRange?.gridIds || [];
    const rangeSet = rangeIds.length ? new Set(rangeIds.map((id) => String(id))) : null;
    const key = metricKey(metric);

    const allRows = Array.from(state.roadsMetrics.values())
      .filter((entry) => {
        // If range is selected, only consider roads in that range (if applicable/already handled in gridIds)
        // Here we assume rangeSet check is preferred if active.
        if (rangeSet) {
          // Road entries often link to grid IDs or have their own IDs. 
          // Assuming we want everything from the loaded road set if it's been filtered by range during computeRoadMetrics
          return true;
        }
        return true;
      })
      .map((entry) => ({
        id: entry.id,
        value: entry[key] || 0,
        properties: entry,
      }))
      .sort((a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value));

    state.reportResults = allRows;
    const rows = allRows.slice(0, limit);

    renderReport(rows, metric, { clickable: false });
    setTopGridIds([]);
    setTopRoadIds(rows.map((row) => String(row.id)));
  }
}

async function runAggregation() {
  const metric = reportAggMetric?.value || 'population';
  let year = 2020;
  if (reportAggYearRadios) {
    const selected = Array.from(reportAggYearRadios).find(r => r.checked);
    if (selected) year = Number(selected.value);
  }

  // Ensure data loaded
  await ensureGridData();
  const isTraffic = metric === 'traffic' || metric === 'score';
  if (isTraffic) {
    await ensureGridTraffic();
  }
  // For safety, re-compute if year changed
  const { gridData } = await computeGridMetrics(state.gridData, year);
  state.gridData = gridData; // Update state with fresh metrics for that year

  const rangeIds = state.reportRange?.gridIds || [];
  const rangeSet = rangeIds.length ? new Set(rangeIds.map((id) => String(id))) : null;

  // Key to read
  const key = metricKey(metric);
  const features = state.gridData.features || [];

  let rangeSum = 0;
  let rangeCountVal = 0;
  let totalSum = 0;
  let totalCountVal = 0;
  let rangeMaxVal = -Infinity;
  let rangeMinVal = Infinity;
  let rangeMaxId = null;
  let rangeMinId = null;

  features.forEach((feature) => {
    const val = Number(feature.properties?.[key] || 0);
    // Total stats
    if (Number.isFinite(val) && val !== 0) {
      totalSum += val;
      totalCountVal++;
    }

    // Range stats
    const id = feature.properties?.KEY_CODE;
    if (rangeSet && id && rangeSet.has(String(id))) {
      if (Number.isFinite(val) && val !== 0) {
        rangeSum += val;
        rangeCountVal++;
        if (val > rangeMaxVal) {
          rangeMaxVal = val;
          rangeMaxId = id;
        }
        if (val < rangeMinVal) {
          rangeMinVal = val;
          rangeMinId = id;
        }
      }
    }
  });

  const rangeAvg = rangeCountVal > 0 ? rangeSum / rangeCountVal : 0;
  const totalAvg = totalCountVal > 0 ? totalSum / totalCountVal : 0;

  if (aggSum) aggSum.textContent = formatValue(metric, rangeSum);
  if (aggAvgRange) aggAvgRange.textContent = formatValue(metric, rangeAvg);
  if (aggAvgTotal) aggAvgTotal.textContent = formatValue(metric, totalAvg);
  if (aggCount) aggCount.textContent = `${rangeCountVal} / ${totalCountVal}`;

  if (aggMax) {
    aggMax.textContent = rangeMaxId ? formatValue(metric, rangeMaxVal) : '-';
    if (cardAggMax) cardAggMax.dataset.targetId = rangeMaxId || '';
  }

  if (aggMin) {
    aggMin.textContent = rangeMinId ? formatValue(metric, rangeMinVal) : '-';
    if (cardAggMin) cardAggMin.dataset.targetId = rangeMinId || '';
  }

  // Store results for aggregation export as well
  state.aggResults = {
    metric,
    year,
    rangeSum,
    rangeAvg,
    totalAvg,
    rangeCountVal,
    totalCountVal,
    rangeMaxVal,
    rangeMaxId,
    rangeMinVal,
    rangeMinId
  };
}

function exportAggCSV() {
  if (!state.aggResults || !state.gridData) return;

  const year = state.aggResults.year;
  const filename = `${year}_範囲内集計結果_全指標.csv`;

  const rangeIds = state.reportRange?.gridIds || [];
  const rangeSet = rangeIds.length ? new Set(rangeIds.map((id) => String(id))) : new Set();

  // List of all metrics
  const metrics = Object.keys(metricLabels);

  // Initialize stats accumulator
  const stats = {};
  metrics.forEach(m => {
    stats[m] = {
      rangeSum: 0,
      rangeCount: 0,
      totalSum: 0,
      totalCount: 0,
      rangeMaxVal: -Infinity,
      rangeMaxId: null,
      rangeMinVal: Infinity,
      rangeMinId: null
    };
  });

  // Iterate over features to aggregate data
  const features = state.gridData.features || [];
  features.forEach((feature) => {
    const id = feature.properties?.KEY_CODE;
    const isInRange = id && rangeSet.has(String(id));

    metrics.forEach(m => {
      const key = metricKey(m);
      const val = Number(feature.properties?.[key] || 0);

      // Exclude 0 values from average/min/max calculation as per existing logic
      if (Number.isFinite(val) && val !== 0) {
        // Total Stats
        stats[m].totalSum += val;
        stats[m].totalCount += 1;

        // Range Stats
        if (isInRange) {
          stats[m].rangeSum += val;
          stats[m].rangeCount += 1;

          if (val > stats[m].rangeMaxVal) {
            stats[m].rangeMaxVal = val;
            stats[m].rangeMaxId = id;
          }
          if (val < stats[m].rangeMinVal) {
            stats[m].rangeMinVal = val;
            stats[m].rangeMinId = id;
          }
        }
      }
    });
  });

  const header = ['指標', '年度', '範囲合計', '範囲平均', '全体平均', '最大値', '最大値ID', '最小値', '最小値ID'];
  const csvRows = metrics.map(m => {
    const s = stats[m];
    const rangeAvg = s.rangeCount > 0 ? s.rangeSum / s.rangeCount : 0;
    const totalAvg = s.totalCount > 0 ? s.totalSum / s.totalCount : 0;

    const rangeMaxStr = s.rangeMaxId ? formatValue(m, s.rangeMaxVal).replace(/,/g, '') : '-';
    const rangeMinStr = s.rangeMinId ? formatValue(m, s.rangeMinVal).replace(/,/g, '') : '-';

    return [
      metricLabels[m],
      year,
      formatValue(m, s.rangeSum).replace(/,/g, ''),
      formatValue(m, rangeAvg).replace(/,/g, ''),
      formatValue(m, totalAvg).replace(/,/g, ''),
      rangeMaxStr,
      s.rangeMaxId || '-',
      rangeMinStr,
      s.rangeMinId || '-'
    ].join(',');
  });

  const csv = [header.join(','), ...csvRows].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function initReport() {
  if (vizSelect && reportMetricSelect) {
    reportMetricSelect.value = vizSelect.value;
    vizSelect.addEventListener('change', () => {
      reportMetricSelect.value = vizSelect.value;
    });
  }

  if (reportModeSelect) {
    reportModeSelect.addEventListener('change', () => {
      const mode = reportModeSelect.value;
      if (reportModeSearch) {
        reportModeSearch.classList.toggle('is-hidden', mode !== 'search');
      }
      if (reportModeAggregation) {
        reportModeAggregation.classList.toggle('is-hidden', mode !== 'aggregation');
      }
    });
  }

  if (reportRunBtn) {
    reportRunBtn.addEventListener('click', runReport);
  }

  if (reportAggRunBtn) {
    reportAggRunBtn.addEventListener('click', runAggregation);
  }

  const aggExportBtn = document.getElementById('report-agg-export');
  if (aggExportBtn) {
    aggExportBtn.addEventListener('click', exportAggCSV);
  }

  const setupNavCard = (card) => {
    if (!card) return;
    card.addEventListener('click', () => {
      const id = card.dataset.targetId;
      if (id) focusGridById(id);
    });
  };
  setupNavCard(cardAggMax);
  setupNavCard(cardAggMin);

  if (vizSelect && reportAggMetric) {
    reportAggMetric.value = vizSelect.value;
    vizSelect.addEventListener('change', () => {
      if (reportAggMetric) reportAggMetric.value = vizSelect.value;
    });
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
