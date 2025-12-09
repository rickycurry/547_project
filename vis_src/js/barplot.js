import "./external/d3.v7.js"

export class Barplot {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    * @param _majorPartiesLookup {Array}
    * @param _occupationsLookup {Array}
    * @param _provincesLookup {Array}
    */
    constructor(_config, _candidateData, _majorPartiesLookup, _occupationsLookup, _provincesLookup) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            margin: _config.margin || {top: 10, right: 10, bottom: 80, left: 30},
            currentParliament: _config.currentParliament || 1,
        }
        
        this.candidates = _candidateData.filter(d => d.type_elxn === 0);
        this.candidatesGroupedByParliament = d3.group(this.candidates, d => d.parliament);
        this.majorPartiesLookup = _majorPartiesLookup;
        this.occupationsLookup = _occupationsLookup;
        this.provincesLookup = _provincesLookup;
        this.currentParliament = this.config.currentParliament;
        this.selectedFeds = new Set();
        this.quantAttr = "Winner and\nseat share";
        this.aggregationAttr = "party_major_group_cleaned";
        this.initVis();
    }

    changeAOI(attr) {
        let vis = this;
        vis.quantAttr = attr;
        if (attr === "Non-male" || attr === "Indigenous") {
            vis.yAxis.tickFormat(d3.format(".0%"));
        } else {
            vis.yAxis.tickFormat(null);
        }
        vis.updateVis();
    }

    changeParliament(newParliament, newSelectedGeography) {
        let vis = this;
        vis.currentParliament = newParliament;
        vis.selectedFeds = new Set(Array.from(newSelectedGeography).map(d => Number(d)));
        vis.updateVis();
    }

    changeSelectedFEDs(selectedFedsSet) {
        let vis = this;
        vis.selectedFeds = new Set(Array.from(selectedFedsSet).map(d => Number(d)));
        vis.updateVis();
    }

    initVis() {
        let vis = this;

        const barplotDiv = document.getElementById(vis.config.parentElement);
        vis.width = barplotDiv.offsetWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = barplotDiv.offsetHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Initialize scales
        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xScale = d3.scaleBand()
            // Same with heatmap -- why does this work so nicely? We shouldn't have to
            // double-subtract margins...
            .range([0, vis.width - vis.config.margin.left - vis.config.margin.right])
            .padding(0.15);
        console.log(vis.xScale.bandwidth());

        // scale for subgroups (all vs win)
        vis.xSub = d3.scaleBand()
            .domain(['all','win'])
            .padding(0.1);
        console.log(vis.xSub.bandwidth());

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickSizeOuter(0);

        vis.colourScale = d3.scaleOrdinal()
            .domain(vis.xSub.domain())
            .range(["#03b6fc", "#fcb103"]);

        vis.svg = d3.select(`#${vis.config.parentElement}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', [0, 0, vis.width, vis.height]);

        vis.chart = vis.svg.append('g')
            .classed("chart", true)
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // create persistent axis groups to update on each render (avoid stacking). 
        // so that means create them here in initVis
        vis.xAxisG = vis.chart.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${vis.height})`);

        vis.yAxisG = vis.chart.append("g")
            .attr("class", "y-axis");

        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        vis.filterCandidates();
        vis.initValueMap();
        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        vis.xScale.domain(vis.data.map(d => d[0]));
        vis.xSub.range([0, vis.xScale.bandwidth()]);
        vis.yScale.domain([0, d3.max(vis.data.map(d => Math.max(d[1].all, d[1].win)))]).nice();

        // update axes
        vis.xAxisG.call(vis.xAxis);
        vis.yAxisG.call(vis.yAxis);

        vis.chart.selectAll('.group-g')
            .data(vis.data, d => d[0])
            .join('g')
            .attr("transform", d => `translate(${vis.xScale(d[0])}, 0)`)
            .attr("debugname", d => d[0])
            .classed('group-g', true)
            .classed('barplot-bar', true)
            .selectAll('rect')
            .data(d => [{agg: d[0], group: 'all', val: d[1].all}, {agg: d[0], group: 'win', val: d[1].win}], d => d.group)
            .join('rect')
            .attr('x', d => vis.xSub(d.group))
            .attr('y', d => vis.yScale(d.val))
            .attr('width', vis.xSub.bandwidth())
            .attr('height', d => vis.yScale(0) - vis.yScale(d.val))
            .attr('fill', d => vis.colourScale(d.group));
            // .on("click", (event, d) => {
            //     vis.selectedRowLabel = d.rowLabel;
            //     vis.changeAOICallback(d.rowLabel);
            //     vis.renderVis();
            // })
        vis.chart.selectAll('rect')
            .on("mousemove", (event, d) => {
                d3.select('#map-tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('bottom', (window.innerHeight - event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`<div class="tooltip-body">${d.val}</div>`);
                })
            .on('mouseleave', () => { d3.select('#map-tooltip').style('display', 'none'); });
    }

    filterCandidates() {
        let vis = this;
        vis.filteredCandidates = vis.candidatesGroupedByParliament.get(vis.currentParliament);
        if (vis.selectedFeds.size > 0) {
            console.log(vis.selectedFeds);
            vis.filteredCandidates = vis.filteredCandidates.filter(d => vis.selectedFeds.has(d.fed_id));
        }
        console.log(vis.filteredCandidates.length);
    }

    initValueMap() {
        let vis = this;
        switch (vis.quantAttr) {
            case "Vote share":
                const totalVotes = d3.sum(vis.filteredCandidates, d => d.votes);
                // const totalWinnerVotes = d3.sum(vis.filteredCandidates.filter(d => d.elected), d => d.votes);
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    return {all: d3.sum(D, d => d.votes) / totalVotes, win: d3.sum(D.filter(d => d.elected), d => d.votes) / totalVotes};
                }, d => d[vis.aggregationAttr]);
                break;
            case "Age":
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    return {all: d3.mean(D, d => d.age_at_election), win: d3.mean(D.filter(d => d.elected), d => d.age_at_election)};
                }, d => d[vis.aggregationAttr]);
                break;
            case "Non-male":
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    const electedOnly = D.filter(d => d.elected);
                    return {
                        all: D.filter(d => d.gender !== 'M').length / D.length, 
                        win: electedOnly.filter(d => d.gender !== 'M').length / electedOnly.length
                    };
                }, d => d[vis.aggregationAttr]);
                break;
            case "Indigenous":
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    const electedOnly = D.filter(d => d.elected);
                    return {
                        all: D.filter(d => d.indigenousorigins).length / D.length, 
                        win: electedOnly.filter(d => d.indigenousorigins).length / electedOnly.length
                    };
                }, d => d[vis.aggregationAttr]);
                break;
            case "Count":
            case "Winner and\nseat share": 
            default:
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    return {all: D.length, win: D.filter(d => d.elected).length};
                }, d => d[vis.aggregationAttr]);
                break;
        }
        
        vis.data.sort((a, b) => a[0] - b[0]);
        vis.data = vis.data.map(d => {
            let mappingArray, mappingKey;
            switch (vis.aggregationAttr) {
                case "province":
                    mappingArray = vis.provincesLookup;
                    mappingKey = "province";
                    break;
                case "party_major_group_cleaned":
                    mappingArray = vis.majorPartiesLookup;
                    mappingKey = "party";
                    break;
                case "occupation_category":
                    mappingArray = vis.occupationsLookup;
                    mappingKey = "occupation";
                    break;
            }
            return [mappingArray[d[0]][mappingKey], d[1]]
        });
        console.log(vis.data);
    }
}
