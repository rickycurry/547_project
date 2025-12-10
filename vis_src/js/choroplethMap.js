import "./external/d3.v7.js"

export class ChoroplethMap {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _geoData {Array}
    * @param _candidateData {Array}
    * @param _majorPartiesLookup {Array}
    * @param _rawPartiesLookup {Array}
    * @param _mapZoomCallback {Function}
    * @param _parliamentROMap {Map}
    */
    constructor(_config, _geoData, _candidateData, _majorPartiesLookup, _rawPartiesLookup, _mapZoomCallback, _parliamentROMap) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            margin: _config.margin || {top: 10, right: 10, bottom: 10, left: 10},
            tooltipPadding: _config.tooltipPadding || 10,
            maxZoom: _config.maxZoom || 60,
            transitionDuration: _config.transitionDuration || 750,
        }

        this.currentParliament = _config.currentParliament || 44;
        this.currentByElection = _config.currentByElection || 0;

        this.candidatesGroupedByParliament = d3.group(_candidateData, d => d.parliament);
        this.ros = _geoData;
        this.parliamentROMap = _parliamentROMap;
        this.majorPartiesLookup = _majorPartiesLookup;
        this.rawPartiesLookup = new Map();
        _rawPartiesLookup.forEach(d => this.rawPartiesLookup.set(d.id, d.party));
        this.mapZoomCallback = _mapZoomCallback;
        this.selectedFeds = new Set();
        this.selectedGroup = "all";

        this.projection = d3.geoConicConformal()
            .parallels([30, 30])
            .rotate([91.86, -63.390675]);

        this.path = d3.geoPath()
            .projection(this.projection);
        
        this.zoom = d3.zoom()
            .scaleExtent([1, this.config.maxZoom])
            .on("zoom", (event) => this.mapZoomCallback(event));

        this.tooltipBodyFn = () => "";
        
        this.initVis();
    }

    changeAOI(aoiString) {
        this.quantAttr = aoiString;
        this.updateVis();
    }

    changeParliament(newParliament, newSelectedGeography) {
        let vis = this;
        vis.currentParliament = newParliament;
        vis.selectedFeds = newSelectedGeography;
        vis.updateVis();
    }

    // one of "all" or "win"
    changeSelectedGroup(selectedGroup) {
        let vis = this;
        vis.selectedGroup = selectedGroup;
        vis.updateVis();
    }

    changeSelectedFEDs(selectedFedsSet) {
        let vis = this;
        vis.selectedFeds = selectedFedsSet;
        // Get all the paths from the last RO, but don't render them -- 
        // we just want to figure out the total bounding box containing all of them.
        // Most of the zoom math code taken directly from 
        // https://observablehq.com/@d3/zoom-to-bounding-box?collection=%40d3%2Fd3-zoom
        if (selectedFedsSet.size === 0) {
            vis.svg.transition()
                .duration(vis.config.transitionDuration)
                .call(
                    vis.zoom.transform,
                    d3.zoomIdentity,
                    d3.zoomTransform(vis.svg.node()).invert([vis.width / 2, vis.height / 2])
                );
            vis.renderVis();
            return;
        }

        const finalRo = vis.ros[vis.ros.length - 1];
        const features = finalRo.features.filter(d => selectedFedsSet.has(d.properties.id));
        let xMin = Infinity, yMin = Infinity;
        let xMax = -Infinity, yMax = -Infinity;
        features.forEach(feature => {
            const [[x0, y0], [x1, y1]] = vis.path.bounds(feature);
            xMin = Math.min(xMin, x0);
            yMin = Math.min(yMin, y0);
            xMax = Math.max(xMax, x1);
            yMax = Math.max(yMax, y1);
        });

        vis.svg.transition()
            .duration(vis.config.transitionDuration)
            .call(
                vis.zoom.transform,
                d3.zoomIdentity
                    .translate(vis.width / 2, vis.height / 2)
                    .scale(Math.min(vis.config.maxZoom, 0.9 / Math.max((xMax - xMin) / vis.width, (yMax - yMin) / vis.height)))
                    .translate(-(xMin + xMax) / 2, -(yMin + yMax) / 2)
            );
        vis.renderVis();
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
        vis.colourScheme = d3.interpolateYlGn;

        vis.legendSvg = d3.select(`#${vis.config.parentElement}`)
            .append('svg')
            .classed('legend', true)
            .attr('width', '17%')
            .attr('height', '47%')
            .style('left', `${0.82 * vis.width}px`)
            .style('top', `${-1.05 * vis.height}px`);

        vis.legendG = vis.legendSvg.append('g')
            .attr('width', '100%')
            .classed('legend-g', true);

        // semi-transparent background
        vis.legendG.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', '#eee')
            .attr('fill-opacity', '85%');

        vis.legendTitle = vis.legendG.append('text')
            .attr('x', '50%')
            .attr('y', '18px')
            .classed('legend-title', true);

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
                .classed("selected", d => vis.selectedFeds.has(d.properties.id))
            .on("mousemove", (event, d) => {
                d3.select('#map-tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('bottom', (window.innerHeight - event.pageY + vis.config.tooltipPadding) + 'px')
                    .style('top', '')
                    .style('right', '')
                    .html(`<div class="tooltip-title">${d.properties.fedname}</div>
                           <div class="tooltip-body">${vis.tooltipBodyFn(d)}`);
            })
            .on('mouseleave', () => { d3.select('#map-tooltip').style('display', 'none'); });

        vis.renderLegend();
    }

    renderLegend() {
        let vis = this;
        vis.legendTitle.text(vis.getLegendTitle());
        const isSequential = Object.hasOwn(vis.colourScale, 'clamp');
        if (!isSequential) {
            // filter by parties that actually appear in our election
            const partiesInThisElection = new Set(vis.filteredCandidates.map(d => d.party_major_group_cleaned));
            const filteredDomain = vis.colourScale.domain().filter(d => partiesInThisElection.has(d));
            vis.ordinalLegend(filteredDomain, d => vis.majorPartiesLookup[d].party);
            return;
        }
        // special case if min === max 
        const domain = vis.colourScale.domain();
        if (domain[0] === domain[1]) {
            // Treat this as in the ordinal case
            vis.ordinalLegend([domain[0]], d => `${Math.round(d * 100)}%`);
            return;
        }
        // Normal sequential range case.
        // Draw a bar that will be the same total height as our max ordinal legend size.
        const steps = 7 * 12 - 1; // max ordinal squares times size of squares.
        const domainStepSize = (domain[1] - domain[0]) / steps;
        let startingDomain = domain[1]; // work down from the top
        const domainSteps = [];
        for (let i = 0; i <= steps; i++) {
            domainSteps.push(startingDomain);
            startingDomain -= domainStepSize;
        }
        vis.legendG.selectAll('g')
            .data(domainSteps)
            .join('g')
            .attr('transform', (d, i) => `translate (3, ${43 + i})`)
            .each(function(d) {
                let parentG = d3.select(this);
                let rect = parentG.select('rect');
                if (rect.empty()) {
                    rect = parentG.append('rect');
                }
                rect.attr('x', 5)
                    .attr('y', 0)
                    .attr('width', 20)
                    .attr('height', 1)
                    .attr('fill', vis.colourScale(d));

                let text = parentG.select('text');
                if (!text.empty()) {
                    text.text('');
                }
            }).classed('legend-entry', false);

        vis.legendYAxisScale.range([steps, 0]);
        vis.legendG.append("g")
            .attr('transform', 'translate(30, 43.5)')
            .call(vis.legendYAxis);
    }

    ordinalLegend(domainData, textMappingFn) {
        let vis = this;
        vis.legendG.selectAll('g')
            .data(domainData)
            .join('g')
            .attr('transform', (d, i) => `translate(3, ${43 + 12 * i})`)
            .each(function(d) {
                let parentG = d3.select(this);
                let rect = parentG.select('rect');
                if (rect.empty()) {
                    rect = parentG.append('rect');
                }
                rect.attr('x', 5)
                    .attr('y', 1)
                    .attr('width', 10)
                    .attr('height', 10)
                    .attr('fill', vis.colourScale(d));

                let text = parentG.select('text');
                if (text.empty()) {
                    text = parentG.append('text');
                }
                text.attr('x', 20)
                    .attr('y', 1)
                    .attr('dy', '9px')
                    .text(textMappingFn(d));
            }).classed('legend-entry', true);
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
        const roYear = vis.parliamentROMap.get(vis.currentParliament).toString();
        vis.currentRoIdx = vis.ros.map(ro => ro.name.slice(-4)).indexOf(roYear);
    }

    getLegendTitle() {
        let vis = this;
        const isCandidateMode = vis.selectedGroup === "all";
        switch (vis.quantAttr) {
            case "Non-male": return "Percent \nnon-male";
            case "Indigenous": return "Percent \nindigenous";
            case "Age": return `Average \n${isCandidateMode ? 'candidate' : 'winner'} age`;
            case "Count": return `Number of \n${isCandidateMode ? 'candidates' : 'winners'}`;
            case "Vote share": return "Victory\nmargin"
            default: return "Winning \nparty"; 
        }
    }

    initValueMap() {
        let vis = this;

        let attributeIsProportion = false;
        const isCandidateMode = vis.selectedGroup === "all";
        const possiblyFilteredByGroup = isCandidateMode ? vis.filteredCandidates : vis.filteredCandidates.filter(d => d.elected);
        switch (vis.quantAttr) {
            case "Vote share":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => {
                        if (v.length < 1) {
                            return null;
                        }
                        if (v.length === 1) {
                            return 100;
                        }
                        v.sort((a, b) => b.percent_votes - a.percent_votes);
                        // return difference between top two candidates
                        return v[0].percent_votes - v[1].percent_votes;
                    }, 
                    d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = vis.filteredCandidates.filter(c => c.fed_id === fedIdInt);
                    fedCandidates.sort((a, b) => b.percent_votes - a.percent_votes);
                    const margin = `Margin of victory: ${Math.round(vis.valueMap.get(fedIdInt))}%`;
                    const candidateStrings = fedCandidates.map(c => `${c.elected ? '<b>' : ''}${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${Math.round(c.percent_votes)}%${c.elected ? '</b>' : ''}`);
                    return margin + '\n' + candidateStrings.join('\n');
                };
                break;

            case "Non-male":
                vis.valueMap = d3.rollup(possiblyFilteredByGroup, v => {
                        const nonMaleCount = v.filter(d => d.gender !== 'M').length;
                        return nonMaleCount / v.length;
                    },
                    d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = possiblyFilteredByGroup.filter(c => c.fed_id === fedIdInt);
                    const percentNonMale = `${Math.round(vis.valueMap.get(fedIdInt) * 100)}% of ${isCandidateMode ? 'candidates' : 'winners'} are non-male:`
                    const candidateStrings = fedCandidates.map(c => `${c.gender !== 'M' ? '<b>' : ''}${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${c.gender}${c.gender !== 'M' ? '</b>' : ''}`);
                    return percentNonMale + '\n' + candidateStrings.join('\n');
                };
                attributeIsProportion = true;
                break;
                
            case "Indigenous":
                vis.valueMap = d3.rollup(possiblyFilteredByGroup, v => {
                        const indigenousCount = v.filter(d => d.indigenousorigins === 1).length;
                        return indigenousCount / v.length;
                    },
                    d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = possiblyFilteredByGroup.filter(c => c.fed_id === fedIdInt);
                    const percentIndigenous = `${Math.round(vis.valueMap.get(fedIdInt) * 100)}% of ${isCandidateMode ? 'candidates' : 'winners'} have indigenous origins:`
                    const candidateStrings = fedCandidates.map(c => `${c.indigenousorigins ? '<b>' : ''}${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)})${c.indigenousorigins ? '</b>' : ''}`);
                    return percentIndigenous + '\n' + candidateStrings.join('\n');
                };
                attributeIsProportion = true;
                break;

            case "Age":
                vis.valueMap = d3.rollup(possiblyFilteredByGroup, v => d3.mean(v, d => d.age_at_election), d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    // NOTE: we basically only have age data for winners, not all candidates!
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = possiblyFilteredByGroup.filter(c => c.fed_id === fedIdInt);
                    const averageAge = Math.round(vis.valueMap.get(fedIdInt))
                    const averageAgeStr = `Average age of ${isCandidateMode ? 'candidates' : 'winners'}: ${isNaN(averageAge) ? 'unknown' : averageAge}`;
                    const candidateStrings = fedCandidates.map(c => `${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)}) — ${c.age_at_election === null ? "unknown" : c.age_at_election}`);
                    return averageAgeStr + '\n' + candidateStrings.join('\n');
                };
                break;

            case "Count":
                vis.valueMap = d3.rollup(possiblyFilteredByGroup, v => v.length, d => d.fed_id);
                vis.tooltipBodyFn = d => {
                    const fedIdInt = parseInt(d.properties.id);
                    const fedCandidates = possiblyFilteredByGroup.filter(c => c.fed_id === fedIdInt);
                    const candidateCountStr = `${fedCandidates.length} ${isCandidateMode ? 'candidate' : 'winner'}(s)\n`
                    const candidateStrings = fedCandidates.map(c => `${c.elected ? '<b>' : ''}${c.candidate_name_cleaned} (${this.rawPartiesLookup.get(c.party_raw)})${c.elected ? '</b>' : ''}`);
                    return candidateCountStr + candidateStrings.join('\n');
                };
                break;

            case "Winner and\nseat share":
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
        vis.colourScale = d3.scaleSequential([min, max], vis.colourScheme).nice(5);
        // [0, 1] is a placeholder that will be overwritten later in the render loop
        vis.legendYAxisScale = d3.scaleLinear([min, max], [0, 1]).nice(5);
        vis.legendYAxis = d3.axisRight(vis.legendYAxisScale).ticks(5);
        if (attributeIsProportion) {
            vis.legendYAxis.tickFormat(d3.format(".0%"));
        }
    }

    getColour(datum) {
        let vis = this;
        const idInt = parseInt(datum.properties.id);
        const value = vis.valueMap.get(idInt);
        return vis.colourScale(value);
    }
}
