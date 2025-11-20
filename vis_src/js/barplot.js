import "./external/d3.v7.js"

export class Barplot {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    */
    constructor(_config, _candidateData) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 600,
            containerHeight: _config.containerHeight || 400,
            margin: _config.margin || {top: 30, right: 30, bottom: 50, left: 60},
        }

        this.candidates = _candidateData;
        this.initVis();
    }

    initVis() {
        let vis = this;
        const primaryElectionCandidates = vis.candidates.filter(d => d.type_elxn === 0);

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Initialize scales
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        vis.yScale = d3.scaleBand()
            .range([0, vis.height])
            .paddingInner(0.15);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .ticks(10) 
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
        vis.data = ComputeGenderCounts(vis.candidates)
        vis.xValue = d => d.edate;
        vis.yValue = d => d.gender_count;
        vis.xScale.domain([d3.min(vis.data, vis.xValue), d3.max(vis.data, vis.xValue)]);
        vis.yScale.domain([0, 100]);
        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        vis.chart.append("g")
            .attr("transform", `translate(0, ${vis.height})`)
            .call(d3.axisBottom(vis.xScale).ticks(6));
        vis.chart.append("g")
            .call(d3.axisLeft(vis.yScale));

        vis.chart.selectAll(".bar")
            .data(vis.data)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => vis.xScale(vis.xValue(d)))
            .attr("y", d => vis.yScale(vis.yValue(d)))
            .attr("width", 5)
            .attr("height", d => vis.height - vis.yScale(vis.yValue(d)))
            .attr("fill", "blue");
    }
}

function ComputeGenderCounts(primaryElectionCandidates) {
    // Group candidates by election year and compute percent non-male per year.
    // Returns array of {edate, percent_female}
    const groupbydate = d3.group(primaryElectionCandidates, d => d.edate.toDateString());
    const counts = [];
    groupbydate.forEach((candidates, dateString) => {
        const date = new Date(dateString);
        const gender_count = candidates.filter(d => d.gender !== 'M').length;
        counts.push({edate: date, gender_count: gender_count});
    });
    return counts;
}