import "./external/d3.v7.js";
import "./external/topojson-client.js";
import { ChoroplethMap } from "./choroplethMap.js"
import { TimelineSlider } from "./timelineSlider.js"
import { Barplot } from "./barplot.js"

let ros, lastRo, candidates, partiesMajor, partiesRaw;
let choropleth, timelineSlider, barPlot;

const roRoot = "../data/feds/mapshaper_simplified_rewound_4326/";

async function loadROData(year) {
    return d3.json(`${roRoot}ro_${year}.geojson`);
}

async function loadCandidates() {
    candidates = await d3.csv('../data/candidates/candidates_final.csv', d3.autoType);
    const ro_years = new Set(d3.map(candidates, d => d.ro));
    return Array.from(ro_years);
}

async function loadInitialData() {
    const ro_years = await loadCandidates();
    // Load the latest RO first
    lastRo = await loadROData(ro_years.pop());
    partiesMajor = await d3.csv('../data/candidates/lookup_tables/parties_major.csv', d3.autoType);
    partiesRaw = await d3.csv('../data/candidates/lookup_tables/parties_raw.csv', d3.autoType);
    return ro_years;
}

async function loadRemainingData(remaining_ro_years) {
    const ro_promises = [];
    remaining_ro_years.forEach(ro => {
        ro_promises.push(loadROData(ro));
    });
    return Promise.all(ro_promises);
}

async function main() {
    let remaining_ro_years = await loadInitialData();
    choropleth = new ChoroplethMap({parentElement: '#choropleth'}, lastRo, candidates, partiesMajor, partiesRaw);
    timelineSlider = new TimelineSlider({parentElement: '#slider'}, candidates, changeDate);
    barPlot = new Barplot({parentElement: '#barplot'}, candidates, partiesMajor);
    loadRemainingData(remaining_ro_years).then((values) => {
        ros = values;
        ros.push(lastRo);
        choropleth.assignAllROs(ros);
    });
}

main();

const quantAttrDropdown = document.getElementById("quant-attr");
quantAttrDropdown.addEventListener('change', () => {
    choropleth.changeQuantAttr(quantAttrDropdown.value);
});

function changeDate(newDate) {
    choropleth.changeDate(newDate);
}
