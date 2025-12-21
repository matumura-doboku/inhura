export const state = {
  map: null,
  mapReady: false,
  roadsVisible: true,
  roadsData: null,
  roadsMetrics: null,
  gridData: null,
  gridPointsData: null,
  gridMetricsLoaded: false,
  gridTrafficLoaded: false,
  gridStats: {
    trafficMax: 0,
    populationMax: 0,
    floorMax: 0,
  },
  addressCandidates: [],
};

export const vizThemes = {
  traffic: { label: '交通量', colors: ['#fff4e6', '#d96c3b'] },
  population: { label: '人口', colors: ['#e6f7f5', '#1b7f7a'] },
  floor: { label: '床面積', colors: ['#fef6d8', '#b08b2e'] },
  ratio_0_14: { label: '年齢構成（0-15）', colors: ['#eef2ff', '#1d4ed8'] },
  ratio_15_64: { label: '年齢構成（15-65）', colors: ['#ecfeff', '#0f766e'] },
  ratio_65_over: { label: '年齢構成（65以上）', colors: ['#fff7ed', '#c2410c'] },
  score: { label: '必要度スコア', colors: ['#f0f4ff', '#2b4f9c'] },
};
