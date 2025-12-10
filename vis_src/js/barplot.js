import "./external/d3.v7.js"

export class Barplot {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    * @param _majorPartiesLookup {Array}
    * @param _occupationsLookup {Array}
    * @param _provincesLookup {Array}
    * @param _changeAggregationAttrCallback {Function}
    */
    constructor(_config, _candidateData, _majorPartiesLookup, _occupationsLookup, _provincesLookup, _changeAggregationAttrCallback) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            margin: _config.margin || {top: 10, right: 10, bottom: 80, left: 35},
            currentParliament: _config.currentParliament || 1,
        }
        
        this.candidates = _candidateData.filter(d => d.type_elxn === 0);
        this.candidatesGroupedByParliament = d3.group(this.candidates, d => d.parliament);
        this.majorPartiesLookup = _majorPartiesLookup;
        this.occupationsLookup = _occupationsLookup;
        this.provincesLookup = _provincesLookup;
        this.currentParliament = this.config.currentParliament;
        this.selectedFeds = null;
        this.quantAttr = "Winner and\nseat share";
        this.currentAggregationIdx = 1;
        this.aggregationAttrs = ["party_major_group_cleaned", "province", "occupation_category"];
        this.changeAggregationAttrCallback = _changeAggregationAttrCallback;
        this.initVis();
    }

    changeAOI(attr) {
        let vis = this;
        vis.quantAttr = attr;
        if (attr === "Non-male" || attr === "Indigenous" || attr === "Vote share") {
            vis.aoiIsPercent = true;
            vis.yAxis.tickFormat(d3.format(".0%"));
        } else {
            vis.aoiIsPercent = false;
            vis.yAxis.tickFormat(null);
        }
        vis.updateVis();
    }

    changeParliament(newParliament, newSelectedGeography, geoIsSelected) {
        let vis = this;
        vis.currentParliament = newParliament;
        if (geoIsSelected) {
            vis.selectedFeds = new Set(Array.from(newSelectedGeography).map(d => Number(d)));
        } else {
            vis.selectedFeds = null;
        }
        vis.updateVis();
    }

    changeAggregationAttr() {
        let vis = this;
        vis.currentAggregationIdx += 1;
        if (vis.currentAggregationIdx >= vis.aggregationAttrs.length) {
            vis.currentAggregationIdx = 0;
        }
        vis.updateVis();
    }

    changeSelectedFEDs(selectedFedsSet, geoIsSelected) {
        let vis = this;
        if (geoIsSelected) {
            vis.selectedFeds = new Set(Array.from(selectedFedsSet).map(d => Number(d)));
        } else {
            vis.selectedFeds = null;
        }
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

        // scale for subgroups (all vs win)
        vis.xSub = d3.scaleBand()
            .domain(['all','win'])
            .padding(0.1);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickSizeOuter(0)
            .ticks(5);

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

        // if (vis.data.length === 0) {
            console.log(vis.data);
        // }

        vis.chart.selectAll('.group-g')
            .data(vis.data, d => d[0])
            .join('g')
            .attr("transform", d => `translate(${vis.xScale(d[0])}, 0)`)
            .attr("debugname", d => d[0])
            .classed('group-g', true)
            .classed('barplot-bar', true)
            .selectAll('rect')
            .data(d => [
                    {agg: d[0], group: 'all', val: d[1].all, longname: d[3]}, 
                    {agg: d[0], group: 'win', val: d[1].win, longname: d[3]}
                ], d => d.group)
            .join('rect')
            .attr('x', d => vis.xSub(d.group))
            .attr('y', d => vis.yScale(d.val))
            .attr('width', vis.xSub.bandwidth())
            .attr('height', d => vis.yScale(0) - vis.yScale(d.val))
            .attr('fill', d => vis.colourScale(d.group));

        vis.chart.selectAll('rect')
            .on("mousemove", (event, d) => {
                console.log(d.longname);
                d3.select('#map-tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('bottom', (window.innerHeight - event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`<div class="tooltip-title">${vis.aoiIsPercent ? `${(Math.round(d.val * 1000) / 10).toFixed(1)}%` : d.val}</div>
                           <div class="tooltip-body">${d.longname === null ? '' : d.longname}</div>`);
                })
            .on('mouseleave', () => { d3.select('#map-tooltip').style('display', 'none'); });

        vis.chart.selectAll('.tick')
            .on("click", (event, d) => {
                vis.changeAggregationAttrCallback();
            });
    }

    filterCandidates() {
        let vis = this;
        vis.filteredCandidates = vis.candidatesGroupedByParliament.get(vis.currentParliament);
        if (vis.selectedFeds !== null) {
            vis.filteredCandidates = vis.filteredCandidates.filter(d => vis.selectedFeds.has(d.fed_id));
        }
    }

    initValueMap() {
        let vis = this;
        const aggregationAttr = vis.aggregationAttrs[vis.currentAggregationIdx];
        switch (vis.quantAttr) {
            case "Vote share":
                const totalVotes = d3.sum(vis.filteredCandidates, d => d.votes);
                // const totalWinnerVotes = d3.sum(vis.filteredCandidates.filter(d => d.elected), d => d.votes);
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    return {all: d3.sum(D, d => d.votes) / totalVotes, win: d3.sum(D.filter(d => d.elected), d => d.votes) / totalVotes};
                }, d => d[aggregationAttr]);
                break;
            case "Age":
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    return {all: d3.mean(D, d => d.age_at_election), win: d3.mean(D.filter(d => d.elected), d => d.age_at_election)};
                }, d => d[aggregationAttr]);
                break;
            case "Non-male":
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    const electedOnly = D.filter(d => d.elected);
                    return {
                        all: D.filter(d => d.gender !== 'M').length / D.length, 
                        win: electedOnly.filter(d => d.gender !== 'M').length / electedOnly.length
                    };
                }, d => d[aggregationAttr]);
                break;
            case "Indigenous":
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    const electedOnly = D.filter(d => d.elected);
                    return {
                        all: D.filter(d => d.indigenousorigins).length / D.length, 
                        win: electedOnly.filter(d => d.indigenousorigins).length / electedOnly.length
                    };
                }, d => d[aggregationAttr]);
                break;
            case "Count":
            case "Winner and\nseat share": 
            default:
                vis.data = d3.rollups(vis.filteredCandidates, D => {
                    return {all: D.length, win: D.filter(d => d.elected).length};
                }, d => d[aggregationAttr]);
                break;
        }

        vis.data = vis.data.map(d => {
            let mappingArray, mappingKey;
            switch (aggregationAttr) {
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
            if (d[0] === null) {
                return ['UN', d[1], -1, "Occupation unknown"];
            }
            return [mappingArray[d[0]][mappingKey], d[1], d[0], mappingArray[d[0]].longname]
        });
        vis.data.sort((a, b) => a[2] - b[2]);
    }
}
