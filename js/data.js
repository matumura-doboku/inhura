function parseCsv(text) {
  const clean = text.replace(/^\ufeff/, '').trim();
  if (!clean) return { header: [], rows: [] };
  const lines = clean.split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => line.split(','));
  return { header, rows };
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  return res.json();
}

async function fetchCsv(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  return parseCsv(await res.text());
}

export async function loadGridData() {
  return fetchJson('data/grid/messyude-ta001.geojson');
}

export async function loadRoadsData() {
  return fetchJson('data/roads/hirosima/roads.geojson');
}

export async function loadPopulationDetailMap() {
  const { header, rows } = await fetchCsv('data/statistical/tblT001101H34.csv');
  const keyIndex = header.indexOf('KEY_CODE');
  const totalIndex = header.indexOf('T001101001');
  const pop0Index = header.indexOf('T001101004');
  const pop15Index = header.indexOf('T001101010');
  const pop65Index = header.indexOf('T001101019');
  const map = new Map();
  rows.forEach((cols) => {
    const key = cols[keyIndex];
    if (!key) return;
    const total = toNumber(cols[totalIndex]);
    const pop0 = toNumber(cols[pop0Index]);
    const pop15 = toNumber(cols[pop15Index]);
    const pop65 = toNumber(cols[pop65Index]);
    map.set(key, {
      total,
      pop0_14: pop0,
      pop15_64: pop15,
      pop65_over: pop65,
    });
  });
  return map;
}

export async function loadLaborMap() {
  const { header, rows } = await fetchCsv('data/statistical/tblT001108H34.csv');
  const keyIndex = header.indexOf('KEY_CODE');
  const valueIndex = header.indexOf('roudousyasuu');
  const map = new Map();
  rows.forEach((cols) => {
    const key = cols[keyIndex];
    if (!key) return;
    map.set(key, toNumber(cols[valueIndex]));
  });
  return map;
}

export async function loadFloorMap() {
  const { header, rows } = await fetchCsv('data/yukamenseki/hirosima/yukamenseki_hirosima.csv');
  const keyIndex = header.indexOf('KEY_CODE');
  const valueIndex = header.indexOf('total_floor_area');
  const map = new Map();
  rows.forEach((cols) => {
    const key = cols[keyIndex];
    if (!key) return;
    map.set(key, toNumber(cols[valueIndex]));
  });
  return map;
}

export async function loadTrafficMap() {
  const { header, rows } = await fetchCsv('data/traffic/hirosima/traffic.csv');
  const linkIndex = header.indexOf('linkid');
  const trafficIndexes = header
    .map((name, index) => (name.startsWith('koutuuryou') ? index : -1))
    .filter((index) => index >= 0);
  const map = new Map();
  rows.forEach((cols) => {
    const id = cols[linkIndex];
    if (!id) return;
    let sum = 0;
    trafficIndexes.forEach((idx) => {
      sum += toNumber(cols[idx]);
    });
    map.set(String(id), sum);
  });
  return map;
}

export async function loadRoadAreaMap() {
  const { header, rows } = await fetchCsv('data/roads/hirosima/kye_code_area_by_sensyu.csv');
  const keyIndex = header.indexOf('kye_code');
  const totalIndex = header.indexOf('total_area_m2');
  const natIndex = header.indexOf('area_m2_Nat');
  const prefIndex = header.indexOf('area_m2_Pref');
  const muniIndex = header.indexOf('area_m2_Muni');
  const otherIndex = header.indexOf('area_m2_Other');
  const map = new Map();
  rows.forEach((cols) => {
    const key = cols[keyIndex];
    if (!key) return;
    map.set(key, {
      total: toNumber(cols[totalIndex]),
      nat: toNumber(cols[natIndex]),
      pref: toNumber(cols[prefIndex]),
      muni: toNumber(cols[muniIndex]),
      other: toNumber(cols[otherIndex]),
    });
  });
  return map;
}

