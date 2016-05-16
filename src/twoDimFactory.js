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
 * Sets the function that selects the field on which to group on (usually a categorical column).  The given function is shared with any instantiated scatterplot and legend components
 * @param {groupCallback} groupSelector - The function that selects the field on which to group the data on
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
 * Programmatically kicks off a `highlight` dispatch to all instantiated components from this factory.  With the given function, causes the selected objects to have their 'highlighted' behavior enabled.
 * @param {highlightCallback} highlightFunction - The function with which to filter datums (e.g. returns true for datums to select, returns false for datums to exclude)
 * @returns {twoDimFactory} The current factory object 
 */
twoDimFactory.prototype.highlight = function(highlightFunction) {
    this.dispatch.highlight(highlightFunction);
    return this;
}


/**
 * A function that selects the grouping field out of a datum (see `selectors` in D3.js)
 * @callback groupCallback
 * @param {Object} datum - The datum on which to operate over
 * @returns {string} The group value of this datum
 */

/**
 * A function that selects relevant data objects from the currently loaded data.  The function should return true for datums to include, and false for datums to exclude.
 * @callback highlightCallback
 * @param {Object} datum - The datum to check whether to include or disinclude
 * @returns {boolean} Whether or not this datum should be included in the highlighted set
 */

export default twoDimFactory;