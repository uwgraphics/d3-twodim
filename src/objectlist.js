export default function(dispatch) {
  var thisData = [];
  var thisDataKey = undefined;
  
  var filterFunc = function(d) { return false; };
  var ptString = function(d) { 
    if (Array.isArray(d)) {
      return d.join(", ");
    } else {
      var retStr = "";
      for (prop in d) {
        if (d.hasOwnProperty(prop)) {
          retStr += "prop: " + d[prop];
        }
      }
      
      return prop;
    }
  };
  
  function redraw(selection) {
    selection.each(function(data, i) {
      var g = d3.select(this);
      
      var objects = g.selectAll('li.list-group-item')
        .data(data);
        
      objects.enter().append('li')
        .attr('class', 'list-group-item');
        
      objects.html(function(d) { return "Point: " + ptString(d); });
        
      objects.exit().remove();
    })
  }
  
  function objectlist(selection, name) {
    selection = selection.selectAll('ul')
      .data(['0']).enter()
      .append('ul')
        .attr('class', 'list-group');
        //.classed(liststyle, true);
    
    selection.each(function(d, i) {
      var g = d3.select(this);
      g.data([thisData.filter(filterFunc)], thisDataKey);
    });
    
    redraw(selection);

    dispatch.on('redraw.' + name, function(dataIndices) {
      console.log('was dispatched, got:');
      console.log(dataIndices); 
      
      filterFunc = function(d, i) { return dataIndices.indexOf(i) != -1; };
      selection.each(function(d, i) {
        var g = d3.select(this);
        g.data([thisData.filter(filterFunc)], thisDataKey);
      });
      
      redraw(selection);
    });
  }


  /**
   * Gets or sets the data associated with the objectlist.  This data should be the same as the data passed to an associated scatterplot
   * @default Empty array: []
   * @param {Object[]} The data used in the scatterplot.  Will be used by reference to highlight relevant points
   * @param {function(Object[]): string} The key function for the data (similar to the key function in `d3.data([data, [key]])`) 
   */
  objectlist.data = function(newData, key) {
    if (!arguments.length) return newData;
    thisData = newData;
    if (key) thisDataKey = key;
    return objectlist; 
  }
  
  /**
   * Gets or sets the filter function that displays the matched objects
   * @default All data objects are rejected by the filter (e.g. `function(d) { return false; }`)
   * @param {function(Object): boolean} The filter function to select data elements to display in the list
   */
  objectlist.filter = function(newFilterFunc) {
    if (!arguments.length) return filterFunc;
    filterFunc = newFilterFunc;
    return objectlist;
  }
  
  /**
   * Gets or sets the function that transforms points into a string representation.
   * @default Lists out the items in the point, sequentially
   * @param {function((Object|Array)): string} The ptString function that provides a string representation of a given object
   */
  objectlist.pointToString = function(newPtString) {
    if (!arguments.length) return ptString;
    ptString = newPtString;
    return objectlist;
  }

  return objectlist;
}