import "./external/d3.v7.js"


export class ChoroplethMap {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _geoData {Array}
    * @param _candidateData {Array}
    */
    constructor(_config, _geoData, _candidateData) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1100,
            containerHeight: _config.containerHeight || 800,
            margin: _config.margin || {top: 20, right: 15, bottom: 35, left: 20},
            tooltipPadding: _config.tooltipPadding || 10,
        }

        this.currentParliament = _config.currentParliament || 44
        this.currentByElection = _config.currentByElection || 0

        this.data = _geoData; // TODO: rename
        this.candidates = _candidateData;

        // this.projection = d3.geoMercator();
        this.projection = d3.geoConicConformal()
            .parallels([30, 30])
            .rotate([91.86, -63.390675]);

        this.path = d3.geoPath()
            .projection(this.projection);
        
        this.zoom = d3.zoom()
            .scaleExtent([1, 20])
            .on("zoom", this.zoomed);
        
        this.initVis();
    }

    swapMapData(newData) {
        this.data = newData;
        this.updateVis();
    }

    changeQuantAttr(attr) {
        this.quantAttr = attr;
        this.updateVis();
    }

    initVis() {
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight)
            .attr("style", "max-width: 100%; height: auto;");

        // SVG Group containing the actual chart
        vis.chart = vis.svg.append('g')
            .classed("chart", true);

        vis.projection.fitExtent([[0, 0], [vis.width, vis.height]], vis.data);
        vis.svg.call(vis.zoom);
        // TODO: figure out how to restrict the pan extents to thsi initial bounds.
        // Possibly d3-zoom.translateExtent?

        // This will change in the future depending on which "mode" the map is in
        vis.colourScheme = d3.interpolateBlues;

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

        vis.chart.selectAll("path")
            .data(vis.data.features)
            .join("path")
                .attr("d", vis.path)
                .attr("debugname", d => d.properties.fedname)
                .attr("fill", d => vis.getColour(d))
            .on("mousemove", (event, d) => {
                d3.select('#map-tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('bottom', (window.innerHeight - event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`<div class="tooltip-title">${d.properties.fedname}</div>`);
            })
            .on('mouseleave', () => { d3.select('#map-tooltip').style('display', 'none'); });
    }

    zoomed(event) {
        const {transform} = event;
        d3.select('.chart')
            .attr("transform", transform);
    }

    filterCandidates() {
        // We only want to update the FEDs that changed in the by-election cycle.
        let vis = this;
        vis.filteredCandidates = vis.candidates.filter(d => d.parliament === vis.currentParliament);
        if (vis.currentByElection === 0) {
            vis.filteredCandidates = vis.filteredCandidates.filter(d => d.type_elxn === vis.currentByElection);
        }
        else {
            // TODO: implement
        }
    }

    initValueMap() {
        let vis = this;
        // Currently, support just one encoding (number of candidates => sequential)
        switch (vis.quantAttr) {
            case "non-male":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => {
                    const nonMaleCount = v.filter(d => d.gender !== 'M').length;
                    return nonMaleCount / v.length;
                },
                d => d.fed_id);
                break;
            case "indigenous":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => {
                    const indigenousCount = v.filter(d => d.indigenousorigins === 1).length;
                    return indigenousCount / v.length;
                },
                d => d.fed_id);
                break;
            case "age":
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => d3.mean(v, d => d.age_at_election), d => d.fed_id);
                break;
            case "count":
            default:
                vis.valueMap = d3.rollup(vis.filteredCandidates, v => v.length, d => d.fed_id);
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
