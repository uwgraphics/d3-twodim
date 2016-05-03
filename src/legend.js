export default function(dispatch) {
  var thisData = [];
  var thisDataKey = undefined;//function(d) { return d };
  var localDispatch = d3.dispatch("click");

  var groups = ['unknown'];
  var groupData = {name: 'unknown', active: true};
  var groupColumn = function(d) { return d; }; // TODO: hook this up
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
    // call redraw (HOW???)
    
    // gather the relevant IDs
    var selectedIndices = [];
    if (!allActive) {
      var selectedGroups = groupData
        .filter(function(d) { return d.active; })
        .map(function(d) { return d.name; });
        
      thisData.forEach(function(d, i) {
        if (selectedGroups.indexOf(groupColumn(d)) != -1)
          selectedIndices.push(i);
      });
    }
    
    dispatch.redraw(selectedIndices);
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
    
    dispatch.on('redraw.' + name, function(selectedIndices) {
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
  
  legend.groups = function(newGroups, newColorScale) {
    if (!arguments.length) return groups;
    groups = newGroups;
    colorScale = newColorScale;
    return legend;
  }
  
  legend.data = function(newData, key) {
    if (!arguments.length) return thisData;
    thisData = newData;
    if (key) thisDataKey = key;
    return legend;
  }
  
  return d3.rebind(legend, localDispatch, 'on');
}