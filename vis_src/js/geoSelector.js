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
        this.dataMap = new Map();

        const parentListDiv = d3.select(`#${this.config.parentElement}`);
        const topLevelList = parentListDiv.append('ul')
            .attr('id', 'selector-list');
        _fedHierarchy.provinces.forEach(province => addGroupRecursive(province, topLevelList, this.dataMap));

        console.log(this.dataMap);

        topLevelList.selectAll('input')
            .on("click", (event) => handleCheckboxClickEvent(event, this.dataMap));

        // from https://d3js.org/d3-selection/selecting, thanks!!
        d3.selection.prototype.checked = function(value) {
            return arguments.length < 1
                ? this.property("checked")
                : this.property("checked", !!value);
            };
    }
}

function addGroupRecursive(obj, parentUL, dataMap) {
    const checkboxElementId = `checkbox-${obj.name.replaceAll(' ', '')}`;
    const listItem = parentUL.append('li');

    if (Object.hasOwn(obj, 'regions')) {
        listItem.html(`<details><summary><input type='checkbox' id="${checkboxElementId}" />${obj.name}</summary>`);
        const ul = listItem.select('details')
            .append('ul');
        const childrenKeys = [];
        obj.regions.forEach(region => {
            addGroupRecursive(region, ul, dataMap);
            childrenKeys.push(`checkbox-${region.name.replaceAll(' ', '')}`);
        });
        dataMap.set(checkboxElementId, childrenKeys);
    } else {
        listItem.html(`<input type='checkbox' id="${checkboxElementId}" fedId=${obj.id} />${obj.name}`);
    }
}

function handleCheckboxClickEvent(event, dataMap) {
    const checkbox = event.target;
    if (checkbox.hasAttribute('fedId')) {
        // Simple case: we're just adding or removing a FED from the selection.
        // TODO: notify main about the selection changing.
        const changedSet = new Set([checkbox.getAttribute('fedId')]);
        console.log(changedSet);
        return;
    }
    // We need to change all our descendants to match our current state.
    const fedsChanged = new Set();
    handleCheckboxClickEventRecursive(checkbox.id, checkbox.checked, dataMap, fedsChanged);
    console.log(fedsChanged);
}

function handleCheckboxClickEventRecursive(checkboxId, checked, dataMap, fedsChanged) {
    const checkbox = d3.select(`#${checkboxId}`);

    if (dataMap.has(checkboxId)) {
        // This is the recursive case
        const children = dataMap.get(checkboxId);
        children.forEach(id => handleCheckboxClickEventRecursive(id, checked, dataMap, fedsChanged));
    } else {
        // it's a leaf node, so we may want to add it to the fedsChanged set.
        if (checked !== checkbox.checked()) {
            fedsChanged.add(checkbox.attr('fedId'));
        }
    }
    // Finally, set the checkbox to match the original ancestor's value.
    checkbox.checked(checked);
}