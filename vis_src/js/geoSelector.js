import "./external/d3.v7.js"

export class GeoSelector {
    /**
    * Class constructor with basic chart configuration
    * @param _config {Object}
    * @param _fedHierarchy {Object}
    */
    constructor(_config, _fedHierarchy) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
        }

        console.log(_fedHierarchy);

        const parentListDiv = d3.select(`#${this.config.parentElement}`);
        const topLevelList = parentListDiv.append('ul')
            .attr('id', 'selector-list');
        _fedHierarchy.provinces.forEach(province => addGroupRecursive(province, topLevelList));

        topLevelList.selectAll('input')
            .on("change", handleCheckboxEvent);
    }
}

function addGroupRecursive(obj, parentUL) {
    const listItem = parentUL.append('li');
        // .text(obj.name);

    // I really can't figure out how to get the checkboxes to line up on the left. TODO
    if (Object.hasOwn(obj, 'regions')) {
        const details = listItem.append('details');
        details.append('summary')
            .text(obj.name)
            .append('input', '#text')
                .attr('type', 'checkbox');
        const ul = details.append('ul');
        obj.regions.forEach(region => addGroupRecursive(region, ul));
    } else {
        listItem.text(obj.name);
        listItem.insert('input', '#text')
            .attr('type', 'checkbox');
    }
}

function handleCheckboxEvent(event) {
    console.log(this);
}