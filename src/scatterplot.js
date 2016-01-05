/// <reference path="d3.d.ts" />

export default function() {
  // 'global' declarations go here
  var width = 1;
  var height = 1;
  
  var duration = 200;
  
  function scatterplot(selection) {
    selection.each(function(d, i) {
      var g = d3.select(this);
      var xd = [d3.min(d, function(e) { return e[0]; }), d3.max(d, function(e) { return e[0]; })];
      var yd = [d3.min(d, function(e) { return e[1]; }), d3.max(d, function(e) { return e[1]; })];
      
      
      var x1 = d3.scale.linear()
        .domain(xd)
        .range([0, width]);
        
      var y1 = d3.scale.linear()
        .domain(yd)
        .range([0, height]);
        
      var points = g.selectAll('circle.point')
        .data(d);
        
      points.enter().append('circle')
        .attr("class", "point")
        .attr('r', 1)
        .attr('cx', function(e) { return x1(d[0]); })
        .attr('cy', function(e) { return y1(d[1]); });
        
      points.transition()
        .duration(duration)
        .attr('cx', function(e) { return x1(d[0]); })
        .attr('cy', function(e) { return y1(d[1]); })
        .style('opacity', 1);
        
      points.exit().transition()
        .duration(duration)
        .style('opacity', 1e-6)
        .remove();
        
        
        
      
    });
    
    
    
  }
  
  scatterplot.width = function(val) {
    if (!arguments.length) return width;
    width = val;
    return scatterplot;
  };
  
  scatterplot.height = function(val) {
    if (!arguments.length) return height;
    height = val;
    return scatterplot;
  }
};
