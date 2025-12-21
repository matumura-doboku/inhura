import { initTabs } from './ui-tabs.js';
import { initMap, loadRoads, toggleRoads } from './map.js';
import { initAddressSearch } from './ui-address.js';
import { initVisualization } from './ui-visualization.js';
import { initReport } from './ui-report.js';
import { initGuide } from './ui-guide.js';
import { initPropertyPanel } from './ui-property.js';
import { roadsLoadBtn, roadsToggleBtn } from './dom.js';

initTabs();
initMap();
initAddressSearch();
initVisualization();
initReport();
initGuide();
initPropertyPanel();

roadsLoadBtn?.addEventListener('click', loadRoads);
roadsToggleBtn?.addEventListener('click', toggleRoads);
