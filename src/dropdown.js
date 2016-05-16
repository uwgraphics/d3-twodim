export default function(dispatch) {
  var thisData = [];
  var thisDataKey = undefined;
  
  var mapFunc = function(d, i) { return d; };
  var isMulti = false;
  
  var localDispatch = d3.dispatch("change");
  
  function redraw(selection) {
    selection.each(function(data, i) {
      var g = d3.select(this);
      var objects = g.selectAll('option')
        .data(data);
        
      objects.enter().append('option')
        .attr('value', function(d) { return d; })
        .html(function(d) { return d; });
        
      objects.exit().remove();
    });
  };
    
  function dropdown(selection, name) {
    var dataSelection = selection.selectAll('select')
      .data([isMulti ? '1' : '0']);
      
    // new type of dropdown
    dataSelection.enter()
      .append('select')
        .attr('class', 'dropdown')
        .on("change", localDispatch.change);
        
     // update dropdown based on whether multiselect is on
     selection = dataSelection.attr('multiple', isMulti ? true : null)
      .style('resize', isMulti ? "vertical" : "none");
     
     // remove old dropdowns
     dataSelection.exit().remove();
    
    selection.each(function(d, i) {
        var g = d3.select(this);
        g.data([mapFunc(thisData)], thisDataKey);
    });
    
    redraw(selection);
    
    dispatch.on('highlight.' + name, function(selector) {
      selection.each(function(d, i) {
        var g = d3.select(this);
        g.data([mapFunc(thisData)], thisDataKey);
      });
      
      redraw(selection);
    });
  }
  
  /**
   * Gets or sets the data associated with the dropdown.  This data should be the same as the data passed to an associated scatterplot
   * @default Empty array: []
   * @param {Object[]} The data used in the scatterplot.  Will be used by reference to highlight relevant points
   * @param {function(Object[]): string} The key function for the data (similar to the key function in `d3.data([data, [key]])`) 
   */
  dropdown.data = function(newData, key) {
    if (!arguments.length) return thisData;
    thisData = newData;
    if (key) thisDataKey = key;
    return dropdown;
  }
  
  /**
   * Gets or sets the function that maps data elements to categories to select objects by.
   * @default Identity function; selects all rows.
   * @param {(function(Object[]): string[]|string)} [value] - Given an arbitrary function, takes the entire dataset and emits an aggregation (list of strings).  Given the string "dims", returns all properties attached to objects in the dataset.  Given the string "values", returns all unique values in the dataset for a given column (second parameter, which is required in this mode).
   * @param {string} [columnName] If "values" is passed to the first parameter, the field/column name needs to be defined.  Selects the column from which to pull unique vales from
   */
  dropdown.mapFunction = function(value, columnName) {
    if (!arguments.length) return mapFunc;
    
    if (typeof value === "function") {
      mapFunc = value;
    } else {
      if (["headers", "header", "dims", "dimensions", "features"].indexOf(value) != -1) {
        isMulti = false;
        mapFunc = function(data) {
          var ret = [];
          for (var prop in data[0]) {
            if (data[0].hasOwnProperty(prop)) {
              ret.push(prop);
            }
          }
          return ret;
        }
      } else if (["values", "column"].indexOf(value) != -1) {
        if (arguments.length < 2) throw "Expected second parameter columnName";
        isMulti = true;
        mapFunc = function(data) { 
          var mapped = data.map(function(d, i) {
            return d[columnName];
          }); 
          return d3.set(mapped).values();
        };
      } else
        throw "Unknown parameter given to dropdown.mapFunction(): " + value;
    }
    
    return dropdown;
  }
  
  return d3.rebind(dropdown, localDispatch, 'on');
}