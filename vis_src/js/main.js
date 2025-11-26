import "./external/d3.v7.js";
import "./external/topojson-client.js";
import { ChoroplethMap } from "./choroplethMap.js"
import { TimelineSlider } from "./timelineSlider.js"
import { Barplot } from "./barplot.js"

let ros, candidates, partiesMajor, partiesRaw;
let choroplethUpper, choroplethLower;
let timelineSliderUpper, timelineSliderLower;
let barPlotUpper, barPlotLower;
let heatmap;

const roRoot = "../data/feds/mapshaper_simplified_rewound_4326/";

async function loadROData(year) {
    return d3.json(`${roRoot}ro_${year}.geojson`);
}

async function loadCandidates() {
    candidates = await d3.csv('../data/candidates/candidates_final.csv', d3.autoType);
    const ro_years = new Set(d3.map(candidates, d => d.ro));
    return Array.from(ro_years);
}

async function loadData() {
    const ro_years = await loadCandidates();
    ros = await loadROs(ro_years);
    partiesMajor = await d3.csv('../data/candidates/lookup_tables/parties_major.csv', d3.autoType);
    partiesRaw = await d3.csv('../data/candidates/lookup_tables/parties_raw.csv', d3.autoType);
}

async function loadROs(ro_years) {
    return Promise.all(ro_years.map(loadROData));
}

async function main() {
    await loadData();
    choroplethUpper = new ChoroplethMap({parentElement: 'choroplethdiv-upper', currentParliament: 1}, ros, candidates, partiesMajor, partiesRaw, mapZoomed);
    choroplethLower = new ChoroplethMap({parentElement: 'choroplethdiv-lower'}, ros, candidates, partiesMajor, partiesRaw, mapZoomed);
    timelineSliderUpper = new TimelineSlider({parentElement: 'sliderdiv-upper', isUpper: true, margin: {top: 40, right: 30, bottom: 5, left: 30}, initializeMin: true}, candidates, changeParliament.bind(choroplethUpper));
    timelineSliderLower = new TimelineSlider({parentElement: 'sliderdiv-lower', isUpper: false, margin: {top: 5, right: 30, bottom: 30, left: 30}}, candidates, changeParliament.bind(choroplethLower));
    barPlotUpper = new Barplot({parentElement: 'barplotdiv-upper'}, candidates, partiesMajor);
    barPlotLower = new Barplot({parentElement: 'barplotdiv-lower'}, candidates, partiesMajor);

}

main();

// const quantAttrDropdown = document.getElementById("quant-attr");
// quantAttrDropdown.addEventListener('change', () => {
//     choropleth.changeQuantAttr(quantAttrDropdown.value);
// });

function changeParliament(newParliament) {
    this.changeParliament(newParliament);
}

function mapZoomed(transform) {
    choroplethUpper.zoomed(transform);
    choroplethLower.zoomed(transform);
}
