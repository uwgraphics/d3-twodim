function scatterplot_component(configObject) {
  for (var key in configObject) {
    this[key] = configObject[key];
  }
}

scatterplot_component.prototype.draw = function() {
  console.warn("drawing code should go here; if you see this message, a component has not implemented the required draw() method.");
}

scatterplot_component.prototype.update = function() {
  console.warn("given that nothing other than the scales/bounds changed, update the data. If you see this message, a component has not implemented the required draw() method.");
}

scatterplot_component.prototype.visualEncSelector = function() {
  console.warn("this returns the css selector for the visual object that has been created.  If you see this message, a component has not implemented the requred visualEncSelector() method.");
}

scatterplot_component.prototype.setcolorScale = function(newScale) {
  this.colorScale = newScale;
  return this;
}

scatterplot_component.prototype.circleSize = function(newSize) {
  this.ptSize = newSize;
  return this;
}

scatterplot_component.prototype.setDuration = function(newDuration) {
  this.duration = newDuration;
  return this;
}

export default scatterplot_component;