import {
  propertyPanel,
  propertyTitle,
  propertySub,
  propertyBody,
  propertyCloseBtn,
} from './dom.js';

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString();
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(1)}%`;
}

function setPanelContent(props) {
  const code = props.KEY_CODE || '-';
  const population = props.population_value || 0;
  const traffic = props.traffic_value || 0;
  const floor = props.floor_value || 0;
  const pop0 = props.pop_0_14 || 0;
  const pop15 = props.pop_15_64 || 0;
  const pop65 = props.pop_65_over || 0;
  const ratio0 = props.ratio_0_14 || 0;
  const ratio15 = props.ratio_15_64 || 0;
  const ratio65 = props.ratio_65_over || 0;

  propertySub.textContent = `セル番号: ${code}`;
  propertyBody.innerHTML = `
    <dl class="property-list">
      <div>
        <dt>人口</dt>
        <dd>${formatNumber(population)}</dd>
      </div>
      <div>
        <dt>交通量</dt>
        <dd>${formatNumber(traffic)}</dd>
      </div>
      <div>
        <dt>床面積</dt>
        <dd>${formatNumber(floor)}</dd>
      </div>
    </dl>
    <div class="property-section">
      <h4>人口構成</h4>
      <dl class="property-list">
        <div>
          <dt>0-15歳</dt>
          <dd>${formatNumber(pop0)} <span class="ratio">${formatPercent(ratio0)}</span></dd>
        </div>
        <div>
          <dt>16-65歳</dt>
          <dd>${formatNumber(pop15)} <span class="ratio">${formatPercent(ratio15)}</span></dd>
        </div>
        <div>
          <dt>65歳以上</dt>
          <dd>${formatNumber(pop65)} <span class="ratio">${formatPercent(ratio65)}</span></dd>
        </div>
      </dl>
    </div>
  `;
}

export function showPropertyPanel(props) {
  if (!propertyPanel || !propertyBody || !propertySub) return;
  setPanelContent(props || {});
  propertyPanel.classList.add('active');
  propertyPanel.setAttribute('aria-hidden', 'false');
  if (propertyTitle) propertyTitle.textContent = 'セル情報';
}

export function hidePropertyPanel() {
  if (!propertyPanel) return;
  propertyPanel.classList.remove('active');
  propertyPanel.setAttribute('aria-hidden', 'true');
}

export function initPropertyPanel() {
  if (!propertyPanel) return;
  propertyCloseBtn?.addEventListener('click', hidePropertyPanel);
}
