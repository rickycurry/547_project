import "./external/d3.v7.js"
import "./external/simple-slider/d3-simple-slider.js"


export class TimelineSlider {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    */
    constructor(_config, _candidateData) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1400,
            containerHeight: _config.containerHeight || 80,
            margin: _config.margin || {top: 10, right: 30, bottom: 10, left: 30},
        }

        this.candidates = _candidateData;
        
        this.initVis();
    }

    initVis() {
        let vis = this;

        // Seems that our dates are not cooperating with Set (must be some variance in underlying
        //  numeric representation or something?), so jump through hoops to retain just unique
        //  YYYY-MM-DD dates.
        const primaryElectionCandidates = vis.candidates.filter(d => d.type_elxn === 0);
        const crudeDateSet = new Set();
        vis.electionDates = new Array();
        primaryElectionCandidates.forEach(d => {
            const crudeString = d.edate.toDateString();
            if (crudeDateSet.has(crudeString)) {
                return;
            }
            vis.electionDates.push(d.edate);
            crudeDateSet.add(crudeString);
        });
        
        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);
            // .attr("style", "max-width: 100%; height: auto;");

        // SVG Group containing the actual chart
        vis.chart = vis.svg.append('g')
            .classed("chart", true)
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.right})`);

        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        vis.slider = d3.sliderBottom()
            .min(d3.min(vis.electionDates))
            .max(d3.max(vis.electionDates))
            .default(d3.max(vis.electionDates))
            .marks(vis.electionDates)
            .width(vis.width)
            .tickFormat(d3.utcFormat("%Y"))
            .tickValues(vis.electionDates);
        
        // vis.slider.selectAll()
            // .on("onchange", () => svg.dispatch("input"));

        vis.chart.call(vis.slider);

        d3.selectAll('text')
            .style('text-anchor', 'end')
            .attr("dx", "-1.1em")
            .attr("dy", "-0.8em")
            .attr('transform', "rotate(-65)");
    }
}