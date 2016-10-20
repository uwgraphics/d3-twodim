import {default as webgl_util} from './webgl_util';
import {default as shaders} from './splatterplot_shaders';

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

  function initComponents() {
    // initialize textures
    util.createTexture("blur0", width, height);
    util.createTexture("blur1", width, height);
    util.createTexture("max0", width, height);
    util.createTexture("max1", width, height);
    util.createTexture("dist0", width, height);
    util.createTexture("dist1", width, height);
    util.createTexture("outliers", width, height);
    util.createTexture("outlierPts", width, height);

    util.createTexture("test1", width, height, {type: gl.UNSIGNED_BYTE});

    // compile relevant shaders
    util.getShader("blur", shaders.spVBlurShader, shaders.spFBlurShader(128));
    util.getShader("blurTest", shaders.spVBlurShader, shaders.spFBlurTest);
    util.getShader("max", shaders.spVBlurShader, shaders.spFMaxValue);
    util.getShader("jfainit", shaders.spVBlurShader, shaders.spFJFAInit);
    util.getShader("jfa", shaders.spVBlurShader, shaders.spFJFA);
    util.getShader("jfatest", shaders.spVBlurShader, shaders.spFJFATest);
    util.getShader("shade", shaders.spVBlurShader, shaders.spFShade);
    util.getShader("outliers", shaders.spVOutlier, shaders.spFPointShader);
    util.getShader("outlierCombine", shaders.spVBlurShader, shaders.spFOutlierCombine);
  }

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
      initComponents();
    }

    if (isDirty) {
      // arrange the dataset by xValue, yValue
      var ptData = [];
      var ptColor = [];
      data.forEach(function(d) {
        var pt = [];
        pt.push(xValue(d));
        pt.push(yValue(d));
        pt.push(Math.random());
        ptData.push(pt);

        // just push the index of the colorScale output
        ptColor.push(colorScale.range().indexOf(colorScale(grpVal(d))));
      });

      util.setPoints(ptData);
      util.setPointColors(ptColor);
      
      if (colorScale !== undefined)
        util.setColorRamp(colorScale.range());
    }

    //// TEST DRAWING POINTS TO TEXTURE AND RENDERING THAT TEXTURE TO SCREEN
    // util.createTexture("butts", width, height, {type: gl.UNSIGNED_BYTE, filter: gl.LINEAR});
    // util.drawPoints({uniforms: {pointSize: ptSize}, drawToTexture: "butts"});;
    // util.drawQuad({textures: [['butts', 'texture']]});

    //// TEST DRAWING TEXTURE TO SCREEN
    // var testImage = new Image();
    // testImage.onload = function() {
    //   util.createTexture("texture", 600, 600, {
    //     filter: gl.LINEAR,
    //     type: gl.UNSIGNED_BYTE
    //   });

    //   util.bindTexture('texture', 0);
    //   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    //   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, testImage);
    //   util.unbindTexture('texture', 0);

    //   util.createTexture("test1", 600, 600, {type: gl.UNSIGNED_BYTE, filter: gl.LINEAR});
    //   util.drawQuad({textures: ['texture'], drawToTexture: "test1"});
    //   util.textures.texture = util.textures.test1;
    //   util.drawQuad({textures: ['texture']});
    // }
    // testImage.src = "600x600test.png";

    // 1. draw point density 
    util.drawPoints({drawDensity: true, drawToTexture: "blur0"});

    // 2. blur points horizontally
    var delta = [1.0 / width, 1.0 / height];
    util.drawQuad({
      shader: "blur",
      textures: [["blur0", "texture"]],
      drawToTexture: "blur1",
      uniforms: {
        sigma: 15.0,
        offset: [1.0, 0.0],
        delta: delta
      }
    });

    // 3. blur points vertically
    util.drawQuad({
      shader: "blur",
      textures: [["blur1", "texture"]],
      drawToTexture: "blur0",
      uniforms: {
        sigma: 15.0,
        offset: [0.0, 1.0],
        delta: delta
      }
    });

    // also draw to max texture to compute maximum density value
    util.drawQuad({
      shader: "blur",
      textures: [["blur1", "texture"]],
      drawToTexture: "max0",
      uniforms: {
        sigma: 15.0,
        offset: [0.0, 1.0],
        delta: delta
      }
    });

    // 4. obtain the maxVal
    var scalePerStep = 8;
    var maxDim = Math.max(width, height);
    var numSteps = Math.floor(Math.log(maxDim) / Math.log(scalePerStep));
    var pixelsAtEnd = Math.ceil(maxDim / Math.pow(scalePerStep, numSteps));

    for (var i = 0; i < numSteps; i++) {
      util.drawQuad({
        shader: "max",
        textures: [['max' + (i % 2), 'texture']],
        drawToTexture: 'max' + ((i + 1) % 2),
        uniforms: {
          delta: delta
        }
      });
    }     

    // TODO: reconcile if pixelsAtEnd != 1 
    // (e.g. if max is at extremum of x/y, it might be incorrect to pull from just 0,0 to get the maxVal)
    var maxTex = 'max' + (numSteps % 2);

    // 5. test blur output
    // util.drawQuad({
    //   shader: "blurTest",
    //   textures: [
    //     ['blur0', "texture"], 
    //     [maxTex, "maxTex"]
    //   ]
    //   // drawToTexture: "test1"
    // });

    // 6. initialize JFA
    util.drawQuad({
      shader: "jfainit",
      textures: [
        ['blur0', 'texture'],
        [maxTex, 'maxTex']
      ],
      drawToTexture: "dist0",
      uniforms: { upperLimit: 0.5 },
      clear: [0.0, 0.0, 0.0, 0.0]
    });

    // iterate on JFA until distance field is flooded
    var log2 = Math.log(maxDim) / Math.log(2);
    var n = Math.ceil(log2);
    var k = Math.pow(2, n - 1);
    n = (n - 1) / 2 + 1;

    for (var i = 0; i < 2 * n; i++) {
      util.drawQuad({
        shader: "jfa",
        textures: [['dist' + (i % 2), 'texture']],
        drawToTexture: "dist" + ((i + 1) % 2),
        uniforms: {
          kStep: k,
          delta: delta
        },
        clear: [0.0, 0.0, 0.0, 0.0]
      });

      console.log("drawing to texture dist" + ((i + 1) % 2));

      k = Math.max(1, Math.round(k / 2));
    }

    var distTex = "dist" + ((n * 2) % 2);

    // 7. test the distance field
    // util.drawQuad({
    //   shader: "jfatest",
    //   textures: [['dist0', 'texture']],
    //   uniforms: {maxDist: 700}
    // });
    // return;

    // 9. compute the outliers
    var clutterRadius = 25;
    var scaleDomains = util.getBounds();
    var resolution = [width, height];

    // size of outlier grid in pixels
    var gridSizePx = [width / clutterRadius, height / clutterRadius];

    // the offest of the grid (align to 0,0 in point coordinate system)  
    var gridOffset = [0,0];

    for (var i = 0; i < 2; i++) {
      // size of outlier grid in local point coordinate system
      var gridSizeLoc = (scaleDomains[i][1] - scaleDomains[i][0]) / gridSizePx[i]; 
      gridOffset[i] = (scaleDomains[i][0] / gridSizeLoc) - Math.floor(scaleDomains[i][0] / gridSizeLoc);
      gridOffset[i] = gridOffset[i] * clutterRadius / resolution[i];
    }

    util.drawPoints({
      shader: "outliers", 
      drawToTexture: "outliers",
      textures: [[distTex, "jfa"]],
      uniforms: {
        gridSize: clutterRadius,
        resolution: resolution,
        offset: gridOffset
      },
      clear: [0.0, 0.0, 0.0, 0.0]
    });

    util.drawQuad({
      shader: "outlierCombine",
      drawToTexture: "outlierPts",
      textures: [["outliers", "grid"]],
      uniforms: {
        gridSize: clutterRadius,
        pointRadius: ptSize,
        resolution: resolution,
        offset: gridOffset
      },
      clear: [0.0, 0.0, 0.0, 0.0]
    });

    // 10. shade each group
    util.drawQuad({
      shader: "shade",
      textures: [
        ['blur0', 'texture'],
        [distTex, 'distances'],
        [maxTex, 'maxTex'],
        ['outlierPts', 'outliers']
      ],
      uniforms: {
        rgbColor: [0.122, 0.467, 0.706],
        lowerLimit: 0.001,
        upperLimit: 0.5
      },
      clear: [1.0, 1.0, 1.0, 1.0]
    });

    var a = util.getTextureData("test1");
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
