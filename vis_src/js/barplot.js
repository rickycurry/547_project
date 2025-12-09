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
        this.majorPartiesLookup = new Map();
        this.occupationsLookup = new Map();
        this.provincesLookup = new Map();
        this.currentParliament = this.config.currentParliament;
        this.selectedFeds = new Set();
        // this.aoi = null;
        this.quantAttr = "Winner and\nseat share";
        this.aggregationAttr = "party_major_group_cleaned";
        _majorPartiesLookup.forEach(d => this.majorPartiesLookup.set(d.id, d.party));
        _occupationsLookup.forEach(d => this.occupationsLookup.set(d.id, d.occupation));
        _provincesLookup.forEach(d => this.provincesLookup.set(d.id, d.province));
        this.initVis();
    }

    changeAOI(attr) {
        this.quantAttr = attr;
        this.updateVis();
    }

    changeParliament(newParliament, newSelectedGeography) {
        let vis = this;
        vis.currentParliament = newParliament;
        vis.selectedFeds = newSelectedGeography;
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

        // scale for subgroups (all vs win)
        vis.xSub = d3.scaleBand()
            .domain(['all','win'])
            .padding(0.05);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .tickSizeOuter(0)
            .tickFormat(d3.format(".0%"));

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
        // vis.renderVis();

        // vis.data = vis.updateData(); // returns array of [party, allVal, winVal]
        // vis.xValue = d => d[0];
        // // compute maximum across both allVal and winVal
        // const maxVal = d3.max(vis.data, d => Math.max(d[1] || 0, d[2] || 0, 0));
        // vis.xScale.domain(vis.data.map(d => d[0]));
        // vis.xSub.range([0, vis.xScale.bandwidth()]);
        // vis.yScale.domain([0, maxVal || 1]); // avoid zero-range
        // vis.renderVis();
    }
    

    renderVis() {
        let vis = this;
        vis.chart.append("g")
            .attr("transform", `translate(0, ${vis.height})`)
            .call(vis.xAxis);
        vis.chart.append("g")
            .call(vis.yAxis);

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
                const totalWinnerVotes = d3.sum(vis.filteredCandidates.filter(d => d.elected), d => d.votes);
                vis.candidateData = d3.rollups(vis.filteredCandidates, D => d3.sum(D, d => d.votes) / totalVotes, d => d[vis.aggregationAttr]);
                vis.winnerData = d3.rollups(vis.filteredCandidates.filter(d => d.elected), D => d3.sum(D, d => d.votes) / totalWinnerVotes, d => d[vis.aggregationAttr]);
                break;
            case "Age":
                vis.candidateData = d3.rollups(vis.filteredCandidates, D => d3.mean(D, d => d.age), d => d[vis.aggregationAttr]);
                vis.winnerData = d3.rollups(vis.filteredCandidates.filter(d => d.elected), D => d3.mean(D, d => d.age), d => d[vis.aggregationAttr]);
                break;
            case "Non-male":
                vis.candidateData = d3.rollups(vis.filteredCandidates, D => D.filter(d => d.gender !== 'M').length / D.length, d => d[vis.aggregationAttr]);
                vis.winnerData = d3.rollups(vis.filteredCandidates.filter(d => d.elected), D => D.filter(d => d.gender !== 'M').length / D.length, d => d[vis.aggregationAttr]);
                break;
            case "Indigenous":
                vis.candidateData = d3.rollups(vis.filteredCandidates, D => D.filter(d => d.indigenous_origins).length / D.length, d => d[vis.aggregationAttr]);
                vis.winnerData = d3.rollups(vis.filteredCandidates.filter(d => d.elected), D => D.filter(d => d.indigenous_origins).length / D.length, d => d[vis.aggregationAttr]);
                break;
            case "Count":
            case "Winner and\nseat share": 
            default:
                vis.candidateData = d3.rollups(vis.filteredCandidates, D => D.length, d => d[vis.aggregationAttr]);
                vis.winnerData = d3.rollups(vis.filteredCandidates.filter(d => d.elected), D => D.length, d => d[vis.aggregationAttr]);
                break;
        }
        console.log(vis.candidateData);
        console.log(vis.winnerData);
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
    }

        // switch (attr) {
    //         case "margin":
    //              // same for candidates and winners
    //             mapall = vis.computeMarginCounts(primaryElectionCandidates);
    //             mapwinners = vis.computeMarginCounts(winnersCandidates);
    //             break;
    //         case "non-male":
    //             mapall = vis.computeGenderCounts(primaryElectionCandidates);
    //             mapwinners = vis.computeGenderCounts(winnersCandidates);
    //             break;
    //         case "indigenous":
    //             mapall = vis.computeIndigenousCounts(primaryElectionCandidates);
    //             mapwinners = vis.computeIndigenousCounts(winnersCandidates);
    //             break;
    //         case "age":
    //             mapall = vis.computeAgeCounts(primaryElectionCandidates);
    //             mapwinners = vis.computeAgeCounts(winnersCandidates);
    //             break;
    //         case "count":
    //             mapall = d3.rollup(
    //                 primaryElectionCandidates, 
    //                 D => D.length, 
    //                 d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
    //             mapwinners = d3.rollup(
    //                 winnersCandidates, 
    //                 D => D.length, 
    //                 d => vis.majorPartiesLookup.get(d.party_major_group_cleaned));
    //             break;
    //         case "outcome":
    //             // same for candidates and winners
    //             mapall = vis.NumberFEDWins(primaryElectionCandidates);
    //             mapwinners = vis.NumberFEDWins(winnersCandidates);
    //             break;
    //     }

    //     // normalize maps to array
    //     const keys = new Set([...Array.from(mapall?.keys?.()||[]), ...Array.from(mapwinners?.keys?.()||[])]);
    //     // build array of [party, allVal, winVal]
    //     vis.data = Array.from(keys).map(function (k) {
    //     let allValue = 0;
    //     let winnerValue = 0;
    //     if (mapall && mapall.get(k) != null) {
    //         allValue = mapall.get(k);
    //     }
    //     if (mapwinners && mapwinners.get(k) != null) {
    //         winnerValue = mapwinners.get(k);
    //     }
    //     return [
    //         k,
    //         allValue,
    //         winnerValue
    //     ];
    // });

    //     // sort alphabetically
    //     vis.data.sort((a,b) => String(a[0]).localeCompare(String(b[0])));

    //     return vis.data || [];
    // }


    // // get proportion of non-male candidates per party.
    // computeGenderCounts(primaryElectionCandidates) {
    //     let vis = this;
    //     // assume primaryElectionCandidates is already restricted to the selected parliament/RO
    //     const map = d3.rollup(
    //         primaryElectionCandidates, 
    //         D => {
    //             const totalCandidateCount = D.length;
    //             if (totalCandidateCount) {
    //                 // count all candidates who are not male
    //                 const nonMaleCount = D.filter(c => c.gender !== 'M').length;
    //                 return nonMaleCount / totalCandidateCount;
    //             } else {
    //                 return 0;
    //             }
    //         }, 
    //         d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
    //     );
    //     return map;
    // }

    // // get proportion of indigenous candidates per party.
    // computeIndigenousCounts(primaryElectionCandidates) {
    //     let vis = this;
    //     // assume primaryElectionCandidates is already restricted to the selected parliament/RO
    //     return d3.rollup(
    //         primaryElectionCandidates, 
    //         D => {
    //             const totalCandidateCount = D.length;
    //             if (!totalCandidateCount) return 0;
    //             return D.filter(c => +c.indigenousorigins === 1).length / totalCandidateCount;
    //         }, 
    //         d => vis.majorPartiesLookup.get(d.party_major_group_cleaned)
    //     );
    // }
}
