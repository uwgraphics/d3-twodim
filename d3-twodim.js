(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-twodim', ['exports'], factory) :
  factory((global.d3_twodim = {}));
}(this, function (exports) { 'use strict';

  function scatterplot_webgl() {
    var gl;
    var prog;

    var width;
    var height;

    var data;
    var scale;
    var xValue;
    var yValue;
    var grpVal;
    var foundGroups;

    var points;
    var pointsBuf;
    var colorScale;
    var flattenedColors;
    var colorRampTexture;
    var colorRampWidth;

    var ptSize = 7;
    var curTransform;

    var basicVertexShader = " \
    attribute vec2 position; \
    attribute float colorIndex; \
    \
    uniform mat4 mvp; \
    uniform float pointSize; \
    \
    uniform sampler2D colorRamp; \
    uniform float colorRampWidth; \
    \
    varying vec4 vColor; \
    \
    void main() { \
      gl_Position = mvp * vec4(position, 0.0, 1.0); \
      gl_PointSize = pointSize; \
      \
      float colorY = floor(colorIndex / colorRampWidth) / colorRampWidth; \
      float colorX = floor(mod(colorIndex, colorRampWidth)) / colorRampWidth; \
      vColor = texture2D(colorRamp, vec2(colorX, colorY) + vec2(1.0 / colorRampWidth / 2.0)); \
    }";
    
    var basicFragShader = " \
    precision highp float; \
    varying vec4 vColor; \
    \
    void main() { \
      gl_FragColor = vColor; \
      float dist = distance(gl_PointCoord, vec2(0.5)); \
      gl_FragColor.a = 1.0 - smoothstep(0.45, 0.55, dist); \
    }";

    function compileShaders() {
      function comp(str, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn("Error compiling shader: " + gl.getShaderInfoLog(shader));
          return null;
        }

        return shader;
      }

      prog = gl.createProgram();
      gl.attachShader(prog, comp(basicVertexShader, gl.VERTEX_SHADER));
      gl.attachShader(prog, comp(basicFragShader, gl.FRAGMENT_SHADER));
      gl.linkProgram(prog);

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn("Could not initialize shader program");
        return;
      }

      gl.useProgram(prog);

      prog.points = gl.getAttribLocation(prog, 'position');
      gl.enableVertexAttribArray(prog.points);
      prog.colorIndex = gl.getAttribLocation(prog, 'colorIndex');
      gl.enableVertexAttribArray(prog.colorIndex);

      prog.pointSize = gl.getUniformLocation(prog, 'pointSize');
      prog.mvp = gl.getUniformLocation(prog, 'mvp');
      prog.colorRamp = gl.getUniformLocation(prog, 'colorRamp');
      prog.colorRampWidth = gl.getUniformLocation(prog, 'colorRampWidth');
    }

    function initCanvas() {
      gl.disable(gl.DEPTH_TEST);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.enable(gl.BLEND);

      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.viewport(0, 0, width, height);

      pointsBuf = gl.createBuffer();
    }

    function setBounds() {
      if (!scale)
        throw "Need to call webgl component with data before drawing";
      
      var scale_x = 2 / (scale.x.domain()[1] - scale.x.domain()[0]);
      var scale_y = 2 / (scale.y.domain()[1] - scale.y.domain()[0]);
      var trans_x = -1 - scale.x.domain()[0];
      var trans_y = -1 - scale.y.domain()[0];

      curTransform = new Float32Array([
        scale_x, 0,       0, 0,
        0,       scale_y, 0, 0, 
        0,       0,       1, 0,
        trans_x, trans_y, 0, 1
      ]);
    };

    function genDataBuffer() {
      points = [];
      var colorRange = colorScale.range();
      data.forEach(function(d) {
        points.push(xValue(d));
        points.push(yValue(d));
        points.push(colorRange.indexOf(colorScale(grpVal(d)))); // get the color index for texture lookup
      });

      gl.bindBuffer(gl.ARRAY_BUFFER, pointsBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

      setBounds();
    }

    function setUniforms() {
      gl.uniform1f(prog.pointSize, ptSize);
      gl.uniformMatrix4fv(prog.mvp, false, curTransform);
      gl.uniform1f(prog.colorRampWidth, colorRampWidth);

      // set the color ramp
      colorRampTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, colorRampTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, colorRampWidth, colorRampWidth,
        0, gl.RGBA, gl.UNSIGNED_BYTE, flattenedColors);
    }
    
    function render() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, colorRampTexture);
      gl.uniform1i(prog.colorRamp, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, pointsBuf);
      gl.vertexAttribPointer(prog.points, 2, gl.FLOAT, false, 12, 0);
      gl.vertexAttribPointer(prog.colorIndex, 1, gl.FLOAT, false, 12, 8);
      gl.drawArrays(gl.POINTS, 0, data.length);
    }
    
    // assume that an SVG/canvas combination has already been set up with correct width/height
    function scatterplot_webgl(selection, isDirty) {
      if (!gl) {
        var webglCanvas = selection.select('canvas');
        gl = webglCanvas.node().getContext('webgl');
        if (!gl) {
          console.error("Your browser does not seem to support WebGL, should revert to canvas/SVG.");
          return -1;
        }

        width = +webglCanvas.attr('width');
        height = +webglCanvas.attr('height');

        initCanvas();
      }

      if (!prog)
        compileShaders();

      if (isDirty) {
        genDataBuffer();
        setUniforms();
      }

      render();
    };

    scatterplot_webgl.setData = function(dataN, xValueN, yValueN, grpValueN, foundGroupsN, scaleN) {
      data = dataN;
      xValue = xValueN;
      yValue = yValueN;
      grpVal = grpValueN;
      foundGroups = foundGroupsN;
      scale = scaleN;

      return scatterplot_webgl;
    }

    scatterplot_webgl.setColorScale = function(newScale) {
      colorScale = newScale;
      var colors = newScale.range();

      colorRampWidth = Math.ceil(Math.sqrt(colors.length));
      flattenedColors = new Uint8Array(colorRampWidth * colorRampWidth  * 4);
      colors.forEach(function(d, i) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(d);
        flattenedColors[i * 4]     = parseInt(result[1], 16);
        flattenedColors[i * 4 + 1] = parseInt(result[2], 16);
        flattenedColors[i * 4 + 2] = parseInt(result[3], 16);
        flattenedColors[i * 4 + 3] = 255;
      });
      
      return scatterplot_webgl;
    }

    scatterplot_webgl.circleSize = function(newSize) {
      ptSize = newSize;
      return scatterplot_webgl;
    }

    return scatterplot_webgl;
  }

  function scatterplot(dispatch) {
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
    
    function scatterplot(selection, name) {
      // selection.each(function(d, i) {
      //   var g = d3.select(this);
      //   g.data([scatterData], scatterDataKey);
      // });

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

  function objectlist(dispatch) {
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

      dispatch.on('highlight.' + name, function(selector) {
        if (typeof selector === "function") {   
          selection.each(function(d, i) {
            var g = d3.select(this);
            g.data([thisData.filter(selector)], thisDataKey);
          });
        } else if (!selector) {
          selection.each(function(d, i) {
            d3.select(this).data([], thisDataKey);
          });
        }
        
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

  function dropdown(dispatch) {
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

  function legend(dispatch) {
    var thisData = [];
    var thisDataKey = undefined;
    var localDispatch = d3.dispatch("click");

    var groups = ['unknown'];
    var groupData = {name: 'unknown', active: true};
    var groupCol = function(d) { return d; }; 
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
      
      if (allActive) {
        dispatch.highlight(false);
      } else {
        var selectedGroups = groupData
          .filter(function(d) { return d.active; })
          .map(function(d) { return d.name; });
          
        dispatch.highlight(function(d) { return selectedGroups.indexOf(groupCol(d)) != -1; });
      }
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

  var version = "0.0.1";

  exports.version = version;
  exports.scatterplot = scatterplot;
  exports.scatterplot_webgl = scatterplot_webgl;
  exports.objectlist = objectlist;
  exports.dropdown = dropdown;
  exports.legend = legend;
  exports.twoDimFactory = twoDimFactory;

}));