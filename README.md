# d3-twodim

Helps create two-dimensional representations of data using scatter plots (using SVG, Canvas, or WebGL), and (in the future) techniques such as Splatterplots and subsampled scatterplots.  This reusable component uses a factory design pattern to keep d3-twoDim components linked to interchange data and object state.

This project is under active development.  Please feel free to file an issue, open a pull request, or [contact the author](http://twitter.com/yelperalp/) with any feedback.  If you use d3-twoDim in your own project, [we would love to hear about it](http://twitter.com/yelperalp)!

![An example instantiation of d3-twodim](examples/simpleExample.png)

## Installing

Download the [latest release](https://github.com/uwgraphics/d3-twodim/releases/latest), and include d3-twodim as a script source after including d3.v3.js.  Otherwise, you can modify and rebuild the library by calling `npm install` from the project root.  

*After the library goes public*: If you use NPM, `npm install d3-twodim`. Otherwise, download the [latest release](https://github.com/uwgraphics/d3-twodim/releases/latest).

## Example Instantiation

You can view an example instantiation within the repository by navigating to [simpleExample.html](examples/simpleExample.html) after building the library.

d3-twodim uses the factory design pattern to keep track of all linked components.  In your code, first create the factory by calling `new d3_twodim.twoDimFactory()`, then create objects using the factory's `createComponent()` method.  To make your first scatterplot, you can simply do the following:

```javascript
var twoDFactory = new d3_twodim.twoDimFactory();
var scatterplot = twoDFactory.createComponent({type: 'scatterplot'})
  .width(400).height(400);

// set the data
twoDFactory.setData([[1,1],[2,2],[3,3]);
d3.select('body').append('svg')
  .attr('width', 500).attr('height', 500)
  .append('g')
    .attr('class', 'scatterplot')
    .attr('transform', 'translate(50,50)')
    .call(scatterplot, '.scatterplot');
```

The real power comes from linking components together -- for example, you could have one scatterplot looking at the first two dimensions of your data, and the next scatterplot looking at two other dimensions.  When you brush over one scatterplot, the corresponding points in the other scatterplot also update.

```javascript
var scatterplot = twoDFactory.createComponent({type: 'scatterplot'})
  .width(400).height(400)
  .doBrush(true)
  .fields(["dim1", "dim2"];
  
var scatterplot2 = twoDFactory.createComponent({type: 'scatterplot'})
  .width(400).height(400)
  .doBrush(true)
  .fields(["dim3", "dim4"]);
  
svg.append('g')
  .attr('class', 'scatterplot')
  .attr('transform', 'translate(50,50)')
  .call(scatterplot, '.scatterplot');

svg.append('g')
  .attr('class', 'scatterplot2')
  .attr('transform', 'translate(500, 50)')
  .call(scatterplot2, '.scatterplot2');
```

There are several other options you can add to enhance the functionality and interaction between your d3-twodim components.  The scatterplot component in particular exposes `mouse{over,down,out}` events to enable custom interaction, such as showing tooltips.

```javascript
var scatterplot = twoDFactory.createComponent({type: 'scatterplot'})
  .width(400).height(400)
  .on('mouseover', function(d, ptPos) {
    tooltip.transition()
      .duration(200)
      .style('opacity', 0.9);
    tooltip.html(d.author + ": " + d.title)
      .style('left', ptPos.left + "px")
      .style('top', ptPos.top + "px");
  })
  .on('mouseout', function(d) {
    tooltip.transition()
      .style('opacity', 0);
  });
```

There are also legend, objectlist, and dropdown components to interact with the scatterplot.  Example instantiation of these components can be seen in the [simple example](examples/simpleExample.html).

## API Reference

... TBD, but lots of it are in jsdoc comments already.

## To-do list

- [ ] Add ability to lasso points
- [ ] Add ability to programmatically select points
- [ ] Add ability to view categorical data (see #4)
- [ ] Support missing data (can make internal functions error; see #9)
- [ ] Allow user to see statistics about selected points (in relation to background)
- [ ] Allow interaction with drop-downs to select relevant dimensions for the user, or search for particular text of a point
- [ ] Add pairwise correlation matrix component (shows level of correlation between two features)
- [ ] Add Splatterplot component (add-on to WebGL rendering type)
- [ ] Add subsampled graph option (add-on to SVG/Canvas rendering type?)
- [ ] Add binning component (add-on to SVG/Canvas rendering type)
- [ ] Add labeling options (for outliers?)
