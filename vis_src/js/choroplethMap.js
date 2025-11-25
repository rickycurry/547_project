import "./external/d3.v7.js"

// import {Runtime} from "https://cdn.jsdelivr.net/npm/@observablehq/runtime@4/dist/runtime.js";
// import d3_colorLegend from "https://api.observablehq.com/@d3/color-legend.js?v=3";
// import "./external/d3-color-legend.js"

export class ChoroplethMap {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _geoData {Array}
    * @param _candidateData {Array}
    * @param _majorPartiesLookup {Array}
    * @param _rawPartiesLookup {Array}
    * @param _mapZoomCallback {Function}
    */
    constructor(_config, _geoData, _candidateData, _majorPartiesLookup, _rawPartiesLookup, _mapZoomCallback) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            margin: _config.margin || {top: 10, right: 10, bottom: 10, left: 10},
            tooltipPadding: _config.tooltipPadding || 10,
        }

        this.currentParliament = _config.currentParliament || 44;
        this.currentByElection = _config.currentByElection || 0;

        this.candidatesGroupedByParliament = d3.group(_candidateData, d => d.parliament);
        this.ros = _geoData;
        this.majorPartiesLookup = _majorPartiesLookup;
        this.rawPartiesLookup = new Map();
        _rawPartiesLookup.forEach(d => this.rawPartiesLookup.set(d.id, d.party));
        this.mapZoomCallback = _mapZoomCallback;

        // this.projection = d3.geoMercator();
        this.projection = d3.geoConicConformal()
            .parallels([30, 30])
            .rotate([91.86, -63.390675]);

        this.path = d3.geoPath()
            .projection(this.projection);
        
        this.zoom = d3.zoom()
            .scaleExtent([1, 40])
            .on("zoom", (event) => this.mapZoomCallback(event));

        this.tooltipBodyFn = () => "";
        
        this.initVis();
    }

    changeQuantAttr(attr) {
        this.quantAttr = attr;
        this.updateVis();
    }

    changeDate(newDate) {
        let vis = this;
        vis.currentParliament = vis.dateParliamentMap.get(newDate.valueOf());
        vis.updateVis();
    }

    initVis() {
        let vis = this;

        const sliderDiv = document.getElementById(vis.config.parentElement);
        vis.width = sliderDiv.offsetWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = sliderDiv.offsetHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of SVG drawing area
        vis.svg = d3.select(`#${vis.config.parentElement}`)
            .append('svg')
            .attr('width', '98%')
            .attr('height', '98%')
            .attr('viewBox', [0, 0, vis.width, vis.height]);

        // SVG Group containing the actual chart
        vis.chart = vis.svg.append('g')
            .classed("chart", true)
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);;

        // TODO: figure out how to restrict the pan extents to this initial bounds.
        // Possibly d3-zoom.translateExtent?
        // Initially frame the map to fit everything in the final RO
        vis.projection.fitExtent([[0, 0], [vis.width, vis.height]], 
                                 vis.ros[vis.ros.length - 1]);
        vis.svg.call(vis.zoom);

        // This will change in the future depending on which "mode" the map is in, perhaps
        vis.colourScheme = d3.interpolateBlues;

        vis.dateParliamentMap = new Map();
        vis.candidatesGroupedByParliament.forEach((candidates, parliament) => {
            vis.dateParliamentMap.set(candidates[0].edate.valueOf(), parliament);
        });

        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        vis.filterCandidates();
        vis.selectRO();
        vis.initValueMap();
        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        vis.chart.selectAll("path")
            .data(vis.ros[vis.currentRoIdx].features, d => d.properties.fedname)
            .join("path")
                .attr("d", vis.path)
                .attr("debugname", d => d.properties.fedname)
                .attr("fill", d => vis.getColour(d))
            .on("mousemove", (event, d) => {
                d3.select('#map-tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('bottom', (window.innerHeight - event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`<div class="tooltip-title">${d.properties.fedname}</div>
                           <div class="tooltip-body">${vis.tooltipBodyFn(d)}`);
            })
            .on('mouseleave', () => { d3.select('#map-tooltip').style('display', 'none'); });

        // TODO: get legend working. Probably need to create my own class for it...
        // renderLegend(vis.chart, vis.colourScale);
    }

    zoomed(event) {
        const {transform} = event;
        this.chart.attr("transform", transform);
    }

    filterCandidates() {
        // We only want to update the FEDs that changed in the by-election cycle.
        let vis = this;
        vis.filteredCandidates = vis.candidatesGroupedByParliament.get(vis.currentParliament);
        if (vis.currentByElection === 0) {
            vis.filteredCandidates = vis.filteredCandidates.filter(d => d.type_elxn === vis.currentByElection);
        }
        else {
            // TODO: implement
        }
    }

    selectRO() {
        let vis = this;
        vis.currentRoIdx = 0;
        // By now, candidates should be filtered to just one single parliament (and RO)
        const roYear = vis.filteredCandidates[0].ro.toString();
        for (const [i, ro] of vis.ros.entries()) {
            if (ro.name.substring(3) === roYear) {
                vis.currentRoIdx = i;
                break;
            }
        }
    }

    initValueMap() {
        let vis = this;

        switch (vis.quantAttr) {
            case "margin":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => {
                        if (v.length <= 1) {
                            return null;
                        }
                        v.sort((a, b) => b.percent_votes - a.percent_votes);
                        return v[0].percent_votes - v[1].percent_votes;
                    }, 
                    d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = vis.filteredCandidates.filter(c => c.fed_id === fedIdInt);
                    fedCandidates.sort((a, b) => b.percent_votes - a.percent_votes);
                    const margin = `Margin of victory: ${Math.round(vis.valueMap.get(fedIdInt))}%`;
                    const candidateStrings = fedCandidates.map(c => `${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${Math.round(c.percent_votes)}%`);
                    return margin + '\n' + candidateStrings.join('\n');
                };
                break;

            case "non-male":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => {
                        const nonMaleCount = v.filter(d => d.gender !== 'M').length;
                        return nonMaleCount / v.length;
                    },
                    d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = vis.filteredCandidates.filter(c => c.fed_id === fedIdInt);
                    const candidateStrings = fedCandidates.map(c => {
                        return c.gender === 'M' ? `${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${c.gender}` 
                                                : `<b>${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${c.gender}</b>`
                    });
                    return candidateStrings.join('\n');
                };
                break;
                
            case "indigenous":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => {
                        const indigenousCount = v.filter(d => d.indigenousorigins === 1).length;
                        return indigenousCount / v.length;
                    },
                    d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = vis.filteredCandidates.filter(c => c.fed_id === fedIdInt);
                    const candidateStrings = fedCandidates.map(c => {
                        return c.indigenousorigins ? `<b>${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)})</b>` : `${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)})`;
                    });
                    return candidateStrings.join('\n');
                };
                break;

            case "age":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => d3.mean(v, d => d.age_at_election), d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    // NOTE: we basically only have age data for winners, not all candidates!
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = vis.filteredCandidates.filter(c => c.fed_id === fedIdInt);
                    const candidateStrings = fedCandidates.map(c => `${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${isNaN(c.age_at_election) ? "unknown" : c.age_at_election}`);
                    return candidateStrings.join('\n');
                };
                break;

            case "count":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => v.length, d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = vis.filteredCandidates.filter(c => c.fed_id === fedIdInt);
                    const candidateCountStr = `${fedCandidates.length} candidates\n• `
                    const candidateStrings = fedCandidates.map(c => `${c.elected ? '<b>' : ''}${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)})${c.elected ? '</b>' : ''}`);
                    return candidateCountStr + candidateStrings.join('\n• ');
                };
                break;

            case "outcome":
            default:
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => {
                        const winners = v.filter(d => d.elected === 1);
                        // TODO: can we deal with multi-seat FEDS somehow?
                        return winners.length > 0 ? winners[0].party_major_group_cleaned : null;
                    },
                    d => d.fed_id);
                vis.colourScale = d3.scaleOrdinal(
                    vis.majorPartiesLookup.map(d => d.id),
                    vis.majorPartiesLookup.map(d => d.colour))
                    .unknown('#000');
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = vis.filteredCandidates.filter(c => c.fed_id === fedIdInt);
                    fedCandidates.sort((a, b) => b.percent_votes - a.percent_votes);
                    const candidateStrings = fedCandidates.map(c => `${c.elected ? '<b>' : ''}${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${Math.round(c.percent_votes)}%${c.elected ? '</b>' : ''}`);
                    return candidateStrings.join('\n');
                };
                // Early out here so we don't set the sequential colour scale below
                return
        }
        let min = d3.least(vis.valueMap.values());
        let max = d3.greatest(vis.valueMap.values());
        vis.colourScale = d3.scaleSequential([min, max], vis.colourScheme);
    }

    getColour(datum) {
        let vis = this;
        const idInt = parseInt(datum.properties.id);
        const value = vis.valueMap.get(idInt);
        return vis.colourScale(value);
    }
}

async function renderLegend(el, colourScale) {
    const legend = Legend(colourScale, {title: 'Test legend'});
    console.log(legend);
}