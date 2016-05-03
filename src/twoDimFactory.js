import objectlist from "./objectlist";
import scatterplot from "./scatterplot";
import dropdown from "./dropdown";
import legend from "./legend";

var twoDimFactory = function() {
    this.dispatch = d3.dispatch("redraw", 'groupUpdate');
    this.createdComponents = [];
};

// with thanks to <https://carldanley.com/js-factory-pattern/>
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

twoDimFactory.prototype.setData = function(data) {
    this.createdComponents.forEach(function(component) {
        component.data(data);
    });
    return this;
};

twoDimFactory.prototype.setGroupColumn = function(groupSelector) {
  // uses .name to grab name of function; see MDN:
  // <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name>
  var scatterAndLegends = this.createdComponents
    .filter(function(d) { return d.name === 'scatterplot' || d.name === 'legend'; });
    
  scatterAndLegends.forEach(function(d) { d.groupColumn(groupSelector); });
  return this;  
};

export default twoDimFactory;