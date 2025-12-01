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

    if (Object.hasOwn(obj, 'regions')) {
        listItem.html(`<details><summary><input type='checkbox'/>${obj.name}</summary>`);
        const ul = listItem.select('details')
            .append('ul');
        obj.regions.forEach(region => addGroupRecursive(region, ul));
    } else {
        listItem.html(`<input type='checkbox'/>${obj.name}`);
    }
}

function handleCheckboxEvent(event) {
    console.log(this);
}