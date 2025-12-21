import { state } from './state.js';
import { mapStatus, roadsStatus } from './dom.js';
import { loadGridData, loadRoadsData, computeGridMetrics } from './data.js';
import { applyGridVisualization } from './ui-visualization.js';
import { showPropertyPanel, hidePropertyPanel } from './ui-property.js';

export function initMap() {
  if (!window.maplibregl) {
    if (mapStatus) mapStatus.textContent = 'MapLibre 読み込み失敗';
    return;
  }

  const style = {
    version: 8,
    sources: {
      gsi: {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '国土地理院',
      },
    },
    layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }],
  };

  const map = new maplibregl.Map({
    container: 'map',
    style,
    center: [132.4553, 34.3853],
    zoom: 12.5,
    maxZoom: 18,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }));
  map.on('load', () => {
    state.mapReady = true;
    if (mapStatus) mapStatus.textContent = '表示中';
    if (state.roadsData) {
      addRoadLayer(state.roadsData);
    }
    loadGrid();
  });

  map.on('error', () => {
    if (mapStatus) mapStatus.textContent = '地図読み込みエラー';
  });

  state.map = map;
}

export function addRoadLayer(geojson) {
  if (!state.map || !state.mapReady) return;

  if (state.map.getSource('roads')) {
    state.map.getSource('roads').setData(geojson);
  } else {
    state.map.addSource('roads', { type: 'geojson', data: geojson });
    state.map.addLayer({
      id: 'roads-line',
      type: 'line',
      source: 'roads',
      paint: {
        'line-color': '#9a4d2e',
        'line-width': 2.0,
        'line-opacity': 0.6,
      },
    });
    state.map.addLayer({
      id: 'roads-halo',
      type: 'line',
      source: 'roads',
      paint: {
        'line-color': '#f7d2b8',
        'line-width': 4.5,
        'line-opacity': 0.5,
      },
    }, 'roads-line');
  }

  if (roadsStatus) roadsStatus.textContent = '読み込み済み';
}

export async function loadRoads() {
  if (roadsStatus) roadsStatus.textContent = '読み込み中...';
  try {
    const geojson = await loadRoadsData();
    state.roadsData = geojson;
    addRoadLayer(geojson);
  } catch (err) {
    if (roadsStatus) roadsStatus.textContent = '読み込み失敗';
    console.error(err);
  }
}

