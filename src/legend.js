export default function(dispatch) {
  var thisData = [];
  var thisDataKey = undefined;//function(d) { return d };
  var localDispatch = d3.dispatch("click");

  var groups = ['unknown'];
  var groupData = {name: 'unknown', active: true};
  var groupCol = function(d) { return d; }; // TODO: hook this up
  var colorScale = undefined;
  
  var allActive = true;
  
  function groupSelect(d, i) {
    console.log("clicked on %s", d.name);
    
    if (allActive) {
      groupData.forEach(function(grp) {
        if (grp.name != d.name) 
          grp.active = false;
      });
      allActive = false;
    } else {
      groupData[i].active = !groupData[i].active;
      
      // check if all items are (in)active
      if (!groupData.some(function(d) { return d.active; })) {
        groupData.forEach(function(d) { d.active = true; });
        allActive = true;
      }
    }
    
    localDispatch.click(d, i);
    
    var selector = function() { return true; };
    if (!allActive) {
      var selectedGroups = groupData
        .filter(function(d) { return d.active; })
        .map(function(d) { return d.name; });
        
      selector = function(d) { return selectedGroups.indexOf(groupCol(d)) != -1; };
    }
    
    dispatch.highlight(selector);
  }

  function redraw(selection) {
    selection.each(function (data, i) {
      var g = d3.select(this);
      
      var items = g.selectAll("g.item")
        .data(data, function(d) { return d.name; });
        
      var newItems = items.enter()
        .append('g')
          .attr('class', 'item')
          .attr('transform', function(d, i) { return 'translate(0, ' + (20 * i) + ')' });
          
      colorScale = colorScale || d3.scale.category10();
          
      newItems.append('rect')
        .attr('width', 10)
        .attr('height', 10)
        .on('click', groupSelect);
        
      newItems.append('text')
        .attr('x', 18)
        .attr('y', 9)
        .html(function(d) { return d.name; })
        .on('click', groupSelect);
      
      items.selectAll('rect')
        .style('fill', function(d) { return colorScale(d.name); });
        
      items.classed('disabled', function(d) { return !d.active; });
        
      items.exit().remove();  
    });
  }
  
  function resetData(selection) {
    groupData = groups.map(function(grp) { 
      return {'name': grp, 'active': true };
    });
    
    selection.each(function(d, i) {
      d3.select(this).data([groupData], thisDataKey);
    });
  }

  function legend(selection, name) {
    resetData(selection);
    redraw(selection);
    
    dispatch.on('highlight.' + name, function(selectedIndices) {
      console.log("called legend dispatch (redraw)");
      redraw(selection);
    });
    
    dispatch.on('groupUpdate.' + name, function(newGroups, newColorScale) {
      console.log("called legend dispatch (groupUpdate)");
      groups = newGroups;
      colorScale = newColorScale;
      
      resetData(selection);
      redraw(selection);
    });
  }
  
  /**
   * Gets or sets the data bound to points in the scatterplot.  Following D3.js convention, this should be an array of anonymous objects.  Generally set all at once by the twoDFactory.setData() method
   * @default Empty array: []
   * @param {Object[]} [newData] - The data of the scatterplot.  Set the `.x()` and `.y()` accessors for the x- and y-dimensions of the scatterplot
   * @param {function(Object[]): string} [key] - The key function for the data (similar to the key function in `d3.data([data, [key]])`)
   */
  legend.data = function(newData, key) {
    if (!arguments.length) return thisData;
    thisData = newData;
    if (key) thisDataKey = key;
    return legend;
  }
  
  /**
   * The groups and color scale to display in the legend.
   * @default One unknown class (e.g. ['unknown'])
   * @param {string[]} [newGroups] - A string array of the new group names
   * @param {function(string): string} [newColorScale] - A D3 categorical color scale that converts the group name to its representative color
   */
  legend.groups = function(newGroups, newColorScale) {
    if (!arguments.length) return groups;
    groups = newGroups;
    colorScale = newColorScale;
    return legend;
  }
  
  /**
   * The function to select the grouping value from the datapoint.  Required in order to send updates to all other connected components when conditioning on groups
   * @default Identity function, which has no effect when deselecting groups.
   * @param {function(Object): string} [grpVal] - The function that returns the group identifier for a given point
   */
  legend.groupColumn = function(grpVal) {
    if (!arguments.length) return groupCol
    groupCol = grpVal;
    return legend;
  }
  
  return d3.rebind(legend, localDispatch, 'on');
}