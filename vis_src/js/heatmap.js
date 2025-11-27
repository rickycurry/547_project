import "./external/d3.v7.js"

export class Heatmap {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    * @param _majorPartiesLookup {Array}
    * @param _rawPartiesLookup {Array}
    */
    constructor(_config, _candidateData, _majorPartiesLookup, _rawPartiesLookup) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            margin: _config.margin || {top: 0, right: 10, bottom: 10, left: 60},
            tooltipPadding: _config.tooltipPadding || 10,
        }

        this.currentParliament = _config.currentParliament || 44;
        this.currentByElection = _config.currentByElection || 0;

        this.candidates = _candidateData.filter(d => d.type_elxn === this.currentByElection);
        this.majorPartiesLookup = _majorPartiesLookup;
        this.rawPartiesLookup = new Map();
        _rawPartiesLookup.forEach(d => this.rawPartiesLookup.set(d.id, d.party));

        this.tooltipBodyFn = () => "";
        
        this.initVis();
    }

    initVis() {
        let vis = this;

        const sliderDiv = document.getElementById(vis.config.parentElement);
        vis.widthMultiplier = 0.93;
        vis.width = (sliderDiv.offsetWidth * vis.widthMultiplier) - vis.config.margin.left - vis.config.margin.right;
        vis.height = sliderDiv.offsetHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of SVG drawing area
        vis.svg = d3.select(`#${vis.config.parentElement}`)
            .append('svg')
            .attr('width', `${vis.widthMultiplier * 100}%`)
            .attr('height', '100%')
            .attr('viewBox', [0, 0, vis.width, vis.height]);

        // SVG Group containing the actual chart
        vis.chart = vis.svg.append('g')
            .classed("chart", true)
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.rowLabels = ['Outcome', 'Non-male', 'Indigenous', 'Age', 'Count'];

        // This will change in the future depending on which "mode" the map is in, perhaps
        vis.colourScheme = d3.interpolateBlues;

        const parliaments = Array.from(new d3.InternSet(vis.candidates, d => d.parliament), d => d.parliament);
        console.log(parliaments);
        vis.x = d3.scaleBand()
            .domain(parliaments)
            .range([0, vis.width])
            .padding(0.02);
        vis.chart.append("g")
            .call(d3.axisBottom(vis.x));

        vis.y = d3.scaleBand()
            .domain(vis.rowLabels)
            .range([0, vis.height])
            .padding(0.02);
        vis.chart.append("g")
            // .attr('transform', `translate(${50}, 0)`)
            .call(d3.axisLeft(vis.y));

        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        // vis.filterGeography(); TODO
        vis.initData();
        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        vis.chart.selectAll()
            .data(vis.data)
            .join('rect')
            .attr('y', d => vis.y(d.rowLabel))
            .attr('x', d => vis.x(d.parliament))
            .attr('width', vis.x.bandwidth())
            .attr('height', vis.y.bandwidth())
            .style('fill', d => vis.colourScales.get(d.rowLabel)(d.val))
            .on("mousemove", (event, d) => {
                d3.select('#map-tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('bottom', (window.innerHeight - event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`<div class="tooltip-title">${d.parliament}</div>`);
            })
            .on('mouseleave', () => { d3.select('#map-tooltip').style('display', 'none'); });;

        // TODO: get legend working. Probably need to create my own class for it...
        // renderLegend(vis.chart, vis.colourScale);
    }

    initData() {
        let vis = this;

        vis.data = [];
        vis.colourScales = new Map();
        // Will combine outcome and margin eventually. For now, calculate vote share for the winning party??
        const winningPartyPopularVote = d3.rollups(vis.candidates, D => {
                const winningParty = D[0].gov_major_group;
                const allVotes = D.reduce((acc, candidate) => acc + candidate.votes, 0);
                const winningPartyVotes = D.filter(d => d.party_major_group_cleaned === winningParty)
                                           .reduce((acc, candidate) => acc + candidate.votes, 0);
                return winningPartyVotes / allVotes;
            }, d => d.parliament);
        winningPartyPopularVote.forEach(d => vis.data.push({val: d[1], parliament: d[0], rowLabel: 'Outcome'}));
        vis.colourScales.set('Outcome', d3.scaleSequential([
                d3.min(winningPartyPopularVote, d => d[1]),
                d3.max(winningPartyPopularVote, d => d[1])
            ], vis.colourScheme));

        const nonMale = d3.rollups(vis.candidates, 
                                   D => D.filter(d => d.gender !== 'M').length / D.length,
                                   d => d.parliament);
        nonMale.forEach(d => vis.data.push({val: d[1], parliament: d[0], rowLabel: 'Non-male'}));
        vis.colourScales.set('Non-male', d3.scaleSequential([
                d3.min(nonMale, d => d[1]),
                d3.max(nonMale, d => d[1])
            ], vis.colourScheme));

        const indigenous = d3.rollups(vis.candidates, 
                                      D => D.filter(d => d.indigenousorigins === 1).length / D.length,
                                      d => d.parliament);
        indigenous.forEach(d => vis.data.push({val: d[1], parliament: d[0], rowLabel: 'Indigenous'}));
        vis.colourScales.set('Indigenous', d3.scaleSequential([
                d3.min(indigenous, d => d[1]),
                d3.max(indigenous, d => d[1])
            ], vis.colourScheme));        

        const age = d3.rollups(vis.candidates, 
                               D => d3.mean(D, d => d.age_at_election),
                               d => d.parliament);
        age.forEach(d => vis.data.push({val: d[1], parliament: d[0], rowLabel: 'Age'}));
        vis.colourScales.set('Age', d3.scaleSequential([
                d3.min(age, d => d[1]),
                d3.max(age, d => d[1])
            ], vis.colourScheme));        

        const count = d3.rollups(vis.candidates, D => {
                // D contains all candidates for a given election.
                // We want to now group by FED and take the mean (ignoring FEDs with 0 candidates).
                const fedCandidateCounts = d3.rollups(D, 
                                                      E => E.length > 0 ? E.length : null, 
                                                      e => e.fed_id);
                return d3.mean(fedCandidateCounts, e => e[1]);
            }, d => d.parliament);
        count.forEach(d => vis.data.push({val: d[1], parliament: d[0], rowLabel: 'Count'}));
        vis.colourScales.set('Count', d3.scaleSequential([
                d3.min(count, d => d[1]),
                d3.max(count, d => d[1])
            ], vis.colourScheme));
    }

    // getColour(datum) {
    //     let vis = this;
    //     const idInt = parseInt(datum.properties.id);
    //     const value = vis.valueMap.get(idInt);
    //     return vis.colourScale(value);
    // }
}

async function renderLegend(el, colourScale) {
    const legend = Legend(colourScale, {title: 'Test legend'});
    console.log(legend);
}