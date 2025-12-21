import { vizSelect, vizSecondarySelect, legendTitle, legendBar } from './dom.js';
import { state, vizThemes } from './state.js';

export function applyGridVisualization() {
  if (!state.map || !state.mapReady || !state.map.getLayer('grid-fill')) return;
  const mode = vizSelect.value;
  const secondaryMode = vizSecondarySelect ? vizSecondarySelect.value : mode;

  const needsTraffic = (value) => value === 'traffic' || value === 'score';
  if (!state.gridTrafficLoaded && (needsTraffic(mode) || needsTraffic(secondaryMode))) {
    window.dispatchEvent(new Event('grid:traffic:ensure'));
  }

  const theme = vizThemes[mode] || vizThemes.traffic;
  const prop =
    mode === 'population'
      ? 'population_norm'
      : mode === 'floor'
        ? 'floor_norm'
        : mode === 'ratio_0_14'
          ? 'ratio_0_14'
          : mode === 'ratio_15_64'
            ? 'ratio_15_64'
            : mode === 'ratio_65_over'
              ? 'ratio_65_over'
          : mode === 'score'
            ? 'score_norm'
            : 'traffic_norm';

  const secondaryTheme = vizThemes[secondaryMode] || vizThemes.traffic;
  const secondaryProp =
    secondaryMode === 'population'
      ? 'population_norm'
      : secondaryMode === 'floor'
        ? 'floor_norm'
        : secondaryMode === 'ratio_0_14'
          ? 'ratio_0_14'
          : secondaryMode === 'ratio_15_64'
            ? 'ratio_15_64'
            : secondaryMode === 'ratio_65_over'
              ? 'ratio_65_over'
          : secondaryMode === 'score'
            ? 'score_norm'
            : 'traffic_norm';

  const colorExpr = [
    'case',
    ['<=', ['coalesce', ['get', prop], 0], 0],
    'transparent',
    [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', prop], 0],
      0,
      theme.colors[0],
      100,
      theme.colors[1],
    ],
  ];

  state.map.setPaintProperty('grid-fill', 'fill-color', colorExpr);
  state.map.setPaintProperty('grid-fill', 'fill-opacity', 0.45);
  state.map.setPaintProperty('grid-line', 'line-color', theme.colors[1]);

  if (state.map.getLayer('grid-circles')) {
    const sizeExpr = [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', secondaryProp], 0],
      0,
      0,
      30,
      4,
      60,
      8,
      100,
      14,
    ];
    state.map.setPaintProperty('grid-circles', 'circle-radius', sizeExpr);
    state.map.setPaintProperty('grid-circles', 'circle-color', secondaryTheme.colors[1]);
  }
}

function updateLegend() {
  const theme = vizThemes[vizSelect.value] || vizThemes.traffic;
  const secondaryTheme = vizThemes[vizSecondarySelect?.value] || theme;
  const secondaryLabel = vizSecondarySelect?.value
    ? ` / 円: ${secondaryTheme.label}`
    : '';
  legendTitle.textContent = `色: ${theme.label}${secondaryLabel}`;
  legendBar.style.background = `linear-gradient(90deg, ${theme.colors[0]}, ${theme.colors[1]})`;
  applyGridVisualization();
}

export function initVisualization() {
  if (vizSecondarySelect) {
    vizSecondarySelect.value = vizSelect.value;
    vizSecondarySelect.addEventListener('change', updateLegend);
    vizSelect.addEventListener('change', () => {
      if (!vizSecondarySelect.value) {
        vizSecondarySelect.value = vizSelect.value;
      }
    });
  }
  updateLegend();

  vizSelect.addEventListener('change', updateLegend);
}
