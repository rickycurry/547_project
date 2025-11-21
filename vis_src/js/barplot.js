import "./external/d3.v7.js"

export class Barplot {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    * @param _majorPartiesLookup {Array}
    */
    constructor(_config, _candidateData, _majorPartiesLookup) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 600,
            containerHeight: _config.containerHeight || 480,
            margin: _config.margin || {top: 30, right: 10, bottom: 50, left: 35},
        }

        this.candidates = _candidateData;
        this.majorPartiesLookup = new Map();
        _majorPartiesLookup.forEach(d => this.majorPartiesLookup.set(d.id, d.party));
        this.initVis();
    }

    initVis() {
        let vis = this;
        vis.candidates = vis.candidates.filter(d => d.type_elxn === 0);

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Initialize scales
        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xScale = d3.scaleBand()
            .range([0, vis.width])
            .padding(0.15);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            // .ticks(10) 
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickSizeOuter(0);

        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);
        vis.chart = vis.svg.append('g')
            .classed("chart", true)
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);
        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        vis.data = vis.computeGenderCounts(vis.candidates)
        vis.xValue = d => d[0];
        vis.yValue = d => d[1];
        // TODO: sort this alphabetically (to improve top-bottom comparison) 
        // or descending (to highlight inter-group relationships)
        vis.xScale.domain(vis.data.keys());
        vis.yScale.domain([0, d3.max(vis.data, vis.yValue)]);
        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        vis.chart.append("g")
            .attr("transform", `translate(0, ${vis.height})`)
            .call(d3.axisBottom(vis.xScale));
        vis.chart.append("g")
            .call(d3.axisLeft(vis.yScale));

        vis.chart.selectAll(".bar")
            .data(vis.data)
            .join("rect")
            .attr("class", "bar")
            .attr("x", d => vis.xScale(vis.xValue(d)))
            .attr("y", d => vis.yScale(vis.yValue(d)))
            .attr("width", vis.xScale.bandwidth())
            .attr("height", d => vis.height - vis.yScale(vis.yValue(d)))
            .attr("fill", "blue");
    }

    computeGenderCounts(primaryElectionCandidates) {
        let vis = this;
        primaryElectionCandidates = primaryElectionCandidates.filter(d => d.parliament === 44);
        return d3.rollup(
            primaryElectionCandidates, 
            D => {
                const totalCandidateCount = D.length;
                return D.filter(c => c.gender != 'M').length / totalCandidateCount;
            }, 
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
    }
}