export function computeTrafficByGrid(roadsData, trafficMap) {
  const gridTraffic = new Map();
  if (!roadsData || !trafficMap) return gridTraffic;

  (roadsData.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const linkid = props.linkid ? String(props.linkid) : null;
    if (!linkid) return;
    const trafficValue = trafficMap.get(linkid);
    if (!trafficValue) return;
    const rawCodes = props.kye_code;
    if (!rawCodes) return;
    const codes = String(rawCodes).split('_').filter(Boolean);
    if (!codes.length) return;
    const share = trafficValue / codes.length;
    codes.forEach((code) => {
      const next = (gridTraffic.get(code) || 0) + share;
      gridTraffic.set(code, next);
    });
  });
  return gridTraffic;
}

export async function computeGridMetrics(gridData) {
  if (!gridData) return { gridData, stats: { trafficMax: 0, populationMax: 0, floorMax: 0 } };

  const [populationDetailMap, laborMap, floorMap, roadAreaMap] = await Promise.all([
    loadPopulationDetailMap().catch(() => new Map()),
    loadLaborMap().catch(() => new Map()),
    loadFloorMap().catch(() => new Map()),
    loadRoadAreaMap().catch(() => new Map()),
  ]);

  let trafficMax = 0;
  let populationMax = 0;
  let laborMax = 0;
  let floorMax = 0;
  let roadAreaTotalMax = 0;
  let roadAreaNatMax = 0;
  let roadAreaPrefMax = 0;
  let roadAreaMuniMax = 0;
  let roadAreaOtherMax = 0;

  (gridData.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const key = props.KEY_CODE ? String(props.KEY_CODE) : '';
    const detail = populationDetailMap.get(key) || {
      total: 0,
      pop0_14: 0,
      pop15_64: 0,
      pop65_over: 0,
    };
    const populationValue = detail.total;
    const laborValue = laborMap.get(key) || 0;
    const floorValue = floorMap.get(key) || 0;
    const areaDetail = roadAreaMap.get(key) || {
      total: 0,
      nat: 0,
      pref: 0,
      muni: 0,
      other: 0,
    };

    props.traffic_value = 0;
    props.population_value = populationValue;
    props.labor_value = laborValue;
    props.floor_value = floorValue;
    props.road_area_total = areaDetail.total;
    props.road_area_nat = areaDetail.nat;
    props.road_area_pref = areaDetail.pref;
    props.road_area_muni = areaDetail.muni;
    props.road_area_other = areaDetail.other;
    props.pop_0_14 = detail.pop0_14;
    props.pop_15_64 = detail.pop15_64;
    props.pop_65_over = detail.pop65_over;

    if (populationValue > populationMax) populationMax = populationValue;
    if (laborValue > laborMax) laborMax = laborValue;
    if (floorValue > floorMax) floorMax = floorValue;
    if (areaDetail.total > roadAreaTotalMax) roadAreaTotalMax = areaDetail.total;
    if (areaDetail.nat > roadAreaNatMax) roadAreaNatMax = areaDetail.nat;
    if (areaDetail.pref > roadAreaPrefMax) roadAreaPrefMax = areaDetail.pref;
    if (areaDetail.muni > roadAreaMuniMax) roadAreaMuniMax = areaDetail.muni;
    if (areaDetail.other > roadAreaOtherMax) roadAreaOtherMax = areaDetail.other;
  });

  (gridData.features || []).forEach((feature) => {
    const props = feature.properties || {};
    props.traffic_norm = 0;
    props.population_norm = populationMax > 0 ? (props.population_value / populationMax) * 100 : 0;
    props.labor_norm = laborMax > 0 ? (props.labor_value / laborMax) * 100 : 0;
    props.floor_norm = floorMax > 0 ? (props.floor_value / floorMax) * 100 : 0;
    props.road_area_total_norm =
      roadAreaTotalMax > 0 ? (props.road_area_total / roadAreaTotalMax) * 100 : 0;
    props.road_area_nat_norm =
      roadAreaNatMax > 0 ? (props.road_area_nat / roadAreaNatMax) * 100 : 0;
    props.road_area_pref_norm =
      roadAreaPrefMax > 0 ? (props.road_area_pref / roadAreaPrefMax) * 100 : 0;
    props.road_area_muni_norm =
      roadAreaMuniMax > 0 ? (props.road_area_muni / roadAreaMuniMax) * 100 : 0;
    props.road_area_other_norm =
      roadAreaOtherMax > 0 ? (props.road_area_other / roadAreaOtherMax) * 100 : 0;
    props.score_norm = (props.traffic_norm + props.population_norm + props.floor_norm) / 3;
    const total = props.population_value || 0;
    props.ratio_0_14 = total > 0 ? (props.pop_0_14 / total) * 100 : 0;
    props.ratio_15_64 = total > 0 ? (props.pop_15_64 / total) * 100 : 0;
    props.ratio_65_over = total > 0 ? (props.pop_65_over / total) * 100 : 0;
  });

  return {
    gridData,
    stats: {
      trafficMax,
      populationMax,
      laborMax,
      floorMax,
      roadAreaTotalMax,
      roadAreaNatMax,
      roadAreaPrefMax,
      roadAreaMuniMax,
      roadAreaOtherMax,
    },
  };
}

