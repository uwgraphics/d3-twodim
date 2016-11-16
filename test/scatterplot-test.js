var tape = require("tape");
global.d3 = require("d3");  // TODO: hack to inject d3 into the global namespace, because I'm apparently doing something wrong
var scatterplot = require("../");

tape("Scatterplot has the expected defaults", function(test) {
  var s = scatterplot.scatterplot();
  test.equal(s.width(), 1);
  test.equal(s.circleSize(), 3);
  test.equal(s.doBrush(), false);
  test.equal(s.doZoom(), false);
  test.equal(s.squashMouseEvents(), false);
  test.equal(s.doVoronoi(), false);
  test.equal(s.changeDuration(), 500);
  test.equal(s.hiddenClass(), "point-hidden");
  test.deepEqual(s.labels(), ["", ""]);
  test.equal(s.renderType(), 'svg');
  test.end();
});

tape("Scatterplot sets labels correctly", function(test) {
  var s = scatterplot.scatterplot();
  test.equal(s.xLabel(), "");
  test.equal(s.yLabel(), "");
  
  s.labels(["test_x", "test_y"]);
  test.equal(s.xLabel(), "test_x");
  test.equal(s.yLabel(), "test_y");
  
  s.xLabel("test_x2");
  test.equal(s.xLabel(), "test_x2");
  test.equal(s.yLabel(), "test_y");
  
  s.yLabel("test_y2");
  test.equal(s.xLabel(), "test_x2");
  test.equal(s.yLabel(), "test_y2");
  
  test.deepEqual(s.labels(), ["test_x2", "test_y2"]);
  
  test.end();
});

tape("Scatterplot interoperates fields and labels correctly", function(test) {
  var s = scatterplot.scatterplot();
  s.fields(['xdim', 'ydim']);
  test.equal(s.xField(), 'xdim');
  test.equal(s.xLabel(), 'xdim');
  test.equal(s.yField(), 'ydim');
  test.equal(s.yLabel(), 'ydim');
  
  s.xField('xdim2');
  test.deepEqual(s.fields(), ['xdim2', 'ydim']);
  test.deepEqual(s.labels(), ['xdim2', 'ydim']);
  
  s.yField('ydim2');
  test.deepEqual(s.fields(), ['xdim2', 'ydim2']);
  test.deepEqual(s.labels(), ['xdim2', 'ydim2']);
  
  test.end();
});