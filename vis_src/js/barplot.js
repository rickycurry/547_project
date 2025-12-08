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

        // scale for subgroups (all vs win)
        vis.xSub = d3.scaleBand()
            .domain(['all','win'])
            .padding(0.05);

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
        vis.data = vis.updateData(); // returns array of [party, allVal, winVal]
        vis.xValue = d => d[0];
        // compute maximum across both allVal and winVal
        const maxVal = d3.max(vis.data, d => Math.max(d[1] || 0, d[2] || 0, 0));
        vis.xScale.domain(vis.data.map(d => d[0]));
        vis.xSub.range([0, vis.xScale.bandwidth()]);
        vis.yScale.domain([0, maxVal || 1]); // avoid zero-range
        vis.renderVis();
    }
    

    renderVis() {
        let vis = this;

        // update axes
        vis.xAxisG.call(vis.xAxis);
        vis.yAxisG.call(vis.yAxis);

        // one group per party
        const groups = vis.chart.selectAll(".bar-group")
            .data(vis.data, d => d[0]);

        const groupsEnter = groups.join(
            enter => enter.append("g")
                .attr("class", "bar-group")
                .attr("transform", d => `translate(${vis.xScale(d[0])},0)`),
            update => update
                .attr("transform", d => `translate(${vis.xScale(d[0])},0)`),
            exit => exit.remove()
        );

        // two rects per group: all candidates and winners
        groupsEnter.selectAll("rect")
            .data(d => (['all','win'].map(k => ({k, v: k === 'all' ? d[1] : d[2]}))))
            .join("rect")
            .attr("class", d => `bar bar-${d.k}`)
            .attr("x", d => vis.xSub(d.k))
            .attr("width", vis.xSub.bandwidth())
            .attr("y", d => vis.yScale(d.v != null ? d.v : 0))
            .attr("height", d => vis.height - vis.yScale(d.v != null ? d.v : 0))
            .attr("fill", d => d.k === 'all' ? "steelblue" : "orange");

            // update bars 
            groupsEnter.selectAll("rect")
            .transition().duration(250)
            .attr("x", d => vis.xSub(d.k))
            .attr("width", vis.xSub.bandwidth())
            .attr("y", d => vis.yScale(d.v != null ? d.v : 0))
            .attr("height", d => vis.height - vis.yScale(d.v != null ? d.v : 0))
            .attr("fill", d => d.k === 'all' ? "steelblue" : "orange");
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
        vis.data = [];

        // use the already-filtered candidate list for the currently selected RO/parliament
        const primaryElectionCandidates = vis.filteredCandidates || vis.candidates;
        const winnersCandidates = (primaryElectionCandidates || []).filter(c => +c.elected === 1);

        let mapall = new Map();
        let mapwinners = new Map();

        switch (attr) {
            case "margin":
                 // same for candidates and winners
                mapall = vis.computeMarginCounts(primaryElectionCandidates);
                mapwinners = vis.computeMarginCounts(winnersCandidates);
                break;
            case "non-male":
                mapall = vis.computeGenderCounts(primaryElectionCandidates);
                mapwinners = vis.computeGenderCounts(winnersCandidates);
                break;
            case "indigenous":
                mapall = vis.computeIndigenousCounts(primaryElectionCandidates);
                mapwinners = vis.computeIndigenousCounts(winnersCandidates);
                break;
            case "age":
                mapall = vis.computeAgeCounts(primaryElectionCandidates);
                mapwinners = vis.computeAgeCounts(winnersCandidates);
                break;
            case "count":
                mapall = d3.rollup(
                    primaryElectionCandidates, 
                    D => D.length, 
                    d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
                mapwinners = d3.rollup(
                    winnersCandidates, 
                    D => D.length, 
                    d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
                break;
            case "outcome":
                // same for candidates and winners
                mapall = vis.NumberFEDWins(primaryElectionCandidates);
                mapwinners = vis.NumberFEDWins(winnersCandidates);
                break;
        }

        // normalize maps to array
        const keys = new Set([...Array.from(mapall?.keys?.()||[]), ...Array.from(mapwinners?.keys?.()||[])]);
        // build array of [party, allVal, winVal]
        vis.data = Array.from(keys).map(function (k) {
        let allValue = 0;
        let winnerValue = 0;
        if (mapall && mapall.get(k) != null) {
            allValue = mapall.get(k);
        }
        if (mapwinners && mapwinners.get(k) != null) {
            winnerValue = mapwinners.get(k);
        }
        return [
            k,
            allValue,
            winnerValue
        ];
    });

        // sort alphabetically
        vis.data.sort((a,b) => String(a[0]).localeCompare(String(b[0])));

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