import "./external/d3.v7.js"

export class Heatmap {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    * @param _majorPartiesLookup {Array}
    * @param _rawPartiesLookup {Array}
    * @param _changeAOICallback {Function}
    */
    constructor(_config, _candidateData, _majorPartiesLookup, _rawPartiesLookup, _changeAOICallback) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            margin: _config.margin || {top: 0, right: 50, bottom: 10, left: 55},
            tooltipPadding: _config.tooltipPadding || 10,
            transitionDuration: _config.transitionDuration || 0,
        }

        this.currentByElection = _config.currentByElection || 0;
        // This gets overwritten with the correct (config) value after our first update
        // to avoid a ridiculous opening animation (all rectangles expand from (0, 0))
        this.transitionDuration = 0;

        this.candidates = _candidateData.filter(d => d.type_elxn === this.currentByElection);
        this.majorPartiesLookup = _majorPartiesLookup;
        this.rawPartiesLookup = new Map();
        this.selectedGeoByRo = null;
        _rawPartiesLookup.forEach(d => this.rawPartiesLookup.set(d.id, d.party));

        this.changeAOICallback = _changeAOICallback;
        this.tooltipBodyFn = () => "";
        
        this.initVis();
    }

    initVis() {
        let vis = this;

        const sliderDiv = document.getElementById(vis.config.parentElement);
        vis.width = sliderDiv.offsetWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = sliderDiv.offsetHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of SVG drawing area
        vis.svg = d3.select(`#${vis.config.parentElement}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', [0, 0, vis.width, vis.height]);

        // SVG Group containing the actual chart
        vis.chart = vis.svg.append('g')
            .classed("chart", true)
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.rowLabels = ['Winner and\nseat share', 'Winner\nvote share', 'Non-male', 'Indigenous', 'Age', 'Count'];

        // This will change in the future depending on which "mode" the map is in, perhaps?
        vis.colourScheme = d3.interpolateBlues;

        const parliaments = Array.from(new d3.InternSet(vis.candidates, d => d.parliament), d => d.parliament);
        vis.x = d3.scaleBand()
            .domain(parliaments)
            // I don't know why this works so well, but it was cutting off the rightmost 2 cells
            // before I subtracted the margins. Margins are already subtracted in vis.width above!!
            // Should revisit as time allows.
            .range([0, vis.width - vis.config.margin.left - vis.config.margin.right])
            .padding(0.02);

        vis.y = d3.scaleBand()
            .domain(vis.rowLabels)
            .range([0, vis.height])
            .padding(0.02);

        vis.yAxis = d3.axisLeft(vis.y);
        vis.chart.append("g")
            .call(vis.yAxis);
            // .style('vertical-align', 'middle');

        vis.updateVis();
    }

    changeSelectedGeography(selectedGeoByRO) {
        let vis = this;
        vis.transitionDuration = vis.config.transitionDuration;
        vis.selectedGeoByRo = selectedGeoByRO;
        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        vis.filterGeography();
        vis.initData();
        vis.renderVis();
    }

    filterGeography() {
        let vis = this;
        if (vis.selectedGeoByRo === null) {
            vis.filteredCandidates = vis.candidates;
        } else {
            vis.filteredCandidates = vis.candidates.filter(d => vis.selectedGeoByRo.get(d.ro).has(d.fed_id));
        }
    }

    renderVis() {
        let vis = this;

        vis.chart.selectAll('rect')
            .data(vis.data, d => `${d.parliament} ${d.rowLabel}`)
            .join('rect')
            .transition().duration(vis.transitionDuration)
            .attr('y', d => vis.cellY(d))
            .attr('x', d => vis.x(d.parliament))
            .attr('width', vis.x.bandwidth())
            .attr('height', d => vis.cellHeight(d))
            .style('fill', d => vis.colourScales.get(d.rowLabel)(d.colourOverride === null ? d.val : d.colourOverride));
        vis.chart.selectAll('rect')
            .on("click", (event, d) => vis.changeAOICallback(d.rowLabel))
            .on("mousemove", (event, d) => {
                d3.select('#map-tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('bottom', (window.innerHeight - event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`<div class="tooltip-title">${d.parliament}</div>`);
                })
            .on('mouseleave', () => { d3.select('#map-tooltip').style('display', 'none'); });

        // TODO: get legend working. Probably need to create my own class for it...
        // renderLegend(vis.chart, vis.colourScale);
    }

    cellHeight(d) {
        let vis = this;
        if (d.scaleHeight) {
            return vis.y.bandwidth() * d.val;
        } else {
            return vis.y.bandwidth();
        }
    }

    cellY(d) {
        let vis = this;
        if (d.scaleHeight) {
            return vis.y(d.rowLabel) + (vis.y.bandwidth() * (1 - d.val));
        } else {
            return vis.y(d.rowLabel);
        }
    }

    initData() {
        let vis = this;

        vis.data = [];
        vis.colourScales = new Map();
        // Will combine outcome and margin eventually. For now, calculate vote share for the winning party??
        let rowIdx = 0;

        const winnerAndSeatShare = d3.rollups(vis.filteredCandidates, D => {
                const winningParty = D[0].gov_major_group;
                const allSeats = D.reduce((acc, candidate) => acc + candidate.elected, 0);
                const winningPartySeats = D.filter(d => d.party_major_group_cleaned === winningParty)
                                           .reduce((acc, candidate) => acc + candidate.elected, 0);
                return {seatShare: winningPartySeats / allSeats, winningParty: winningParty};
            }, d => d.parliament);
        // console.log(winnerAndSeatShare);
        winnerAndSeatShare.forEach(d => vis.data.push({
            val: d[1].seatShare, 
            parliament: d[0],
            rowLabel: vis.rowLabels[rowIdx], 
            scaleHeight: true, 
            colourOverride: d[1].winningParty
        }));
        vis.colourScales.set(vis.rowLabels[rowIdx++],
            d3.scaleOrdinal(
                vis.majorPartiesLookup.map(d => d.id),
                vis.majorPartiesLookup.map(d => d.colour))
                .unknown('#000'));

        const winningPartyPopularVote = d3.rollups(vis.filteredCandidates, D => {
                const winningParty = D[0].gov_major_group;
                const allVotes = D.reduce((acc, candidate) => acc + candidate.votes, 0);
                const winningPartyVotes = D.filter(d => d.party_major_group_cleaned === winningParty)
                                           .reduce((acc, candidate) => acc + candidate.votes, 0);
                return winningPartyVotes / allVotes;
            }, d => d.parliament);
        winningPartyPopularVote.forEach(d => vis.data.push(makeDataEntry(d, vis.rowLabels[rowIdx], true)));
        vis.colourScales.set(vis.rowLabels[rowIdx++], vis.getSequentialScale(winningPartyPopularVote));

        const nonMale = d3.rollups(vis.filteredCandidates, 
                                   D => D.filter(d => d.gender !== 'M').length / D.length,
                                   d => d.parliament);
        nonMale.forEach(d => vis.data.push(makeDataEntry(d, vis.rowLabels[rowIdx])));
        vis.colourScales.set(vis.rowLabels[rowIdx++], vis.getSequentialScale(nonMale));

        const indigenous = d3.rollups(vis.filteredCandidates, 
                                      D => D.filter(d => d.indigenousorigins === 1).length / D.length,
                                      d => d.parliament);
        indigenous.forEach(d => vis.data.push(makeDataEntry(d, vis.rowLabels[rowIdx])));
        vis.colourScales.set(vis.rowLabels[rowIdx++], vis.getSequentialScale(indigenous));        

        const age = d3.rollups(vis.filteredCandidates, 
                               D => d3.mean(D, d => d.age_at_election),
                               d => d.parliament);
        age.forEach(d => vis.data.push(makeDataEntry(d, vis.rowLabels[rowIdx])));
        vis.colourScales.set(vis.rowLabels[rowIdx++], vis.getSequentialScale(age));        

        const count = d3.rollups(vis.filteredCandidates, D => {
                // D contains all candidates for a given election.
                // We want to now group by FED and take the mean (ignoring FEDs with 0 candidates).
                const fedCandidateCounts = d3.rollups(D, 
                                                      E => E.length > 0 ? E.length : null, 
                                                      e => e.fed_id);
                return d3.mean(fedCandidateCounts, e => e[1]);
            }, d => d.parliament);
        count.forEach(d => vis.data.push(makeDataEntry(d, vis.rowLabels[rowIdx])));
        vis.colourScales.set(vis.rowLabels[rowIdx++], vis.getSequentialScale(count));
    }

    getSequentialScale(dataArray) {
        let vis = this;
        return d3.scaleSequential([
                d3.min(dataArray, d => d[1]),
                d3.max(dataArray, d => d[1])
            ], vis.colourScheme);
    }
}

function makeDataEntry(_datum, _label, _scaleHeight = false, _colourOverride = null) {
    return {
        val: _datum[1], 
        parliament: _datum[0], 
        rowLabel: _label, 
        scaleHeight: _scaleHeight, 
        colourOverride: _colourOverride
    };
}
