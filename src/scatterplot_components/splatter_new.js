import {default as webgl_util} from './webgl_util';

export default function() {
  var gl;
  var width;
  var height;

  var data;
  var scale;

  var xValue;
  var yValue;
  var grpVal;

  var foundGroups;
  var colorScale;

  var ptSize = 7;

  var util;

  function splatter_new(selection, isDirty) {
    if (!gl) {
      var webglCanvas = selection.select('canvas');
      gl = webglCanvas.node().getContext('webgl');
      if (!gl) {
        console.error("Your browser does not seem to support WebGL, should revert to canvas/SVG.");
        return -1;
      }

      width = +webglCanvas.attr('width');
      height = +webglCanvas.attr('height');

      util = new webgl_util(gl, width, height);
      util.initCanvas();
    }

    if (isDirty) {
      // arrange the dataset by xValue, yValue
      var ptData = [];
      var ptColor = [];
      data.forEach(function(d) {
        var pt = [];
        pt.push(xValue(d));
        pt.push(yValue(d));
        ptData.push(pt);

        // just push the index of the colorScale output
        ptColor.push(colorScale.range().indexOf(colorScale(grpVal(d))));
      });

      util.setPoints(ptData);
      util.setPointColors(ptColor);
      
      if (colorScale !== undefined)
        util.setColorRamp(colorScale.range());
    }

    util.drawPoints({pointSize: ptSize});
  };

  splatter_new.setData = function(dataN, xValueN, yValueN, grpValueN, foundGroupsN, scaleN) {
    data = dataN;
    xValue = xValueN;
    yValue = yValueN;
    grpVal = grpValueN;
    foundGroups = foundGroupsN;
    scale = scaleN;

    return splatter_new;
  }

  splatter_new.setColorScale = function(newScale) {
    colorScale = newScale;
    return splatter_new;
  }

  splatter_new.circleSize = function(newSize) {
    ptSize = newSize;
    return splatter_new;
  }

  return splatter_new;
}
