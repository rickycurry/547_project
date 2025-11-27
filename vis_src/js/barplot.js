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
        this.candidatesGroupedByParliament = d3.group(_candidateData, d => d.parliament);
        this.majorPartiesLookup = new Map();
        this.currentRoIdx = 0;
        _majorPartiesLookup.forEach(d => this.majorPartiesLookup.set(d.id, d.party));
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

        vis.dateParliamentMap = new Map();
        vis.candidatesGroupedByParliament.forEach((candidates, parliament) => {
        vis.dateParliamentMap.set(candidates[0].edate.valueOf(), parliament);
        });

        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        vis.data = vis.updateData();
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

    updateData() {
        let vis = this;
        vis.filterCandidates();

        // default to 'outcome' when quantAttr is not set
        const attr = vis.quantAttr || "outcome";
        // wipe vis.data just in case....
        vis.data = [];

        // use the already-filtered candidate list for the currently selected RO/parliament
        const primaryElectionCandidates = vis.filteredCandidates || vis.candidates;

        switch (attr) {
            case "margin":
                vis.data = vis.computeMarginCounts(primaryElectionCandidates);
                break;
            case "non-male":
                vis.data = vis.computeGenderCounts(primaryElectionCandidates);
                break;
             case "indigenous":
                vis.data = vis.computeIndigenousCounts(primaryElectionCandidates);
                break;
            case "age":
                vis.data = vis.computeAgeCounts(primaryElectionCandidates);
                break;
            case "count":
                //return the number of candidates per major party
                vis.data = d3.rollup(
                    primaryElectionCandidates, 
                    D => D.length, 
                    d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
                break;
            case "outcome":
                vis.data = vis.NumberFEDWins(primaryElectionCandidates);
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
        // assume primaryElectionCandidates is already restricted to the selected parliament/RO
        const map = d3.rollup(
            primaryElectionCandidates, 
            D => {
                const totalCandidateCount = D.length;
                if (totalCandidateCount) {
                    // count all candidates who are not male
                    const nonMaleCount = D.filter(c => c.gender !== 'M').length;
                    return nonMaleCount / totalCandidateCount;
                } else {
                    return 0;
                }
            }, 
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
        return map;
    }

    // get proportion of indigenous candidates per party.
    computeIndigenousCounts(primaryElectionCandidates) {
        let vis = this;
        // assume primaryElectionCandidates is already restricted to the selected parliament/RO
        return d3.rollup(
            primaryElectionCandidates, 
            D => {
                const totalCandidateCount = D.length;
                if (!totalCandidateCount) return 0;
                return D.filter(c => +c.indigenousorigins === 1).length / totalCandidateCount;
            }, 
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
    }

    // get average age of candidates per party.
    computeAgeCounts(primaryElectionCandidates) {
        let vis = this;
        // assume primaryElectionCandidates is already restricted to selected RO/parliament
        const map = d3.rollup(
            primaryElectionCandidates,
            D => {
                // coerce to numbers and remove invalid entries
                const ages = D
                    .map(c => {
                        if (c.age === null || c.age === undefined) return NaN;
                        if (typeof c.age === "string" && c.age.trim() === "") return NaN;
                        const n = +c.age;
                        if (Number.isFinite(n)) {
                            return n;
                        } else {
                            return NaN;
                        }
                    })
                    .filter(Number.isFinite);
                if (ages.length > 0) {
                    return d3.mean(ages);
                } else {
                    return 0;
                }
            },
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
        return map;
    }

    // get number of FED wins per party.
    NumberFEDWins(primaryElectionCandidates) {
        let vis = this;
        // assume primaryElectionCandidates is already restricted to selected RO/parliament
        return d3.rollup(
            primaryElectionCandidates,
            D => {
                return D.filter(c => +c.elected === 1).length;
            },
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
    }

    // for each FED, compute the percentage margin of victory between the top two candidates.
    computeMarginCounts(primaryElectionCandidates) {
        let vis = this;
        // assume primaryElectionCandidates is already restricted to selected RO/parliament
        return d3.rollup(
            primaryElectionCandidates,
            D => {
                // work with numeric percent_votes
                D.sort((a, b) => (+b.percent_votes) - (+a.percent_votes));
                if (D.length > 1) {
                    const topCandidateVotes = Number(D[0].percent_votes);
                    const secondCandidateVotes = Number(D[1].percent_votes);
                    if (Number.isFinite(topCandidateVotes) && Number.isFinite(topCandidateVotes)) {
                        // return proportion
                        return (topCandidateVotes - secondCandidateVotes) * 0.01;
                    }
                }
                return null;
            },
            d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
        );
    }
}