export async function computeGridTraffic(gridData, roadsData) {
  const trafficMap = await loadTrafficMap().catch(() => new Map());
  return computeTrafficByGrid(roadsData, trafficMap);
}

export function applyTrafficToGrid(gridData, trafficByGrid) {
  if (!gridData) return { gridData, trafficMax: 0 };
  let trafficMax = 0;
  (gridData.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const key = props.KEY_CODE ? String(props.KEY_CODE) : '';
    const trafficValue = trafficByGrid.get(key) || 0;
    props.traffic_value = trafficValue;
    if (trafficValue > trafficMax) trafficMax = trafficValue;
  });

  (gridData.features || []).forEach((feature) => {
    const props = feature.properties || {};
    props.traffic_norm = trafficMax > 0 ? (props.traffic_value / trafficMax) * 100 : 0;
    props.score_norm = (props.traffic_norm + props.population_norm + props.floor_norm) / 3;
  });

  return { gridData, trafficMax };
}

export async function computeRoadMetrics(roadsData, gridData) {
  const metrics = new Map();
  if (!roadsData) return metrics;

  const trafficMap = await loadTrafficMap().catch(() => new Map());
  const gridIndex = new Map();
  if (gridData && gridData.features) {
    gridData.features.forEach((feature) => {
      const props = feature.properties || {};
      const key = props.KEY_CODE ? String(props.KEY_CODE) : null;
      if (key) gridIndex.set(key, props);
    });
  }

  (roadsData.features || []).forEach((feature) => {
    const props = feature.properties || {};
    const linkid = props.linkid ?? feature.id;
    if (!linkid) return;
    const rawCodes = props.kye_code;
    const codes = rawCodes ? String(rawCodes).split('_').filter(Boolean) : [];

    let populationTotal = 0;
    let laborTotal = 0;
    let pop0 = 0;
    let pop15 = 0;
    let pop65 = 0;
    let floorTotal = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    codes.forEach((code) => {
      const gridProps = gridIndex.get(code);
      if (!gridProps) return;
      populationTotal += gridProps.population_value || 0;
      laborTotal += gridProps.labor_value || 0;
      pop0 += gridProps.pop_0_14 || 0;
      pop15 += gridProps.pop_15_64 || 0;
      pop65 += gridProps.pop_65_over || 0;
      floorTotal += gridProps.floor_value || 0;
      if (gridProps.score_norm != null) {
        scoreSum += gridProps.score_norm || 0;
        scoreCount += 1;
      }
    });

    const trafficValue = trafficMap.get(String(linkid)) || 0;
    const ratio0 = populationTotal > 0 ? (pop0 / populationTotal) * 100 : 0;
    const ratio15 = populationTotal > 0 ? (pop15 / populationTotal) * 100 : 0;
    const ratio65 = populationTotal > 0 ? (pop65 / populationTotal) * 100 : 0;
    const score = scoreCount > 0 ? scoreSum / scoreCount : 0;

    metrics.set(String(linkid), {
      id: String(linkid),
      traffic_value: trafficValue,
      population_value: populationTotal,
      labor_value: laborTotal,
      floor_value: floorTotal,
      pop_0_14: pop0,
      pop_15_64: pop15,
      pop_65_over: pop65,
      ratio_0_14: ratio0,
      ratio_15_64: ratio15,
      ratio_65_over: ratio65,
      score_norm: score,
    });
  });

  return metrics;
}
