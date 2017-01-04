import scatterplot_component from './scatterplot_component';

function points(configObject) {
  scatterplot_component.call(this, configObject);
}
points.prototype = Object.create(scatterplot_component.prototype);

points.prototype.draw = function(container, skipTransition) {
  var that = this;
  skipTransition = !!skipTransition;

  var points = container.select('g.circles').selectAll('circle.point')
    .data(this.data, function(d) { return d.orig_index; });
    
  points.enter().append('circle')
    .attr("class", "point")
    .attr('id', function(d) { return "circle-" + d.orig_index; });
    
  // if transition was requested, add it into the selection
  var updatePoints = points;
  if (!skipTransition) updatePoints = points.transition().duration(this.duration);
  updatePoints
    .attr('cx', function(e) { return that.scale.x(that.xValue(e)); })
    .attr('cy', function(e) { return that.scale.y(that.yValue(e)); })
    .attr('r', this.ptSize)
    .style('fill', that.grpValue ? 
      function(d) { return that.colorScale(that.grpValue(d)); } :
      that.colorScale('undefined')
    )
    .style('opacity', 1);
    
  points.exit().transition()
    .duration(this.duration)
    .style('opacity', 1e-6)
    .remove();
};

// called whenever bounds change (no data changes)
points.prototype.update = function(container, skipTransition) {
  var that = this;
  if (!skipTransition) container = container.transition().duration(this.duration);
  container.selectAll('circle.point')
    .attr('cx', function(d) { return that.scale.x(that.xValue(d)); })
    .attr('cy', function(d) { return that.scale.y(that.yValue(d)); });
}

points.prototype.visualEncSelector = function() {
  return 'circle.point';
}

export default points;