var tape = require("tape");
var scatterplot = require("../");

tape("Scatterplot has the expected defaults", function(test) {
  var s = scatterplot.scatterplot();
  test.equal(s.width(), 1);
  test.equal(s.circleSize(), 3);
  test.equal(s.doBrush(), false);
  test.equal(s.changeDuration(), 500);
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