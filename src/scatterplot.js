export default function(dispatch) {
  // 'global' declarations go here
  var scatterData = [];
  var scatterDataKey = undefined;
  
  var width = 1;
  var height = 1;
  var xValue = function(d) { return +d[0]; };
  var yValue = function(d) { return +d[1]; };
  var name = ["", ""];
  
  var grpValue = null;
  var foundGroups = ["undefined"];
  
  var ptSize = 3;
  var colorScale = null;
  var ptIdentifier = function(d, i) { return i; };
  
  var doBrush = false;
  
  var duration = 500;
  
  function redraw(selection) {
    console.log("called scatterplot.redraw()");
    selection.each(function(data, i) {
      var g = d3.select(this);
      var xd = d3.extent(data, function(e) { return xValue(e); });
      var yd = d3.extent(data, function(e) { return yValue(e); });
            
      foundGroups = grpValue == null ? ["undefined"] : d3.set(data.map(function(e) { return grpValue(e); })).values();
      colorScale = colorScale || d3.scale.category10();
      colorScale.domain(foundGroups);
      console.log("found %d groups", foundGroups.length);
      dispatch.groupUpdate(foundGroups, colorScale);
      
      var x1 = d3.scale.linear()
        .domain(xd)
        .range([0, width]);
        
      var y1 = d3.scale.linear()
        .domain(yd)
        .range([height, 0]);
      
      var brush = d3.svg.brush()
        .x(x1)
        .y(y1)
        .on("brush", brushmove)
        .on("brushend", brushend);
      
      // retireve/stash scales to make for seamless updating;
      // with thanks to the qq plugin for making this cute: 
      // <https://github.com/d3/d3-plugins/blob/master/qq/qq.js>
      var x0, y0;
      if (this.__chart__) {
        x0 = this.__chart__.x0;
        y0 = this.__chart__.y0;
      } else {
        x0 = d3.scale.linear().domain([0, Infinity]).range(x1.range());
        y0 = d3.scale.linear().domain([0, Infinity]).range(y1.range());
      }
      this.__chart__ = {x: x1, y: y1};
      
      // draw axes first so points can go over the axes
      var xaxis = g.selectAll('g.xaxis')
        .data([xd]);
      
      // add axis if it doesn't exist  
      xaxis.enter()
        .append('g')
          .attr('class', 'xaxis axis')
          .attr('transform', 'translate(0, ' + height + ')')
          .call(d3.svg.axis().orient("bottom").scale(x1));
          
      // update axis if x-bounds changed
      xaxis.transition()
        .duration(duration)
        .attr('transform', 'translate(0, ' + height + ')')
        .call(d3.svg.axis().orient("bottom").scale(x1));
        
      var xLabel = xaxis.selectAll('text.alabel')
        .data([name[0]]);
        
      xLabel.enter().append('text')
        .attr('class', 'alabel')
        .attr('transform', 'translate(' + (width / 2) + ',20)')
        .attr('dy', '1em')
        .style('text-anchor', 'middle');
      xLabel.text(function(d) { return d; });
      xLabel.exit().remove();
        
      var yaxis = g.selectAll('g.yaxis')
        .data([yd]);
        
      // add axis if it doesn't exist
      yaxis.enter()
        .append('g')
          .attr('class', 'yaxis axis')
          .call(d3.svg.axis().orient("left").scale(y1));
          
      // update axis if y-bounds changed
      yaxis.transition()
        .duration(duration)
        .call(d3.svg.axis().orient("left").scale(y1));
        
      var yLabel = yaxis.selectAll('text.alabel')
        .data([name[1]]);
      yLabel.enter().append('text')
        .attr('class', 'alabel')
        .attr('transform', 'rotate(-90)')
        .attr('y', -25)
        .attr('x', -(height / 2))
        .attr('dy', '-1em')
        .style('text-anchor', 'middle');
      yLabel.text(function(d) { return d; });
      yLabel.exit().remove();
        
      
      // create a group for the circles if it doesn't yet exist  
      g.selectAll('g.circles')
        .data([1]).enter().append('g')
          .attr('class', 'circles');
          
      // bind points to circles
      var points = g.select('g.circles').selectAll('circle.point')
        .data(data, ptIdentifier);
        
      points.enter().append('circle')
        .attr("class", "point")
        .attr('r', ptSize)
        .attr('cx', function(d) { return x0(xValue(d)); })
        .attr('cy', function(d) { return y0(yValue(d)); })
        .style('fill', function(d) { return colorScale(grpValue(d)); })
        .style('opacity', 1e-6)
      .transition()
        .duration(duration)
        .attr('cx', function(e) { return x1(xValue(e)); })
        .attr('cy', function(e) { return y1(yValue(e)); })
        .style('fill', function(d) { return colorScale(grpValue(d)); })
        .style('opacity', 1);
        
      points.transition()
        .duration(duration)
        .attr('cx', function(e) { return x1(xValue(e)); })
        .attr('cy', function(e) { return y1(yValue(e)); })
        .style('fill', function(d) { return colorScale(grpValue(d)); })
        .style('opacity', 1);
        
      points.exit().transition()
        .duration(duration)
        .attr('cx', function(e) { return x1(xValue(e)); })
        .attr('cy', function(e) { return y1(yValue(e)); })
        .style('fill', function(d) { return colorScale(grpValue(d)); })
        .style('opacity', 1e-6)
        .remove();
        
      // create the brush group if it doesn't exist and is requested by `doBrush`
      var brushGroup = g.selectAll('g.brush')
        .data(doBrush ? [0] : []);

      // create the brush if it should exist        
      brushGroup.enter().append('g')
          .attr('class', 'brush')
          //.call(brush);
      brushGroup.call(brush);

      // if the brush is to be removed, force no selected indices
      var brushDirty = false;          
      brushGroup.exit()
        .each(function() { 
          brushDirty = true;
          g.selectAll('circle.hidden').classed('hidden', false); 
        })
        .remove();
        
      // hack to clear selected points post-hoc after removing brush element 
      // (to get around inifinite-loop problem if called from within the exit() selection)
      if (brushDirty) dispatch.redraw([]);
        
      function brushmove(p) {
        var e = brush.extent();
        var indices = [];
        
        g.selectAll("circle").classed("hidden", function(d, i) {
          if (e[0][0] > xValue(d) || xValue(d) > e[1][0] || e[0][1] > yValue(d) || yValue(d) > e[1][1])
            return true;
            
          indices.push(i);
          return false; 
        });
        
        dispatch.redraw(indices)
      }
      
      function brushend() {
        if (brush.empty()) {
          g.selectAll('.hidden').classed('hidden', false);
          dispatch.redraw([]);
        }
      }
    });
  };
  
  function scatterplot(selection, name) {
    selection.each(function(d, i) {
      var g = d3.select(this);
      g.data([scatterData], scatterDataKey);
    });
    
    redraw(selection);
    
    dispatch.on('redraw.' + name, function(dataIndices) {
      console.log("scatterplot dispatch called for " + name + "!");
      
      // TODO: try to sort to put highlighted circles in front
      // selection.selectAll("circle").sort(function(a,b) {
      //   return dataIndices.indexOf()
      // });
      
      if (dataIndices.length == 0) {
        selection.selectAll("circle").classed('hidden', false);
      } else {
        selection.selectAll("circle").classed("hidden", function(d, i) {
          return dataIndices.indexOf(i) == -1;
        });
      }
      
      // this lags the webpage too much... why?
      // ^^ because it contains transitions that don't actually transition! 
      // d3.timer goes nuts trying to schedule nothing
      // redraw(selection);
    });
  }
  
  /**
   * Gets or sets the data bound to points in the scatterplot.  Following D3.js convention, this should be an array of anonymous objects
   * @default Empty array: []
   * @param {Object[]} The data of the scatterplot.  Set the `.x()` and `.y()` accessors for the x- and y-dimensions of the scatterplot
   * @param {function(Object[]): string} The key function for the data (similar to the key function in `d3.data([data, [key]])`)
   */
  scatterplot.data = function(newData, key) {
    if (!arguments.length) return scatterData;
    scatterData = newData;
    
    if (key)
      scatterDataKey = key;
    
    return scatterplot;
  };
  
  /**
   * The width of the constructed scatterplot.  The caller is responsible for maintaining sensible margins.
   * @default 1 (pixel)
   * @param {number} [val] - Sets the width of the scatterplot to the given value (in pixels).
   */ 
  scatterplot.width = function(val) {
    if (!arguments.length) return width;
    width = val;
    return scatterplot;
  };
  
  /**
   * The height of the constructed scatterplot.  The caller is responsible for maintaining sensible margins.
   * @default 1 (pixel)
   * @param {number} [val] - Sets the height of the scatterplot to the given value (in pixels).
   */
  scatterplot.height = function(val) {
    if (!arguments.length) return height;
    height = val;
    return scatterplot;
  }
  
  /**
   * The function to select the x-value from the datapoint
   * @default Function selects the first value in the datum (e.g. d[0])
   * @param {function(): number} [xVal] - The function that returns the x-axis value for a given point
   */
  scatterplot.x = function(xVal) {
    if (!arguments.length) return xValue;
    xValue = xVal;
    return scatterplot;
  }
  
  /**
   * The function to select the y-value from the datapoint
   * @default Function select the second value in the datum (e.g. d[1])
   * @param {function(): number} [yVal] - The function that returns the y-axis value for a given point
   */
  scatterplot.y = function(yVal) {
    if (!arguments.length) return yValue;
    yValue = yVal;
    return scatterplot;
  }
  
  /**
   * Sets the x-axis label for the scatterplot.
   * @default Blank value; no axis label is drawn.
   * @param {string} [xName] - The text that describes the x-axis
   */
  scatterplot.xLabel = function(xName) {
    if (!arguments.length) return name[0];
    name[0] = xName;
    return scatterplot;
  }
  
  /**
   * Sets the y-axis label for the scatterplot
   * @default Blank value; no axis label is drawn
   * @param {string} [yName] - The text that describes the y-axis
   */
  scatterplot.yLabel = function(yName) {
    if (!arguments.length) return name[1];
    name[1] = yName; 
    return scatterplot;
  }
  
  /**
   * Sets the x- and y-axis labels for the scatterplot at the same time, given an array of two strings.
   * @default Blank value; no axis label is drawn for both axes
   * @param {string[]} [names] - Array of labels to describe the x- and y-axis, respectively 
   */
  scatterplot.labels = function(names) {
    if (!arguments.length) return name; 
    if (names.length != 2) throw "Expected an array of length two for scatterplot.labels: [xLabel, yLabel]"
    name = names;
    return scatterplot;
  }
  
  /**
   * Convenience method to set the field for the x-dimension (given the row is an object and not an array), and co-occurrently sets the xLabel
   * @default Function that selects the value for the x-dimension (e.g. d[0])
   * @param {string} [xField] - The field from which to read the continuous value for the x-dimension
   */
  scatterplot.xField = function(xField) {
    if (!arguments.length) return name[0];
    name[0] = xField;
    xValue = function(d) { return d[xField]; };
    return scatterplot; 
  }
  
  /**
   * Convenience method to set the field for the y-dimension (given the row is an object and not an array), and co-occurrently sets the yLabel
   * @default Function that selects the value for the y-dimension (e.g. d[0])
   * @param {string} [yField] - The field from which to read the continuous value for the y-dimension
   */
  scatterplot.yField = function(yField) {
    if (!arguments.length) return name[1];
    name[1] = yField;
    yValue = function(d) { return d[yField]; };
    return scatterplot;
  }
  
  /**
   * Convenience method to set fields for both dimensions (given that rows are objects and not arrays), and co-occurrently sets the labels for the two dimensions
   * @default Blank values for axis labels
   * @param {string[]} [fields] - Array of fields for the x- and y-axis, respectively
   */
  scatterplot.fields = function(fields) {
    if (!arguments.length) return name;
    if (fields.length != 2) throw "Expected an array of length two for scatterplot.fields: [xField, yField]";
    name = fields;
    xValue = function(d) { return d[fields[0]]; };
    yValue = function(d) { return d[fields[1]]; };
    return scatterplot;
  }
  
  /**
   * The size of the scatterplot marks
   * @default 3 (pixels)
   * @param {number} [newSize] - The new scatterplot mark size
   */
  scatterplot.circleSize = function(newSize) {
    if (!arguments.length) return ptSize;
    ptSize = newSize;
    return scatterplot; 
  }
  
  /**
   * Gets or sets the duration of animated transitions (in milliseconds) when updating the scatterplot bounds, axes, or point locations
   * @default Transitions have a duration of 500ms
   * @param {number} [newDuration] - The new duration of all animated transitions.
   */
  scatterplot.changeDuration = function(newDuration) {
    if (!arguments.length) return duration;
    duration = newDuration;
    return scatterplot;
  }
  
  /**
   * Pass in a custom function to uniquely identify a point (so it can be updated)
   * @default Uses the index of the point in the list of points (d3's default for key-less data)
   * @param {function()} [newIDFunc] - A function that returns a unique indentifier for a given point 
   */
  scatterplot.pointIdentifier = function(newIDFunc) {
    if (!arguments.length) return ptIdentifier;
    ptIdentifier = newIDFunc;
    return scatterplot;
  }
  
  /**
   * The function to select the grouping value from the datapoint
   * @default No function, meaning that all points are considered to be from the same series
   * @param {function(): string} [grpVal] - The function that returns the group identifier for a given point
   */
  scatterplot.groupColumn = function(grpVal) {
    if (!arguments.length) return grpVal;
    grpValue = grpVal;
    return scatterplot;
  }
  
  /**
   * The color scale to map to the grouping column. The domain of the colorscale will be set at draw time from the current data.
   * @default Uses the `d3.scale.category10() color scale.
   * @param {d3.scale.ordinal(): string} [newScale] - The new `d3.scale.ordinal()` scale to use.
   */
  scatterplot.colorScale = function(newScale) {
    if (!arguments.length) return colorScale;
    colorScale = newScale;
    return scatterplot;
  }
  
  /**
   * Tells the scatterplot to support a D3 brush component.  
   * Points not selected by the brush will have the `.hidden` CSS class selector added.
   * @default false (no brush will be added to the scatterplot)
   * @param {boolean} [newBrush] Whether or not to add a brush to the scatterplot.
   */
  scatterplot.doBrush = function(newBrush) {
    if (!arguments.length) return doBrush;
    doBrush = newBrush;
    return scatterplot;
  }
  
  return scatterplot;
};
