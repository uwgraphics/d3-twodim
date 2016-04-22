import objectlist from "./objectlist";
import scatterplot from "./scatterplot";

var twoDimFactory = function() {
    this.dispatch = d3.dispatch("redraw");
    this.createdComponents = [];
};

// with thanks to <https://carldanley.com/js-factory-pattern/>
twoDimFactory.prototype.createComponent = function createTwoDimComponent(options) { 
    var parentClass = null;
    
    if (options.type === 'scatterplot') {
        parentClass = scatterplot;
    } else if (options.type === 'objectlist') {
        parentClass = objectlist;
    } else {
        throw "Unknown component name passed to twoDimFactory.createComponent()";
    }
    
    var newObject = new parentClass(this.dispatch);
    this.createdComponents.push(newObject); 
    return newObject;
    //return new parentClass(this.dispatch);
};

twoDimFactory.prototype.setData = function(data) {
    this.createdComponents.forEach(function(component) {
        component.data(data);
    });
};

export default twoDimFactory;