export function toggleRoads() {
  if (!state.map || !state.mapReady) return;
  const visible = state.roadsVisible;
  state.roadsVisible = !visible;
  const visibility = state.roadsVisible ? 'visible' : 'none';
  ['roads-line', 'roads-halo'].forEach((layerId) => {
    if (state.map.getLayer(layerId)) {
      state.map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}

export function addGridLayer(geojson) {
  if (!state.map || !state.mapReady) return;

  if (state.map.getSource('grid')) {
    state.map.getSource('grid').setData(geojson);
    return;
  }

  const beforeId = state.map.getLayer('roads-halo')
    ? 'roads-halo'
    : (state.map.getLayer('roads-line') ? 'roads-line' : undefined);

  state.map.addSource('grid', { type: 'geojson', data: geojson });
  state.map.addLayer({
    id: 'grid-fill',
    type: 'fill',
    source: 'grid',
    paint: {
      'fill-color': '#2b4f9c',
      'fill-opacity': 0.12,
    },
  }, beforeId);
  state.map.addLayer({
    id: 'grid-line',
    type: 'line',
    source: 'grid',
    paint: {
      'line-color': '#2b4f9c',
      'line-width': 0.6,
      'line-opacity': 0.45,
    },
  }, beforeId);

  addGridPointLayer(geojson);
  bindGridEvents();
}

let gridEventsBound = false;

function bindGridEvents() {
  if (gridEventsBound || !state.map) return;
  gridEventsBound = true;

  state.map.on('click', 'grid-fill', (event) => {
    const feature = event.features && event.features[0];
    if (!feature || !feature.properties) return;
    showPropertyPanel(feature.properties);
  });

  state.map.on('mouseenter', 'grid-fill', () => {
    state.map.getCanvas().style.cursor = 'pointer';
  });

  state.map.on('mouseleave', 'grid-fill', () => {
    state.map.getCanvas().style.cursor = '';
  });

  state.map.on('click', (event) => {
    const features = state.map.queryRenderedFeatures(event.point, { layers: ['grid-fill'] });
    if (!features.length) {
      hidePropertyPanel();
    }
  });
}

async function hydrateGridMetrics() {
  if (!state.gridData || state.gridMetricsLoaded) return;

  let roadsData = state.roadsData;
  if (!roadsData) {
    try {
      roadsData = await loadRoadsData();
      state.roadsData = roadsData;
    } catch (err) {
      console.error(err);
    }
  }

  const { gridData, stats } = await computeGridMetrics(state.gridData, roadsData);
  state.gridData = gridData;
  state.gridStats = stats;
  state.gridMetricsLoaded = true;

  if (state.map && state.map.getSource('grid')) {
    state.map.getSource('grid').setData(state.gridData);
  }
  if (state.map && state.map.getSource('grid-points')) {
    const points = buildGridPoints(state.gridData);
    state.gridPointsData = points;
    state.map.getSource('grid-points').setData(points);
  }
  applyGridVisualization();
}

export async function loadGrid() {
  if (state.gridData) {
    addGridLayer(state.gridData);
    await hydrateGridMetrics();
    return;
  }
  try {
    const geojson = await loadGridData();
    state.gridData = geojson;
    addGridLayer(geojson);
    await hydrateGridMetrics();
  } catch (err) {
    console.error(err);
  }
}

function getGeometryCenter(geometry) {
  if (!geometry || !geometry.coordinates) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const pushCoord = (coord) => {
    const [x, y] = coord;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => ring.forEach(pushCoord));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((poly) => {
      poly.forEach((ring) => ring.forEach(pushCoord));
    });
  } else {
    return null;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function buildGridPoints(gridData) {
  if (!gridData) return { type: 'FeatureCollection', features: [] };
  const features = (gridData.features || []).map((feature) => {
    const center = getGeometryCenter(feature.geometry);
    if (!center) return null;
    const props = feature.properties || {};
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: center,
      },
      properties: {
        ...props,
      },
    };
  }).filter(Boolean);

  return { type: 'FeatureCollection', features };
}

function addGridPointLayer(gridData) {
  if (!state.map || !state.mapReady) return;
  const points = buildGridPoints(gridData);
  state.gridPointsData = points;

  if (state.map.getSource('grid-points')) {
    state.map.getSource('grid-points').setData(points);
    return;
  }

  const beforeId = state.map.getLayer('grid-line') ? 'grid-line' : undefined;
  state.map.addSource('grid-points', { type: 'geojson', data: points });
  state.map.addLayer({
    id: 'grid-circles',
    type: 'circle',
    source: 'grid-points',
    paint: {
      'circle-radius': 4,
      'circle-color': '#1f2937',
      'circle-opacity': 0.6,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-pitch-scale': 'viewport',
    },
  }, beforeId);
}

function ensureGridTopLayer() {
  if (!state.map || !state.map.getSource('grid')) return;
  if (state.map.getLayer('grid-top')) return;
  state.map.addLayer({
    id: 'grid-top',
    type: 'line',
    source: 'grid',
    paint: {
      'line-color': '#dc2626',
      'line-width': 2.4,
      'line-opacity': 0.9,
    },
    filter: ['in', ['get', 'KEY_CODE'], ['literal', []]],
  });
}

function ensureRoadTopLayer() {
  if (!state.map || !state.map.getSource('roads')) return;
  if (state.map.getLayer('roads-top')) return;
  state.map.addLayer({
    id: 'roads-top',
    type: 'line',
    source: 'roads',
    paint: {
      'line-color': '#dc2626',
      'line-width': 3.0,
      'line-opacity': 0.95,
    },
    filter: ['in', ['get', 'linkid'], ['literal', []]],
  });
}

export function setTopGridIds(ids) {
  if (!state.map || !state.mapReady) return;
  ensureGridTopLayer();
  if (!state.map.getLayer('grid-top')) return;
  const filter = ids.length
    ? ['in', ['get', 'KEY_CODE'], ['literal', ids]]
    : ['in', ['get', 'KEY_CODE'], ['literal', []]];
  state.map.setFilter('grid-top', filter);
}

export function setTopRoadIds(ids) {
  if (!state.map || !state.mapReady) return;
  ensureRoadTopLayer();
  if (!state.map.getLayer('roads-top')) return;
  const filter = ids.length
    ? ['in', ['get', 'linkid'], ['literal', ids]]
    : ['in', ['get', 'linkid'], ['literal', []]];
  state.map.setFilter('roads-top', filter);
}
