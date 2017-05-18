import scatterplot_component from './scatterplot_component';

function points(configObject) {
  scatterplot_component.call(this, configObject);
}
points.prototype = Object.create(scatterplot_component.prototype);

points.prototype.draw = function(container, skipTransition) {
  var that = this;
  skipTransition = !!skipTransition;

  // create a group for the circles if it doesn't yet exist  
  container.selectAll('g.circles')
    .data([1]).enter().append('g')
      .attr('class', 'circles');

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

points.prototype.highlight = function(container, selector) {
  var allPoints = container.selectAll(this.visualEncSelector());
  
  if (typeof selector === "function") {
    allPoints.classed(this.hiddenClass, true);
    allPoints.filter(selector).classed(this.hiddenClass, false);

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
    allPoints.classed(this.hiddenClass, false);
    allPoints.sort(function(a,b) { return d3.ascending(a.orig_index, b.orig_index); });
  }
}

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