import "./external/d3.v7.js";
import { ChoroplethMap } from "./choroplethMap.js"
import { TimelineSlider } from "./timelineSlider.js"
import { Barplot } from "./barplot.js"
import { Heatmap } from "./heatmap.js";
import { GeoSelector } from "./geoSelector.js";

// Static data...
let ros, candidates, partiesMajor, partiesRaw, fedHierarchy, historicOverlaps, provinces, occupations;
let parliamentROMapping;
// Vis instances...
let choroplethUpper, choroplethLower;
let timelineSliderUpper, timelineSliderLower;
let barPlotUpper, barPlotLower;
let heatmap;
let selector;
// Current state...
let selectedGeography = new Set();

const roRoot = "../data/feds/mapshaper_simplified_rewound_4326/";

async function loadROData(year) {
    return d3.json(`${roRoot}ro_${year}.geojson`);
}

async function loadCandidates() {
    candidates = await d3.csv('../data/candidates/candidates_final.csv', d3.autoType);
    const ro_years = new Set(d3.map(candidates, d => d.ro));
    parliamentROMapping = new Map();
    candidates.forEach(d => {
        if (!parliamentROMapping.has(d.parliament)) {
            parliamentROMapping.set(d.parliament, d.ro);
        }
    });
    // console.log(parliamentROMapping);
    return Array.from(ro_years);
}

async function loadData() {
    const ro_years = await loadCandidates();
    ros = await loadROs(ro_years);
    // Convert all FED IDs to string for consistency (some are string, some are numbers)
    ros.forEach(ro => ro.features.forEach(fed => {
        if (typeof fed.properties.id !== 'string') {
            fed.properties.id = fed.properties.id.toString();
        }}));
    fedHierarchy = await d3.json('../data/fed_hierarchy_complete.json');
    historicOverlaps = await d3.json('../data/feds/historic_overlaps.json');
    // console.log(historicOverlaps);
    partiesMajor = await d3.csv('../data/candidates/lookup_tables/parties_major.csv', d3.autoType);
    partiesRaw = await d3.csv('../data/candidates/lookup_tables/parties_raw.csv', d3.autoType);
    occupations = await d3.csv('../data/candidates/lookup_tables/occupation_category.csv', d3.autoType);
    provinces = await d3.csv('../data/candidates/lookup_tables/provinces.csv', d3.autoType);
}

async function loadROs(ro_years) {
    return Promise.all(ro_years.map(loadROData));
}

async function main() {
    await loadData();
    choroplethUpper = new ChoroplethMap({parentElement: 'choroplethdiv-upper', currentParliament: 1}, ros, candidates, partiesMajor, partiesRaw, mapZoomed, parliamentROMapping);
    choroplethLower = new ChoroplethMap({parentElement: 'choroplethdiv-lower'}, ros, candidates, partiesMajor, partiesRaw, mapZoomed, parliamentROMapping);
    timelineSliderUpper = new TimelineSlider({parentElement: 'sliderdiv-upper', isUpper: true, margin: {top: 40, right: 70, bottom: 5, left: 78}, initializeMin: true}, candidates, changeParliament.bind(choroplethUpper));
    timelineSliderLower = new TimelineSlider({parentElement: 'sliderdiv-lower', isUpper: false, margin: {top: 5, right: 70, bottom: 30, left: 78}}, candidates, changeParliament.bind(choroplethLower));
    barPlotUpper = new Barplot({parentElement: 'barplotdiv-upper', currentParliament: 1}, candidates, partiesMajor, occupations, provinces, changeAggregationAttr);
    barPlotLower = new Barplot({parentElement: 'barplotdiv-lower', currentParliament: 44, isLower: true}, candidates, partiesMajor, occupations, provinces, changeAggregationAttr);
    heatmap = new Heatmap({parentElement: 'heatmapdiv'}, candidates, partiesMajor, partiesRaw, changeAOI);
    selector = new GeoSelector({parentElement: 'selectordiv'}, fedHierarchy, geoSelectionChanged);
}

main();

function changeParliament(newParliament, isUpper) {
    const historicSelectedGeography = transformSelectedGeoToHistoricRO(parliamentROMapping.get(newParliament));
    const selectedParliaments = new Set([timelineSliderUpper.currentParliament, timelineSliderLower.currentParliament]);
    heatmap.changeParliaments(selectedParliaments);
    if (isUpper) {
        barPlotUpper.changeParliament(newParliament, historicSelectedGeography, selectedGeography.size > 0);
        choroplethUpper.changeParliament(newParliament, historicSelectedGeography);
    } else {
        barPlotLower.changeParliament(newParliament, historicSelectedGeography, selectedGeography.size > 0);
        choroplethLower.changeParliament(newParliament, historicSelectedGeography);
    }
}

function changeAggregationAttr() {
    barPlotLower.changeAggregationAttr();
    barPlotUpper.changeAggregationAttr();
}

function changeAOI(aoiString) {
    console.log(aoiString);
    choroplethLower.changeAOI(aoiString);
    choroplethUpper.changeAOI(aoiString);
    barPlotLower.changeAOI(aoiString);
    barPlotUpper.changeAOI(aoiString);
}

function mapZoomed(transform) {
    choroplethUpper.zoomed(transform);
    choroplethLower.zoomed(transform);
}

function geoSelectionChanged(geography, wasAdded) {
    selectedGeography = wasAdded ? selectedGeography.union(geography) : selectedGeography.difference(geography);
    // Update maps to show highlighting.
    const upperTransformedGeo = transformSelectedGeoToHistoricRO(parliamentROMapping.get(choroplethUpper.currentParliament))
    const lowerTransformedGeo = transformSelectedGeoToHistoricRO(parliamentROMapping.get(choroplethLower.currentParliament))
    choroplethUpper.changeSelectedFEDs(upperTransformedGeo);
    choroplethLower.changeSelectedFEDs(lowerTransformedGeo);
    barPlotUpper.changeSelectedFEDs(upperTransformedGeo, selectedGeography.size > 0);
    barPlotLower.changeSelectedFEDs(lowerTransformedGeo, selectedGeography.size > 0);
    // Also send all the ROs' transformed selected geography to the heatmap.
    if (selectedGeography.size === 0) {
        heatmap.changeSelectedGeography(null);
    } else {
        const allTransformedSelectedGeo = new Map();
        ros.forEach(ro => {
            const roNumber = Number(ro.name.slice(-4));
            const transformedFedsAsStrings = transformSelectedGeoToHistoricRO(roNumber);
            allTransformedSelectedGeo.set(roNumber, new Set(Array.from(transformedFedsAsStrings).map(d => Number(d))));
        });
        heatmap.changeSelectedGeography(allTransformedSelectedGeo);
    }
    
}

function transformSelectedGeoToHistoricRO(ro) {
    if (ro === 2013) {
        return selectedGeography;
    }
    const historicSelectedGeography = new Set();
    const roFedMapping = historicOverlaps[ro];
    selectedGeography.forEach(fed => {
        const overlappedHistoricFeds = roFedMapping[fed];
        overlappedHistoricFeds.forEach(historicFed => historicSelectedGeography.add(historicFed));
    });
    return historicSelectedGeography;
}
