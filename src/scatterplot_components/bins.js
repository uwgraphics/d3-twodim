import scatterplot_component from './scatterplot_component';
import * as d3_hexbin from "d3-hexbin";

function bins(configObject) {
  scatterplot_component.call(this, configObject);
}
bins.prototype = Object.create(scatterplot_component.prototype);

bins.prototype.draw = function(container, skipTransition) {
  var that = this;
  var hexbin = this.hexbin || 
    d3_hexbin.hexbin()
      .x(function(d) { return that.scale.x(that.xValue(d)); })
      .y(function(d) { return that.scale.y(that.yValue(d)); })
      .extent([
        [d3.min(this.scale.x.range()), d3.min(this.scale.y.range())],
        [d3.max(this.scale.x.range()), d3.max(this.scale.y.range())]
      ])
      .radius(15);
  
  var hexbins = hexbin(this.data);
  
  var attenuation = this.attenuation || d3.scale.log().range([0,1]);
  attenuation.domain([.1, d3.max(hexbins.map(function(d) { return d.length; }))]);

  var hex = container.selectAll('path.hex')
    .data(hexbins);

  hex.exit().remove();
  hex.enter().append('path')
    .attr('class', 'hex')
    .attr('d', hexbin.hexagon(15))
    .attr('transform', function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  hex.style('fill', function(d) {
    var counts = Array(that.foundGroups.length).fill(0);
    d.forEach(function(p) {
      counts[that.foundGroups.indexOf(that.grpValue(p))]++;
    });

    return counts.reduce(function(p,c,i) {
      return d3.interpolateLab(p, that.colorScale.domain[i])(c / d.length);
    }, "white");
  })
  .style('fill-opacity', function(d) { return attenuation(d.length); });

  this.hexbin = hexbin;
  this.attenuation = attenuation;
}

bins.prototype.update = function(container, skipTransition) {
  container.selectAll('path.hex')
}

bins.prototype.visualEncSelector = function() {
  return "path.hex";
}

export default bins;