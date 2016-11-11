import {default as webgl_utils} from './webgl_utils';
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

  var bounds = [[], []]; // [minPt, maxPt]
  var maxTexture;
  var grpTexNum;
  var maxDim;
  var delta;

  var util;

  function initComponents() {
    // initialize global textures
	  util.createTexture("maxTexture0", width, height);
	  util.createTexture("maxTexture1", width, height);
    util.createTexture("dist0", width, height);
    util.createTexture("dist1", width, height);
    util.createTexture("outliers", width, height);
    util.createTexture("outlierPts", width, height);

    //util.createTexture("test1", width, height, {type: gl.UNSIGNED_BYTE});

    // compile relevant shaders
    util.getShader("blur", shaders.spVBlurShader, shaders.spFBlurShader(128));
    util.getShader("blurTest", shaders.spVBlurShader, shaders.spFBlurTest);
    util.getShader("max", shaders.spVBlurShader, shaders.spFMaxValue);
	  util.getShader("maxTexture", shaders.spVBlurShader, shaders.spFMaxTexture);
    util.getShader("jfainit", shaders.spVBlurShader, shaders.spFJFAInit);
    util.getShader("jfa", shaders.spVBlurShader, shaders.spFJFA);
    util.getShader("jfatest", shaders.spVBlurShader, shaders.spFJFATest);
    util.getShader("shade", shaders.spVBlurShader, shaders.spFShade);
    util.getShader("outliers", shaders.spVOutlier, shaders.spFPointShader);
    util.getShader("outlierCombine", shaders.spVBlurShader, shaders.spFOutlierCombine);
	  util.getShader("blend", shaders.spVBlurShader, shaders.spFBlend);
  }

  function testPoints() {
    //// TEST DRAWING POINTS TO TEXTURE AND RENDERING THAT TEXTURE TO SCREEN
    util.createTexture("butts", width, height, {type: gl.UNSIGNED_BYTE, filter: gl.LINEAR});
    util.drawPoints({uniforms: {pointSize: ptSize}, drawToTexture: "butts"});;
    util.drawQuad({textures: [['butts', 'texture']]});

    //// TEST DRAWING TEXTURE TO SCREEN
    // var testImage = new Image();
    testImage.onload = function() {
      util.createTexture("texture", 600, 600, {
        filter: gl.LINEAR,
        type: gl.UNSIGNED_BYTE
      });

      util.bindTexture('texture', 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, testImage);
      util.unbindTexture('texture', 0);

      util.createTexture("test1", 600, 600, {type: gl.UNSIGNED_BYTE, filter: gl.LINEAR});
      util.drawQuad({textures: ['texture'], drawToTexture: "test1"});
      util.textures.texture = util.textures.test1;
      util.drawQuad({textures: ['texture']});
    }
    testImage.src = "600x600test.png";
  }

  function hexColorToNormRGB(hexColor) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : null;
  }

  function drawBlur(pts, grpNum) {
	  util.setPoints(pts);

    // 1. draw point density 
    util.drawPoints({drawDensity: true, drawToTexture: "blur0-" + grpNum});

    // 2. blur points horizontally
    delta = [1.0 / width, 1.0 / height];
    util.drawQuad({
      shader: "blur",
      textures: [["blur0-" + grpNum, "texture"]],
      drawToTexture: "blur1-" + grpNum,
      uniforms: {
        sigma: 15.0,
        offset: [1.0, 0.0],
        delta: delta
      }
    });

    // 3. blur points vertically
    util.drawQuad({
      shader: "blur",
      textures: [["blur1-" + grpNum, "texture"]],
      drawToTexture: "blur0-" + grpNum,
      uniforms: {
        sigma: 15.0,
        offset: [0.0, 1.0],
        delta: delta
      }
    });

    // also draw to max texture to compute maximum density value
    util.drawQuad({
      shader: "blur",
      textures: [["blur1-" + grpNum, "texture"]],
      drawToTexture: "max0-" + grpNum,
      uniforms: {
        sigma: 15.0,
        offset: [0.0, 1.0],
        delta: delta
      }
    });

    // 4. obtain the maxVal
    var scalePerStep = 8;
    maxDim = Math.max(width, height);
    var numSteps = Math.floor(Math.log(maxDim) / Math.log(scalePerStep));
    var pixelsAtEnd = Math.ceil(maxDim / Math.pow(scalePerStep, numSteps));

    for (var i = 0; i < numSteps; i++) {
      util.drawQuad({
        shader: "max",
        textures: [['max' + (i % 2) +"-"+ grpNum, 'texture']],
        drawToTexture: 'max' + ((i + 1) % 2) +"-"+ grpNum,
        uniforms: {
          delta: delta
        }
      });
    }     

    // TODO: reconcile if pixelsAtEnd != 1 
    // (e.g. if max is at extremum of x/y, it might be incorrect to pull from just 0,0 to get the maxVal)
    //var maxTex = 'max' + (numSteps % 2);
	  grpTexNum = 'max' + (numSteps % 2);

    // 5. test blur output
    // util.drawQuad({
    //   shader: "blurTest",
    //   textures: [
    //     ['blur0', "texture"], 
    //     [maxTex, "maxTex"]
    //   ]
    //   // drawToTexture: "test1"
    // });
  }

  function drawGroup(pts, color, grpNum) {
    util.setPoints(pts);
    color = hexColorToNormRGB(color);

    // 6. initialize JFA
    util.drawQuad({
      shader: "jfainit",
      textures: [
        ['blur0-'+grpNum, 'texture'],
        [maxTexture, 'maxTex']
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
	  drawToTexture: "grp-"+grpNum,
      textures: [
        ['blur0-'+grpNum, 'texture'],
        [distTex, 'distances'],
        [maxTexture, 'maxTex'],
        ['outlierPts', 'outliers']
      ],
      uniforms: {
        rgbColor: color, //[0.122, 0.467, 0.706],
        lowerLimit: 0.001,
        upperLimit: 0.5
      },
      clear: [1.0, 1.0, 1.0, 1.0]
    });

    // var a = util.getTextureData("test1");
  };

  function splatterplot(selection, isDirty) {
    if (!gl) {
      var webglCanvas = selection.select('canvas');
      gl = webglCanvas.node().getContext('webgl');
      if (!gl) {
        console.error("Your browser does not seem to support WebGL, should revert to canvas/SVG.");
        return -1;
      }

      width = +webglCanvas.attr('width');
      height = +webglCanvas.attr('height');

      util = new webgl_utils(gl, width, height);
      util.initCanvas();
      initComponents();
    }

	  // split the data up into groups, asssign a color to each one
    if (isDirty) {
      util.clearAllTextures();

      // arrange the dataset by xValue, yValue
      var ptData = [];
      var ptColor = [];
      var ptGrps = [];
      data.forEach(function(d) {
        var pt = [];
        pt.push(xValue(d));
        pt.push(yValue(d));
        pt.push(Math.random());
        ptData.push(pt);

        // check and update bounds
        // xDomain = [Math.min(xDomain[0], xValue(d)), Math.max(xDomain[1], xValue(d))];
        // yDomain = [Math.min(yDomain[0], yValue(d)), Math.max(yDomain[1], yValue(d))];

        // just push the index of the colorScale output
        ptColor.push(colorScale.range().indexOf(colorScale(grpVal(d))));
      });

      // var bounds = [[xDomain[0], yDomain[0]], [xDomain[1], yDomain[1]]];
      util.setBounds(scale.x.domain(), scale.y.domain());

      // for each group, draw the blur so we can get the maximum density value
      // from all groups (which allows density scale to be shared across groups)
      var texNames = [];
      for (var i = 0; i < colorScale.range().length; i++) {
        var thesePts = ptData.filter(function(pt, index) {
          return ptColor[index] == i;
        });

        ptGrps.push(thesePts);
        if (thesePts.length === 0) {
          console.warn("Group %s has no points; skipping", colorScale.range()[i]);
          continue;
        }

        // create per-group textures (if they don't exist)
        // blur0/1-#, max0/1-#, grp#
        util.createTexture("blur0-"+i, width, height);
        util.createTexture("blur1-"+i, width, height);
        util.createTexture("max0-"+i, width, height);
        util.createTexture("max1-"+i, width, height);

        var texName = "grp-" + i;
        util.createTexture("grp-" + i, width, height);
        texNames.push(i);
        drawBlur(thesePts, i);
      }

      // compute the maximum of all max textures
      for (var i = 0; i < texNames.length; i++) {
        util.drawQuad({
          shader: "maxTexture",
          drawToTexture: "maxTexture" + ((i+1) % 2),
          textures: [
            ["maxTexture" + (i % 2), "max1"],
            [grpTexNum + "-" + texNames[i], "max2"]
          ]
        });
      }

      // determine the maximum texture's name
      maxTexture = "maxTexture" + (colorScale.range().length % 2);

      // then, shade each group
      for (var i = 0; i < texNames.length; i++) {
      var dIndex = texNames[i];
      drawGroup(ptGrps[dIndex], colorScale.range()[dIndex], dIndex);
      }

      // do blending here; bind textures based on colorScale.range().length
      var numGrps = Math.min(8, texNames.length);
      var texMap = [];
      for (var i = 0; i < numGrps; i++) {
        texMap.push(["grp-"+texNames[i], "texture"+i]);
      }

      // finally, blend all groups together to create the splatterplot
      util.drawQuad({
        shader: "blend",
        textures: texMap,
        uniforms: {
          N: numGrps,
          lf: 0.9,
          cf: 0.95
        }, 
        clear: [1.0, 1.0, 1.0, 1.0]
      });
    }
  }

  splatterplot.setData = function(dataN, xValueN, yValueN, grpValueN, foundGroupsN, scaleN) {
    data = dataN;
    xValue = xValueN;
    yValue = yValueN;
    grpVal = grpValueN;
    foundGroups = foundGroupsN;
    scale = scaleN;

    return splatterplot;
  }

  splatterplot.setColorScale = function(newScale) {
    colorScale = newScale;
    return splatterplot;
  }

  splatterplot.circleSize = function(newSize) {
    ptSize = newSize;
    return splatterplot;
  }

  return splatterplot;
}
