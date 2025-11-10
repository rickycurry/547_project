import "./external/d3.v7.js";
import "./external/topojson-client.js";
import { ChoroplethMap } from "./choroplethMap.js"
import { TimelineSlider } from "./timelineSlider.js"

let ros, last_ro, candidates;
let choropleth, timelineSlider;

const roRoot = "../data/feds/final/geojson_4326/"

async function loadROData(year) {
    // const rawTopoData = await d3.json('../data/feds/final/topojson_4326/ro_1952.json');
    // console.log("loaded test geojson")
    // test_ro = {}
    // Object.keys(rawTopoData.objects).forEach(key => {
    //     test_ro[key] = topojson.feature(rawTopoData, key);
    // });
    // console.log(test_ro);
    return d3.json(`${roRoot}ro_${year}.geojson`);
}

async function loadCandidates() {
    candidates = await d3.csv('../data/candidates/candidates_final.csv', d3.autoType);
    console.log(candidates);
    const ro_years = new Set(d3.map(candidates, d => d.ro));
    return Array.from(ro_years);
}

async function loadInitialData() {
    const ro_years = await loadCandidates();
    // Load the latest RO first
    last_ro = await loadROData(ro_years.pop());
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
    choropleth = new ChoroplethMap({parentElement: '#choropleth'}, last_ro, candidates);
    timelineSlider = new TimelineSlider({parentElement: '#slider'}, candidates);
    loadRemainingData(remaining_ro_years).then((values) => {
        ros = values;
        console.log(ros);
    });
}

main();

const quantAttrDropdown = document.getElementById("quant-attr");
quantAttrDropdown.addEventListener('change', () => {
    choropleth.changeQuantAttr(quantAttrDropdown.value);
});
