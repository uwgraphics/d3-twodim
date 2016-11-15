// with thanks to <https://carldanley.com/js-factory-pattern/>

import objectlist from "./objectlist";
import scatterplot from "./scatterplot";
import dropdown from "./dropdown";
import legend from "./legend";

/**
 * Create a d3-twodim factory, where all instantiated objects are linked with the same data.
 */
var twoDimFactory = function() {
    this.dispatch = d3.dispatch("highlight", 'groupUpdate');
    this.createdComponents = [];
};


/**
 * Creates a d3-twodim component with the given name
 * @param {Object} options - The anonymous object with the required properties
 * @param {string} options.type - The name of the component to instantiate (currently, one of the set of {dropdown, legend, objectlist, scatterplot})
 * @param {string} options.renderType - The type of rendering for the requested component, usually one of 'webgl', 'canvas', or 'svg' (default).
 * @returns {Object} The requested object, instantiated
 */
twoDimFactory.prototype.createComponent = function createTwoDimComponent(options) { 
    var parentClass = null;
    
    if (options.type === 'scatterplot') {
        parentClass = scatterplot;
    } else if (options.type === 'objectlist') {
        parentClass = objectlist;
    } else if (options.type === 'dropdown') {
        parentClass = dropdown;
    } else if (options.type === 'legend') {
        parentClass = legend;
    } else {
        throw "Unknown component name passed to twoDimFactory.createComponent()";
    }
    
    var newObject = new parentClass(this.dispatch);
    
    if (options.hasOwnProperty('render')) {
        newObject.renderType(options.render);
    }
    
    this.createdComponents.push(newObject); 
    return newObject;
};

/**
 * Sets the data for all components instantiated by this factory
 * @param {Object[]} data - The data that all components will use
 * @returns {twoDimFactory} The current factory object 
 */
twoDimFactory.prototype.setData = function(data) {
    this.createdComponents.forEach(function(component) {
        component.data(data);
    });
    return this;
};

/**
 * Sets the function that determines the group name of a given point.  The given function *selector* 
 * takes an arbitrary data point, and returns a string representation of its group membership.  This 
 * function is shared with any instantiated scatterplot and legend components.
 * @param {groupCallback} groupSelector - A function that takes an arbitrary object and returns the group membership as a string
 * @returns {twoDimFactory} The current factory object 
 */
twoDimFactory.prototype.setGroupColumn = function(groupSelector) {
  // uses .name to grab name of function; see MDN:
  // <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name>
  var scatterAndLegends = this.createdComponents
    .filter(function(d) { return d.name === 'scatterplot' || d.name === 'legend'; });
    
  scatterAndLegends.forEach(function(d) { d.groupColumn(groupSelector); });
  return this;  
};

/**
 * Sets the categorical column name that will be used to group points.  Shorthand for calling
 * `setGroupColumn`.  The given string *groupField* is converted to a function and is shared with any
 * instantiated scatterplot and legend components.  If *groupField* is continuous, consider passing
 * *numBins* to discretize the field into that number of equally-sized bins.
 * @param {string} groupField - The field in the data that contains the grouping category
 * @param {number} [numBins] - Specifies that the field is continuous and should be binned into the given number of bins
 * @returns {twoDimFactory} The current factory object
 */
twoDimFactory.prototype.setGroupField = function(groupField, numBins) {
  if (!!numBins) {
    var data = this.createdComponents.filter(function(d) { return d.name === "scatterplot"})[0]
      .data();

    // TODO: this more or less assumes integers... consider a smart rounding strategy instead.
    // ... could use d3-array tick's tickStep() method to generate good ticks:
    //     <https://github.com/d3/d3-array/blob/master/src/ticks.js>
    var fieldExtent = d3.extent(data.map(function(d) { return +d[groupField]; }));
    var bandwidth = (fieldExtent[1] - fieldExtent[0]) / numBins;
    var prevVal = 0;
    var range = [];
    for (var i = 0; i < numBins; i++) {
      var start = fieldExtent[0] + i * bandwidth;
      var startRd = Math.floor(start);
      if (Math.floor(start) == prevVal)
        startRd++;

      var binSpan = [
        Math.max(fieldExtent[0], startRd),
        Math.min(fieldExtent[1], Math.floor(start + bandwidth))
      ];

      range.push(binSpan.join('-'));
      prevVal = binSpan[1];
    }

    var binnedScale = d3.scale.quantize()
      .domain(fieldExtent)
      .range(range);

    return this.setGroupColumn(function(d) { return binnedScale(d[groupField]); });
  } else {
    return this.setGroupColumn(function(d) { return d[groupField]; });
  }
}

/**
 * Programmatically kicks off a `highlight` dispatch to all instantiated components from this factory.  With the given function, causes the selected objects to have their 'highlighted' behavior enabled.
 * @param {highlightCallback} highlightFunction - The function with which to filter datums (e.g. returns true for datums to select, returns false for datums to exclude)
 * @returns {twoDimFactory} The current factory object 
 */
twoDimFactory.prototype.highlight = function(highlightFunction) {
    this.dispatch.highlight(highlightFunction);
    return this;
}

/**
 * A function that selects relevant data objects from the currently loaded data.  The function should return true for datums to include, and false for datums to exclude.
 * @callback highlightCallback
 * @param {Object} datum - The datum to check whether to include or disinclude
 * @returns {boolean} Whether or not this datum should be included in the highlighted set
 */

export default twoDimFactory;