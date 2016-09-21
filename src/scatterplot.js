import scatterplot_webgl from "./scatterplot_webgl";

export default function(dispatch) {
  // 'global' declarations go here
  var rendering = 'svg';
  var selectionName = undefined;
  var scatterData = [];
  var scatterDataKey = undefined;
  var localDispatch = d3.dispatch('mouseover', 'mouseout', 'mousedown');
  
  var width = 1;
  var height = 1;
  var xValue = function(d) { return +d[0]; };
  var yValue = function(d) { return +d[1]; };
  var scale = { x: undefined, y: undefined };
  var name = ["", ""];

  var availableFields = [];
  var areFieldsSet = false;
  
  var grpValue = null;
  var foundGroups = ["undefined"];
  
  var ptSize = 3;
  var colorScale = null;
  var ptIdentifier = function(d, i) { return "" + d.orig_index; };
  
  var doBrush = false;
  var doVoronoi = false;
  var doZoom = false;

  var brush = undefined;
  var voronoi = undefined;
  var zoomBehavior = undefined;
  
  var duration = 500;

  var isDirty = true;
  var extScatterObj = undefined;
  
  // the shared scales/groups needed by all rendering mechanisms
  function setGlobals(data) {
    // set the discovered groups
      foundGroups = grpValue == null ? 
        ["undefined"] : 
        d3.set(data.map(function(e) { return grpValue(e); })).values();
      colorScale = colorScale || d3.scale.category10();
      colorScale.domain(foundGroups);
      console.log("found %d groups", foundGroups.length);
      dispatch.groupUpdate(foundGroups, colorScale);
      
      // set the axes' domain
      var xd = d3.extent(data, function(e) { return +xValue(e); });
      var yd = d3.extent(data, function(e) { return +yValue(e); });
      scale.x = d3.scale.linear()
        .domain(xd).range([0, width]);
      scale.y = d3.scale.linear()
        .domain(yd).range([height, 0]);
  };

  // shared code to generate voronois for the given points
  function generateVoronoi(selection, points) {
    selection.each(function() {
      var g = d3.select(this);
      
      // (1) use selectAll() instead of select() to prevent setting data on 
      //     the selection from the selector
      // (2) by passing voronoi(points) through a no-op filter(), it removes 
      //     `undefined` indices returned by voronoi for points that failed 
      //     to have a cell created 
      var voronois = g.selectAll('g.voronoi')
        .selectAll('path')
        .data(voronoi(points).filter(function() { return true; }), function(d) { 
          return d.point ? d.point.orig_index : d.orig_index; 
        });
      voronois.enter().append('path')
        .attr('d', function(d) { return "M" + d.join('L') + "Z"; })
        .datum(function(d) { return d.point; })
        .attr('class', function(d) { return "voronoi-" + d.orig_index; })
        // .style('stroke', '#2074A0')
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mouseover', function(d) { 
          var pt = g.selectAll("#circle-" + d.orig_index);
          var ptPos = pt.node().getBoundingClientRect();
          // d3.select(this).style('fill', '#2074A0');
          if (localDispatch.hasOwnProperty('mouseover'))
            localDispatch.mouseover(d, ptPos);
        }).on('mouseout', function(d) {
          // d3.select(this).style('fill', 'none');
          if (localDispatch.hasOwnProperty('mouseout'))
            localDispatch.mouseout(d);
        }).on('mousedown', function(d) { 
          // if a brush is started over a point, hand it off to the brush
          // HACK from <http://stackoverflow.com/questions/37354411/>
          if (doBrush) {
            var e = brush.extent();
            var m = d3.mouse(selection.node());
            var p = [scale.x.invert(m[0]), scale.y.invert(m[1])];
            
            if (brush.empty() || e[0][0] > p[0] || p[0] > e[1][0] || e[0][1] > p[1] || p[1] > e[1][1]) {
              brush.extent([p,p]);
            } else {
              d3.select(this).classed('extent', true);
            }
          } else {
            if (localDispatch.hasOwnProperty('mousedown'))
              localDispatch.mousedown(d);
          }
        });

      // update current voronois?
      voronois.each(function(d) {
        if (Array.isArray(d)) {
          d3.select(this).attr('d', "M" + d.join('L') + "Z")
            .datum(function(d) { return d.point; });
        }
      });

      voronois.exit().remove();
    });
  }
  
  function redrawSVG(selection) {
    console.log("called scatterplot.redrawSVG()");
    selection.each(function() {
      var g = d3.select(this);
      
      // set the scales and determine the groups and their colors
      setGlobals(scatterData);
      
      // construct a brush object for this selection 
      // (TODO / BUG: one brush for multiple graphs?)
      brush = d3.svg.brush()
        .x(scale.x)
        .y(scale.y)
        .on("brush", brushmove)
        .on("brushend", brushend);

      zoomBehavior = d3.behavior.zoom()
        .x(scale.x)
        .y(scale.y)
        .scaleExtent([0, 500])
        .on("zoom", zoom)
        .on("zoomstart", function(d) {
          if (localDispatch.hasOwnProperty('mouseout')) 
            localDispatch.mouseout(d);
        })
        .on("zoomend", function() { 
          if (doVoronoi) {            
            // if no points are hidden, don't draw voronois
            if (g.selectAll('circle.hidden').size() !== 0) {
              // just select the points that are visible in the chartArea
              var activePoints = chartArea.selectAll('circle.point')
                .filter(function(d) {
                  if (d3.select(this).classed('hidden')) return false;
                  var xd = scale.x.domain(), yd = scale.y.domain();
                  return !(xd[0] > xValue(d) || xValue(d) > xd[1] ||
                    yd[0] > yValue(d) || yValue(d) > yd[1]);
                })
                .data();

              // update the voronois
              g.call(generateVoronoi, activePoints);
            }
          } 
        });
      
      // draw axes first so points can go over the axes
      var xaxis = g.selectAll('g.xaxis')
        .data([0]);
      
      // add axis if it doesn't exist  
      xaxis.enter()
        .append('g')
          .attr('class', 'xaxis axis')
          .attr('transform', 'translate(0, ' + height + ')')
          .call(d3.svg.axis().orient("bottom").scale(scale.x));
        
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
        .data([0]);
        
      // add axis if it doesn't exist
      yaxis.enter()
        .append('g')
          .attr('class', 'yaxis axis')
          .call(d3.svg.axis().orient("left").scale(scale.y));
          
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

      // create a group for the chart area, and clip anything that falls outside this
      // * this group lets us zoom/pan outside of objects in the graphs
      g.selectAll('g.chartArea')
        .data([1]).enter().append('g')
          .attr('class', 'chartArea')
          .style('pointer-events', 'all');
      var chartArea = g.select('g.chartArea');

      // set up a clipping mask for the chart area (specific to this selection)
      var thisNode = g.node();
      while ((thisNode = thisNode.parentNode).tagName != 'svg');
      d3.select(thisNode).selectAll('defs').data([1]).enter()
        .append('defs');
      d3.select(thisNode).select('defs')
        .selectAll('clipPath').data([selectionName], function(d) { return d }).enter()
          .append('clipPath')
            .attr('id', function(d) { return d; })
            .append('rect')
              .attr({x: 0, y: 0, width: width, height: height});
     chartArea.attr('clip-path', 'url(#' + selectionName + ')');
      
      // create a group for the circles if it doesn't yet exist  
      chartArea.selectAll('g.circles')
        .data([1]).enter().append('g')
          .attr('class', 'circles');

      // put the brush above the points to allow hover events; see 
      //   <http://wrobstory.github.io/2013/11/D3-brush-and-tooltip.html>
      //   and <http://bl.ocks.org/wrobstory/7612013> ..., but still have
      //   issues: <http://bl.ocks.org/yelper/d38ddf461a0175ebd927946d15140947>
      // RESOLVED: <http://stackoverflow.com/questions/37354411/>
      // create the brush group if it doesn't exist and is requested by `doBrush`
      var brushDirty = false;
      if (doBrush) {
        // remove the zoom-only background element
        chartArea.selectAll('rect.backgroundDrag').remove();

        // this will have no effect if brush elements are already in place
        chartArea.call(brush);
      } else {
        // remove all traces of the brush and deactivate events
        brushDirty = true;
        chartArea.style('pointer-events', null)
          .style('-webkit-tap-highlight-color', null);
        chartArea.selectAll('.background, .extent, .resize').remove();
        chartArea.on('mousedown.brush', null)
          .on('touchstart.brush', null);

        // if zoom AND NOT brush, 
        // make a background element to capture clicks for zooming/panning
        if (doZoom) {
          chartArea.selectAll('rect.backgroundDrag')
            .data([1]).enter().append('rect')
              .attr('class', 'backgroundDrag')
              .attr({x: 0, y: 0, height: height, width: width})
              .style('visibility', 'hidden')
              .style('pointer-events', 'all');
        }
      }
        
      // hack to clear selected points post-hoc after removing brush element 
      // (to get around inifinite-loop problem if called from within the exit() selection)
      if (brushDirty) dispatch.highlight(false);
      
      // deal with setting up the voronoi group
      var voronoiGroup = chartArea.selectAll('g.voronoi')
        .data(doVoronoi ? [0] : []);
      voronoiGroup.enter().append('g')
        .attr('class', 'voronoi');
      voronoiGroup.exit()
        .each(function(d) {
          if (localDispatch.hasOwnProperty('mouseout'))
            localDispatch.mouseout(d);
        })
        .remove();

      if (doZoom) {
        chartArea.call(zoomBehavior);
      }

      // finally, draw the points
      updateGraph();

      function updateGraph(skipTransition) {
        skipTransition = !!skipTransition;

        console.log("updateGraph() called with %d elements", scatterData.length)

        // bind points to circles
        var points = chartArea.select('g.circles').selectAll('circle.point')
          .data(scatterData, ptIdentifier);
          
        points.enter().append('circle')
          .attr("class", "point")
          .attr('id', function(d) { return "circle-" + d.orig_index; })
          .attr('r', ptSize)
          .attr('cx', function(e) { return scale.x(xValue(e)); })
          .attr('cy', function(e) { return scale.y(yValue(e)); })
          .style('fill', grpValue ? function(d) { return colorScale(grpValue(d)); } : colorScale('undefined'))
          .style('opacity', 1)
          .on('mouseover', doVoronoi ? null : function(d) {
            var ptPos = this.getBoundingClientRect();
            if (localDispatch.hasOwnProperty('mouseover'))
              localDispatch.mouseover(d, ptPos);
          })
          .on('mouseout', doVoronoi ? null : function(d) {
            if (localDispatch.hasOwnProperty('mouseout'))
              localDispatch.mouseout(d);
          })
          .on('mousedown', function(d) {
            // if a brush is started over a point, hand it off to the brush
            // HACK from <http://stackoverflow.com/questions/37354411/>
            if (doBrush) {
              var e = brush.extent();
              var m = d3.mouse(g.node());
              var p = [scale.x.invert(m[0]), scale.y.invert(m[1])];
              
              if (brush.empty() || e[0][0] > xValue(d) || xValue(d) > e[1][0] ||
                e[0][1] > yValue(d) || yValue(d) > e[1][1])
              {
                brush.extent([p,p]);
              } else {
                d3.select(this).classed('extent', true);
              }
            } else {
              if (localDispatch.hasOwnProperty('mousedown'))
                localDispatch.mousedown(d);
            }
          });
          
        // if transition was requested, add it into the selection
        var updatePoints = points;
        if (!skipTransition) updatePoints = points.transition().duration(duration);
        updatePoints
          .attr('cx', function(e) { return scale.x(xValue(e)); })
          .attr('cy', function(e) { return scale.y(yValue(e)); })
          .style('fill', grpValue ? function(d) { return colorScale(grpValue(d)); } : colorScale('undefined'))
          .style('opacity', 1);
          
        points.exit().transition()
          .duration(duration)
          .style('opacity', 1e-6)
          .remove();

        // update axis if bounds changed
        var xaxisGrp = g.selectAll('.xaxis');
        if (!skipTransition) xaxisGrp = xaxisGrp.transition().duration(duration); 
        xaxisGrp.call(d3.svg.axis().orient("bottom").scale(scale.x));
          
        var yaxisGrp = g.selectAll('.yaxis');
        if (!skipTransition) yaxisGrp = yaxisGrp.transition().duration(duration); 
        yaxisGrp.call(d3.svg.axis().orient("left").scale(scale.y));

        if (doVoronoi) {
          voronoi = d3.geom.voronoi()
            .x(function(d) { return scale.x(xValue(d)); })
            .y(function(d) { return scale.y(yValue(d)); })
            .clipExtent([[0, 0], [width, height]]);
        }
      }
        
      function brushmove(p) {
        var e = brush.extent();
        g.selectAll("circle").classed("hidden", function(d, i) {
          if (e[0][0] > xValue(d) || xValue(d) > e[1][0] || e[0][1] > yValue(d) || yValue(d) > e[1][1])
            return true;
            
          return false; 
        });
        
        g.selectAll('circle').classed('extent', false);
        g.selectAll('.voronoi path').classed('extent', false);
        
        dispatch.highlight(function(d) { 
          return !(e[0][0] > xValue(d) || xValue(d) > e[1][0] || e[0][1] > yValue(d) || yValue(d) > e[1][1]);
        });
      }
      
      function brushend() {
        if (brush.empty()) {
          // destroy any remaining voronoi shapes
          g.selectAll('.voronoi').selectAll('path').remove();
          
          // destroys any lingering extent rectangles 
          // (can happen when passing mousemoves through voronoi layer)
          g.selectAll('.extent').attr('width', 0).attr('height', 0);
          
          // call any linked mouseout events to finalize brush removals
          // (e.g. hides tooltips when brush disappears and no highlighted points remain)
          if (localDispatch.hasOwnProperty('mouseout'))
            localDispatch.mouseout();
          
          // removes all highlights for all linked components 
          g.selectAll('.hidden').classed('hidden', false);
          dispatch.highlight(false);
        }
      }

      function zoom() {
        // updateGraph(true);
        chartArea.selectAll('circle.point')
          .attr('cx', function(e) { return scale.x(xValue(e)); })
          .attr('cy', function(e) { return scale.y(yValue(e)); });

        g.selectAll('.xaxis')
          .call(d3.svg.axis().orient("bottom").scale(scale.x));
        g.selectAll('.yaxis')
          .call(d3.svg.axis().orient("left").scale(scale.y));
      };
    });
  };
  
  function redrawCanvas(selection) {
    console.log("called scatterplot.redrawCanvas()");
    selection.each(function() {
      // only support points so far
      var container = d3.select(this);
      setGlobals(scatterData);

      if (container.select('canvas').empty() && container.select('svg'))
        initializeCanvasSVGLayers(container);
      
      var canvas = container.select('canvas');
      if (!canvas.node().getContext){
        console.error("Your browser does not support the 2D canvas element; reverting to SVG");
        rendering = 'svg';
        redrawSVG();
      }
      
      var thisData = scatterData.concat(scatterData).concat(scatterData).concat(scatterData).concat(scatterData);

      // draw the points after clearing the canvas 
      var ctx = canvas.node().getContext('2d');
      ctx.clearRect(0, 0, width, height);
      renderPoints(thisData, ctx);
      
      // update the SVG overlay
      updateSVGOverlay(container);
    });
    
    // inspired by <http://bl.ocks.org/syntagmatic/2420080>
    function renderPoints(points, ctx, rate) {
      var n = points.length;
      var i = 0;
      rate = rate || 250;
      ctx.clearRect(0, 0, width, height);
      function render() {
        var max = Math.min(i + rate, n);
        points.slice(i, max).forEach(function(d) { 
          renderPoint(
            ctx, scale.x(xValue(d)), 
            scale.y(yValue(d)), colorScale(grpValue(d)));
        });
        i = max;
      };
      
      (function animloop() {
        if (i >= n) return;
        requestAnimationFrame(animloop);
        render();
      })();
    }
    
    function renderPoint(ctx, x, y, color) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.moveTo(x, y);
      ctx.arc(x, y, ptSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  // only called when a canvas or SVG element is not found 
  // within the container element
  function initializeCanvasSVGLayers(container) {
    // remove all of this items svg/canvas elements
    container.select("svg, canvas").remove();

    // amount of space needed to draw items on the left margin 
    var leftMargin = 50;
    var bottomMargin = 50;

    // create a canvas node
    container.style('position', 'relative')
      .style('padding-bottom', bottomMargin + 'px');
    container.append('canvas')
      .attr('width', width)
      .attr('height', height)
      .style('margin-left', leftMargin + "px");

    var svg = container.append('svg')
      .attr('width', width + leftMargin)
      .attr('height', height + bottomMargin)
      .style('zIndex', 10)
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0);

    svg.append('g')
      .attr('class', 'container')
      .attr('transform', 'translate(' + leftMargin + ',0)');
  }

  // initialize the SVG layer to capture mouse interaction; show brushes, axes, etc.
  function updateSVGOverlay(container) {
    var svg = container.select('svg');
    svg = svg.select('g.container');
    // brush = d3.svg.brush()
    //   .x(scale.x)
    //   .y(scale.y)
    //   .on('brush', brushmove)
    //   .on('brushend', brushend);

    var xaxis = svg.selectAll('g.xaxis')
      .data([0]);

    xaxis.enter()
      .append('g')
        .attr('class', 'xaxis axis')
        .attr('transform', 'translate(0, ' + height + ')')
        .call(d3.svg.axis().orient('bottom').scale(scale.x));

    xaxis.transition()
      .duration(duration)
      .attr('transform', 'translate(0,'+height+')')
      .call(d3.svg.axis().orient('bottom').scale(scale.x));

    var xLabel = xaxis.selectAll('text.alabel')
      .data([name[0]]);

    xLabel.enter().append('text')
      .attr('class', 'alabel')
      .attr('transform', 'translate(' + (width / 2) + ',20)')
      .attr('dy', '1em')
      .style('text-anchor', 'middle');
    xLabel.text(function(d) { return d; });
    xLabel.exit().remove();

    var yaxis = svg.selectAll('g.yaxis')
      .data([0]);

    yaxis.enter()
      .append('g')
        .attr('class', 'yaxis axis')
        .call(d3.svg.axis().orient('left').scale(scale.y));

    yaxis.transition()
      .duration(duration)
      .call(d3.svg.axis().orient('left').scale(scale.y));

    var yLabel = yaxis.selectAll('text.alabel')
      .data([name[1]]);
    yLabel.enter()
      .append('text')
        .attr('class', 'alabel')
        .attr('transform', 'rotate(-90)')
        .attr('y', -25)
        .attr('x', -(height / 2))
        .attr('dy', '-1em')
        .style('text-anchor', 'middle')
    yLabel.text(function(d) { return d; });
    yLabel.exit().remove();
  }

  function redrawWebGL(selection) {
    console.log("called scatterplot.redrawWebGL()");
    selection.each(function() {
      var container = d3.select(this);
      setGlobals(scatterData);

      if (container.select('canvas').empty() && container.select('svg'))
        initializeCanvasSVGLayers(container);

      // create the external object to handle rendering, if it doesn't exist
      if (!extScatterObj) {
        extScatterObj = new scatterplot_webgl(selection, isDirty);
      }
        
      // explicitly update data and call a render on the WebGL helper
      updateWebGLdata(scatterData);
      selection.call(extScatterObj.setColorScale(colorScale), isDirty);
      isDirty = false;

      // update the SVG overlay
      updateSVGOverlay(container);
    });
  }

  function updateWebGLdata(thisData) {
    if (extScatterObj)
      extScatterObj.setData(thisData, xValue, yValue, grpValue, foundGroups, scale);
    else
      console.warn("tried to update webgl data before initializing canvas");
  }
  
  /**
   * Kicks off a render of the scatterplot object on the given selection. Following D3.js convention,
   * this should be executed on a selection, 
   * e.g., d3.select('g.scatterplot').call(scatterObj, '.scatterplot'). 
   * The name argument is required to ensure that highlight dispatches from the factory are routed
   * to the correct scatterplots.
   * @param {d3.Selection} selection - The selection in which to instantiate and redraw the scatterplot.
   * @param {string} name - The name of this selection to namespace factory dispatch methods (this should be unique across all instantiated d3-twoDim components) 
   */
  function scatterplot(selection, name) {
    selectionName = name;
    
    switch (rendering) {
      case 'svg':
        redrawSVG(selection);
        break;
      case 'canvas':
        redrawCanvas(selection);
        break;
      case 'webgl': 
        redrawWebGL(selection);
        break;
    }
    
    dispatch.on('highlight.' + name, function(selector) {
      switch (rendering) {
        case 'svg': 
          var allPoints = selection.selectAll('circle');
          if (typeof selector === "function") {
            allPoints.classed('hidden', true);
            allPoints.filter(selector).classed('hidden', false);
            
            // generate relevant voronoi
            if (doVoronoi) {
              selection.call(generateVoronoi, scatterData.filter(selector));
            }
            
            // reorder points to bring highlighted points to the front
            allPoints.sort(function(a, b) {
              if (selector(a)) {
                if (selector(b))
                  return 0;
                else
                  return 1;
              } else {
                if (selector(b))
                  return -1;
                else
                  return 0;
              }
            });
          } else if (!selector) {
            allPoints.classed('hidden', false);
            allPoints.sort(function(a,b) { return d3.ascending(a.orig_index, b.orig_index); });
            
            if (doVoronoi) {
              selection.selectAll('g.voronoi').selectAll('path').remove();
            }
          }
          break;
        default:
          throw "highlight not implemented for " + rendering;
      }
    });
  }
  
  /**
   * Gets or sets the data bound to points in the scatterplot.  Following D3.js convention, this should be an array of anonymous objects.  Generally set all at once by the twoDFactory.setData() method
   * @default Empty array: []
   * @param {Object[]} The data of the scatterplot.  Set the `.x()` and `.y()` accessors for the x- and y-dimensions of the scatterplot
   * @param {function(Object[]): string} The key function for the data (similar to the key function in `d3.data([data, [key]])`)
   */
  scatterplot.data = function(newData, key) {
    if (!arguments.length) return scatterData;
    scatterData = newData;

    // TODO: test if there are <2 fields available, very likely that the code following will fail in those cases

    // if datums are objects, collect the available field names
    if (!Array.isArray(newData[0])) {
      for (var field in newData[0]) {
        if (newData[0].hasOwnProperty(field)) {
          availableFields.push(field);
        }
      }
      
      // if no field has been selected to view, select the first two fields
      if (!areFieldsSet) {
        scatterplot.fields(availableFields.slice(0, 2));
      }
    }
    
    // add original index value (this could be randomized)
    scatterData.forEach(function(d, i) {
      d['orig_index'] = i;
    });
    
    if (key)
      scatterDataKey = key;
    
    return scatterplot;
  };
  
  /**
   * Gets or sets the type of rendering mechanism.  One of "svg", "canvas", or "webgl".  Subsequent calls of `scatterplot` on a selection will populate the selections with the given rendering type
   */
  scatterplot.renderType = function(renderType) {
    if (!arguments.length) return rendering;
    if (['svg', 'canvas', 'webgl'].indexOf(renderType) == -1)
      throw "Expected value of 'svg', 'canvas', or 'webgl' to scatterplot.renderType";
    rendering = renderType;
    return scatterplot;
  }
  
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
    isDirty = true;
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
    isDirty = true;
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
    xValue = function(d) { return +d[xField]; };
    areFieldsSet = true;
    isDirty = true;

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
    yValue = function(d) { return +d[yField]; };
    areFieldsSet = true;
    isDirty = true;

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
    xValue = function(d) { return +d[name[0]]; };
    yValue = function(d) { return +d[name[1]]; };
    areFieldsSet = true;
    isDirty = true;
    
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
   * @param {function(Object): string} [grpVal] - The function that returns the group identifier for a given point
   */
  scatterplot.groupColumn = function(grpVal) {
    if (!arguments.length) return grpVal;
    grpValue = grpVal;
    isDirty = true;
    return scatterplot;
  }
  
  /**
   * The d3.ordinal color scale to map to the grouping column. The domain of the colorscale will 
   * be set at draw time from the current data.
   * @default Uses the `d3.scale.category10() color scale.
   * @param {d3.scale.ordinal(): string} [newScale] - The new `d3.scale.ordinal()` scale to use.
   */
  scatterplot.colorScale = function(newScale) {
    if (!arguments.length) return colorScale;
    colorScale = newScale;
    if (extScatterObj) extScatterObj.setColorScale(colorScale);
    return scatterplot;
  }
  
  /**
   * Tells the scatterplot to support a D3 brush component.  
   * Points not selected by the brush will have the `.hidden` CSS class selector added.
   * @default false (no brush will be added to the scatterplot)
   * @todo Currently unable to enable both zoom and brush concurrently (mouse overloading)
   * @param {boolean} [newBrush] Whether or not to add a brush to the scatterplot.
   */
  scatterplot.doBrush = function(newBrush) {
    if (!arguments.length) return doBrush;
    doBrush = newBrush;
    return scatterplot;
  }
  
  /**
   * Tells the scatterplot to generate a voronoi based on the highlighted points (helpful for binding hover events to)
   * @default false (no voronoi will be generated when points are highlighted)
   * @param {boolean} [newVoronoi] - Whether or not to update a voronoi diagram based on highlighted points
   */
  scatterplot.doVoronoi = function(newVoronoi) {
    if (!arguments.length) return doVoronoi;
    doVoronoi = newVoronoi;
    return scatterplot;
  }

  /**
   * Tells the scatterplot to support zooming and panning the scatterplot
   * @default false (viewer will be unable to zoom and pan the scatterplot)
   * @todo Currently unable to enable both zoom and brush concurrently (mouse overloading)
   * @param {boolean} [newZoom] - Whether or not to enable zooming and panning in the scatterplot
   */
  scatterplot.doZoom = function(newZoom) {
    if (!arguments.length) return doZoom;
    doZoom = newZoom;
    return scatterplot;
  }
  
  return d3.rebind(scatterplot, localDispatch, 'on');
};
