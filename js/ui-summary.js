import { state } from './state.js';
import { updateConditionSummary } from './ui-visualization.js';

let fixedView = null;
let lockHandlersAttached = false;
let restoring = false;
const extraItems = [];

function captureView(map) {
  return {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function viewsMatch(map, view) {
  if (!view) return true;
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  const pitch = map.getPitch();
  const tol = 1e-7;
  return (
    Math.abs(center.lng - view.center.lng) < tol &&
    Math.abs(center.lat - view.center.lat) < tol &&
    Math.abs(zoom - view.zoom) < tol &&
    Math.abs(bearing - view.bearing) < tol &&
    Math.abs(pitch - view.pitch) < tol
  );
}

function restoreView(map) {
  if (!fixedView || restoring) return;
  restoring = true;
  map.jumpTo({
    center: fixedView.center,
    zoom: fixedView.zoom,
    bearing: fixedView.bearing,
    pitch: fixedView.pitch,
  });
  restoring = false;
}

function lockView(map) {
  if (!map) return;
  fixedView = captureView(map);
  map.dragPan.disable();
  map.scrollZoom.disable();
  map.boxZoom.disable();
  map.doubleClickZoom.disable();
  map.keyboard.disable();
  map.touchZoomRotate.disable();

  if (!lockHandlersAttached) {
    const onMove = () => {
      if (!viewsMatch(map, fixedView)) restoreView(map);
    };
    map.on('moveend', onMove);
    map.on('zoomend', onMove);
    map.on('rotateend', onMove);
    map.on('pitchend', onMove);
    map.__summaryLockHandler = onMove;
    lockHandlersAttached = true;
  }
}

function unlockView(map) {
  if (!map) return;
  map.dragPan.enable();
  map.scrollZoom.enable();
  map.boxZoom.enable();
  map.doubleClickZoom.enable();
  map.keyboard.enable();
  map.touchZoomRotate.enable();
  if (lockHandlersAttached && map.__summaryLockHandler) {
    map.off('moveend', map.__summaryLockHandler);
    map.off('zoomend', map.__summaryLockHandler);
    map.off('rotateend', map.__summaryLockHandler);
    map.off('pitchend', map.__summaryLockHandler);
    map.__summaryLockHandler = null;
    lockHandlersAttached = false;
  }
  fixedView = null;
}

export function initSummary() {
  const adjustRadio = document.getElementById('summary-mode-adjust');
  const fixedRadio = document.getElementById('summary-mode-fixed');
  const badge = document.getElementById('summary-badge');
  const metaWrap = document.getElementById('summary-meta');
  const dateInput = document.getElementById('summary-date');
  const authorInput = document.getElementById('summary-author');
  const dateText = document.getElementById('summary-date-text');
  const authorText = document.getElementById('summary-author-text');
  const extraTitleInput = document.getElementById('summary-extra-title');
  const extraValueInput = document.getElementById('summary-extra-value');
  const extraText = document.getElementById('summary-extra-text');
  const extraRow = document.getElementById('summary-extra-row');
  const extraAddBtn = document.getElementById('summary-extra-add');
  const extraConfirmBtn = document.getElementById('summary-extra-confirm');
  const extraInputs = document.getElementById('summary-extra-inputs');
  const extraList = document.getElementById('summary-extra-list');
  const header = document.getElementById('summary-header');
  const showConditions = document.getElementById('summary-show-conditions');
  const conditionBox = document.getElementById('viz-condition-box');
  if (!adjustRadio || !fixedRadio) return;

  const syncHeader = () => {
    if (dateText) dateText.textContent = dateInput?.value?.trim() || '-';
    if (authorText) authorText.textContent = authorInput?.value?.trim() || '-';
    const showExtra = extraItems.length > 0;
    if (extraText) {
      extraText.textContent = extraItems
        .map((item) => (item.title ? `${item.title}: ${item.value}` : item.value))
        .join(' / ');
    }
    extraRow?.classList.toggle('is-hidden', !showExtra);
  };

  const renderExtras = () => {
    if (!extraList) return;
    extraList.innerHTML = '';
    extraItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'summary-extra-item';
      const text = document.createElement('div');
      text.className = 'summary-extra-text';
      text.textContent = item.title ? `${item.title}: ${item.value}` : item.value;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn ghost summary-extra-remove';
      removeBtn.textContent = '削除';
      removeBtn.addEventListener('click', () => {
        extraItems.splice(index, 1);
        renderExtras();
        syncHeader();
      });
      row.appendChild(text);
      row.appendChild(removeBtn);
      extraList.appendChild(row);
    });
  };

  const applyMode = () => {
    const map = state.map;
    if (!map) return;
    if (fixedRadio.checked) {
      lockView(map);
      badge?.classList.remove('is-hidden');
      metaWrap?.classList.remove('is-hidden');
      header?.classList.remove('is-hidden');
      syncHeader();
      updateConditionSummary();
    } else {
      unlockView(map);
      badge?.classList.add('is-hidden');
      metaWrap?.classList.add('is-hidden');
      header?.classList.add('is-hidden');
      conditionBox?.classList.add('is-hidden');
      updateConditionSummary();
    }
  };

  adjustRadio.addEventListener('change', applyMode);
  fixedRadio.addEventListener('change', applyMode);
  dateInput?.addEventListener('input', syncHeader);
  authorInput?.addEventListener('input', syncHeader);
  extraTitleInput?.addEventListener('input', syncHeader);
  extraValueInput?.addEventListener('input', syncHeader);
  extraAddBtn?.addEventListener('click', () => {
    if (extraInputs?.classList.contains('is-hidden')) {
      extraInputs.classList.remove('is-hidden');
      extraTitleInput?.focus();
      return;
    }
  });
  extraConfirmBtn?.addEventListener('click', () => {
    const title = extraTitleInput?.value?.trim() || '';
    const value = extraValueInput?.value?.trim() || '';
    if (!title && !value) return;
    extraItems.push({ title, value });
    if (extraTitleInput) extraTitleInput.value = '';
    if (extraValueInput) extraValueInput.value = '';
    renderExtras();
    syncHeader();
  });
  renderExtras();
  applyMode();
}
