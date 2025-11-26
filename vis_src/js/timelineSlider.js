import "./external/d3.v7.js"
import "./external/simple-slider/d3-simple-slider.js"


export class TimelineSlider {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _candidateData {Array}
    * @param _changeDateCallback {Function}
    */
    constructor(_config, _candidateData, _changeDateCallback) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            minSize: _config.minSize || {height: 66, width: 1800},
            margin: _config.margin || {top: 40, right: 30, bottom: 5, left: 30},
            isUpper: _config.isUpper || false,
            initializeMin: _config.initializeMin || false,
        }

        this.candidates = _candidateData;
        this.changeDateCallback = _changeDateCallback;
        
        this.initVis();
    }

    initVis() {
        let vis = this;

        // Seems that our dates are not cooperating with Set (must be some variance in underlying
        //  numeric representation or something?), so jump through hoops to retain just unique
        //  YYYY-MM-DD dates.
        const primaryElectionCandidates = vis.candidates.filter(d => d.type_elxn === 0);
        vis.parliamentToYearMap = new Map();
        const yearFormatter = d3.utcFormat("%Y")
        primaryElectionCandidates.forEach(d => {
            if (vis.parliamentToYearMap.has(d.parliament)) {
                return;
            }
            vis.parliamentToYearMap.set(d.parliament, yearFormatter(d.edate));
        });

        const sliderDiv = document.getElementById(vis.config.parentElement);
        vis.width = sliderDiv.offsetWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = sliderDiv.offsetHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define size of SVG drawing area
        vis.svg = d3.select(`#${vis.config.parentElement}`)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            // Weird convention, but borrowed from https://observablehq.com/@mbostock/hello-d3-simple-slider
            .attr('viewBox', [-vis.config.margin.left, -vis.config.margin.top, sliderDiv.offsetWidth, sliderDiv.offsetHeight]);

        vis.updateVis();
    }

    updateVis() {
        let vis = this;
        vis.renderVis();
    }

    renderVis() {
        let vis = this;
        vis.slider = vis.config.isUpper ? d3.sliderTop() : d3.sliderBottom();
        const parliaments = Array.from(vis.parliamentToYearMap.keys());
        vis.slider
            .min(d3.min(parliaments))
            .max(d3.max(parliaments))
            .default(vis.config.initializeMin ? d3.min(parliaments) : d3.max(parliaments))
            .marks(parliaments)
            .width(vis.width)
            .height(vis.height)
            .tickFormat(d => vis.parliamentToYearMap.get(d))
            .tickValues(parliaments)
            .on("onchange", vis.changeDateCallback);

        vis.svg.call(vis.slider);

        // d3.selectAll('text')
        //     .style('text-anchor', 'end')
        //     .attr("dx", "-1.1em")
        //     .attr("dy", "-0.8em")
        //     .attr('transform', "rotate(-65)");
    }
}