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

    changeQuantAttr(attr) {
        this.quantAttr = attr;
        this.updateVis();
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
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickSizeOuter(0);

        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

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
        vis.data = vis.updateData(vis.candidates);
        vis.xValue = d => d[0];
        vis.yValue = d => d[1];
        // TODO: sort this alphabetically (to improve top-bottom comparison) 
        // or descending (to highlight inter-group relationships)
        vis.xScale.domain(vis.data.map(d => d[0]));
        vis.yScale.domain([0, d3.max(vis.data, vis.yValue)]);
        vis.renderVis();
    }
    

    renderVis() {
        let vis = this;

        // update axes instead of appending new ones
        vis.xAxisG.call(vis.xAxis);
        vis.yAxisG.call(vis.yAxis);

        // join with a key so bars update instead of stacking
        vis.chart.selectAll(".bar")
            .data(vis.data, d => d[0])
            .join(
                enter => enter.append("rect")
                    .attr("class", "bar")
                    .attr("x", d => vis.xScale(vis.xValue(d)))
                    .attr("width", vis.xScale.bandwidth())
                    .attr("y", d => vis.yScale(vis.yValue(d)))
                    .attr("height", d => vis.height - vis.yScale(vis.yValue(d)))
                    .attr("fill", "blue"),
                update => update
                    .attr("x", d => vis.xScale(vis.xValue(d)))
                    .attr("width", vis.xScale.bandwidth())
                    .attr("y", d => vis.yScale(vis.yValue(d)))
                    .attr("height", d => vis.height - vis.yScale(vis.yValue(d)))
            );
    }

    updateData() {
        let vis = this;
        
        // default to 'count' when quantAttr is not set
        const attr = vis.quantAttr || "count";
        // wipe vis.data just in case....
        vis.data = [];

        switch (attr) {
            case "margin":
                vis.data = vis.computeMarginCounts(vis.candidates);
                break;
            case "non-male":
                vis.data = vis.computeGenderCounts(vis.candidates);
                break;
             case "indigenous":
                vis.data = vis.computeIndigenousCounts(vis.candidates);
                break;
            case "age":
                vis.data = vis.computeAgeCounts(vis.candidates);
                break;
            case "count":
                //return the number of candidates per major party
                vis.data = d3.rollup(
                    vis.candidates.filter(d => d.parliament === 44), 
                    D => D.length, 
                    d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
                break;
            case "outcome":
                vis.data = vis.NumberFEDWins(vis.candidates);
                break;
        }
        // if a map (from d3.rollup) was produced, convert to array of [key, value] pairs
        if (vis.data instanceof Map) {
            return Array.from(vis.data);
        }
        return vis.data || [];
    }


    // get proportion of non-male candidates per party.
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

    // get proportion of indigenous candidates per party.
    computeIndigenousCounts(primaryElectionCandidates) {
        let vis = this;
        primaryElectionCandidates = primaryElectionCandidates.filter(d => d.parliament === 44);
        return d3.rollup(
            primaryElectionCandidates, 
            D => {
                const totalCandidateCount = D.length;
                return D.filter(c => c.indigenousorigins === 1).length / totalCandidateCount;
            }, 
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
        }

    // get average age of candidates per party.
    computeAgeCounts(primaryElectionCandidates) {
        let vis = this;
        primaryElectionCandidates = primaryElectionCandidates.filter(d => d.parliament === 44);
        const map = d3.rollup(
            primaryElectionCandidates,
            D => {
                // change to numbers and remove invalid age entries
                const ages = D.map(c => c.age).filter(n => Number.isFinite(n));
                return ages.length ? d3.mean(ages) : 0;
            },
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
        return map;
    }

    // get number of FED wins per party.
    NumberFEDWins(primaryElectionCandidates) {
        let vis = this;
        primaryElectionCandidates = primaryElectionCandidates.filter(d => d.parliament === 44);
        return d3.rollup(
            primaryElectionCandidates,
            D => {
                return D.filter(c => c.elected === 1).length;
            },
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
    }

    // for each FED, compute the percentage margin of victory between the top two candidates.
    computeMarginCounts(primaryElectionCandidates) {
        let vis = this;
        primaryElectionCandidates = primaryElectionCandidates.filter(d => d.parliament === 44);
        // if only one candidate in FED, margin is null
        return d3.rollup(
            primaryElectionCandidates,
            D => {
                // sort descending by percent_votes
                D.sort((a, b) => b.percent_votes - a.percent_votes);
                // return difference between top two candidates
                if (D.length > 1) {
                    return (D[0].percent_votes - D[1].percent_votes)*0.01; // convert to proportion
                }
                else {
                    return null;
                }   
            },
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
    }
}