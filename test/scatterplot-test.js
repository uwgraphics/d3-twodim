var tape = require("tape"),
    scatterplot = require("../");

tape("Scatterplot has the expected defaults", function(test) {
  var s = scatterplot.scatterplot();
  test.equal(s.width(), 1);
  test.equal(s.circleSize(), 3);
  test.equal(s.doBrush(), false);
  test.equal(s.changeDuration(), 500);
  test.end();
});
