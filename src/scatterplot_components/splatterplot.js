import scatterplot_webgl from '../scatterplot_webgl';
import {default as shaders} from './splatterplot_shaders';
import {compileShaders, draw, drawTo, drawFromTextureQuad, createTexture} from './webgl_utils';

export default function() {
	var gl;
	var progs = {};
  var textures = {};
  var fbo;

	var width;
	var height;

	var data;
	var scale;
	var xValue;
	var yValue;
	var grpVal;
	var foundGroups;

	var points;
	var pointsBuf;
	var colorScale;
	var flattenedColors;
	var colorRampTexture;
	var colorRampWidth;

	var ptSize = 7;
	var curTransform;

	function getShader(name, vert, frag) {
		if (!progs.hasOwnProperty(name)) {
      vert = vert || shaders.basicVertexShader;
      frag = frag || shaders.basicFragShader;
			var prog = compileShaders(gl, name, vert, frag);
			
			progs[name] = prog;
		}

		return progs[name];
	}

	function initCanvas() {
    gl.disable(gl.DEPTH_TEST);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.enable(gl.BLEND);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.viewport(0, 0, width, height);

    pointsBuf = gl.createBuffer();
    
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // reset the clear color
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // create necessary textures
    textures['blur0'] = createTexture(gl, width, height, {type: gl.FLOAT});
    textures['blur1'] = createTexture(gl, width, height, {type: gl.FLOAT});
    textures['max0'] = createTexture(gl, width, height, {type: gl.FLOAT});
    textures['max1'] = createTexture(gl, width, height, {type: gl.FLOAT});
    textures['dist0'] = createTexture(gl, width, height, {type: gl.FLOAT});
    textures['dist1'] = createTexture(gl, width, height, {type: gl.FLOAT});
  }

  function setBounds() {
    if (!scale)
      throw "Need to call webgl component with data before drawing";
    
    var scale_x = 2 / (scale.x.domain()[1] - scale.x.domain()[0]);
    var scale_y = 2 / (scale.y.domain()[1] - scale.y.domain()[0]);
    var trans_x = -1 - scale.x.domain()[0];
    var trans_y = -1 - scale.y.domain()[0];

		// webgl_utils.draw() will appropriately transpose this matrix
    curTransform = [
      scale_x, 0,       0, trans_x,
      0,       scale_y, 0, trans_y, 
      0,       0,       1, 0,
      0,       0,       0, 1
    ];
  };

  function genDataBuffer() {
    points = [];
    var colorRange = colorScale.range();
    data.forEach(function(d) {
      points.push(xValue(d));
      points.push(yValue(d));
      points.push(colorRange.indexOf(colorScale(grpVal(d)))); // get the color index for texture lookup
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, pointsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

		if (!colorRampTexture) {
      colorRampTexture = createTexture(gl, colorRampWidth, colorRampWidth, {
        type: gl.UNSIGNED_BYTE
      });
		}

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, colorRampWidth, colorRampWidth,
      0, gl.RGBA, gl.UNSIGNED_BYTE, flattenedColors);

    setBounds();
  }

	function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, colorRampTexture);
    
    // gl.bindBuffer(gl.ARRAY_BUFFER, pointsBuf);
    // gl.vertexAttribPointer(progs['test'].attribLocations.points, 2, gl.FLOAT, false, 12, 0);
    // gl.vertexAttribPointer(progs['test'].attribLocations.colorIndex, 1, gl.FLOAT, false, 12, 8);
    gl.drawArrays(gl.POINTS, 0, data.length);
  }

	// assume that an SVG/canvas combination has already been set up with correct width/height
  function splatterplot(selection, isDirty) {
    if (!gl) {
      var webglCanvas = selection.select('canvas');
      gl = webglCanvas.node().getContext('webgl');
      if (!gl) {
        console.error("Your browser does not seem to support WebGL, should revert to canvas/SVG.");
        return -1;
      }

      var f = gl.getExtension("OES_texture_float");
      if (!f) {
        console.error("OES_texture_float support is required.  Fatal errors in rendering may follow");
      }

      width = +webglCanvas.attr('width');
      height = +webglCanvas.attr('height');

      initCanvas();
    }

    // var prog = getShader('test');
    getShader("blur", shaders.spVBlurShader, shaders.spFBlurShader(128))
    // getShader("blur", shaders.spVBlurShader, shaders.spFTestTexture);
    getShader("point", shaders.spVPointShader, shaders.spFPointShader);
    getShader("max", shaders.spVBlurShader, shaders.spFMaxValue);
    getShader("jfainit", shaders.spVBlurShader, shaders.spFJFAInit);
    getShader("jfa", shaders.spVBlurShader, shaders.spFJFA);
    getShader("jfatest", shaders.spVBlurShader, shaders.spFJFATest);

    if (isDirty) {
      genDataBuffer();
    }

    // draw(gl, prog, {
		// 	pointSize: ptSize,
		// 	mvp: curTransform,
		// 	colorRamp: 0,
		// 	colorRampWidth: colorRampWidth
		// }, {
    //   position: {numElements: 2, type: gl.FLOAT, offset: 0},
    //   colorIndex: {numElements: 1, type: gl.FLOAT, offset: 8}
    // }, pointsBuf, render);

    // set the clearColor for density binning
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // 1. draw points to density texture
    drawTo(gl, textures['blur0'], width, height,
      function() { 
        draw(gl, getShader("point"),
          {
            pointSize: 1,
            mvp: curTransform
          }, {
            position: {numElements: 3, type: gl.FLOAT}
          }, pointsBuf, function() {
            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE);
            
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            gl.drawArrays(gl.POINTS, 0, data.length);
          }
        )
      }
    );

    // generate a goofy texture here
    // var testTexture = createTexture(gl, 600, 600, {
    //   filter: gl.LINEAR,
    //   type: gl.UNSIGNED_BYTE
    // });
    // var testImage = new Image();
    // testImage.onload = function() {
    //   gl.activeTexture(gl.TEXTURE0);
    //   gl.bindTexture(gl.TEXTURE_2D, testTexture);
    //   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, testImage);
      
    //   drawFromTextureQuad(gl, getShader("blur"),
    //     {
    //       texture: 0
    //     }, function() {
    //       gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //     });
    // };
    // testImage.src = "600x600test.png";


    // 2. blur points in the x direction
    var delta = [1.0 / width, 1.0 / height]
    drawTo(gl, textures['blur1'], width, height, 
      function() {
        drawFromTextureQuad(gl, getShader("blur"),
          {
            texture: 0,
            sigma: 15.0,
            offset: [1.0, 0.0],
            delta: delta
          }, function() {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures['blur0']);
          }
        );
      }
    )

    // 3. blur points in the y direction
    drawTo(gl, textures['blur0'], width, height, 
      function() {
        drawFromTextureQuad(gl, getShader("blur"),
          {
            texture: 0,
            sigma: 15.0,
            offset: [1.0, 0.0],
            delta: delta
          }, function() {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures['blur1']);
          }
        );
      }
    )

    gl.bindTexture(gl.TEXTURE_2D, null);

    // 4. iterate until we capture the max value in a texture
    var scalePerStep = 8;
    var maxDim = Math.max(width, height);
    var numSteps = Math.floor(Math.log(maxDim) / Math.log(scalePerStep));
    var pixAtEnd = Math.ceil(maxDim / Math.pow(scalePerStep, numSteps));

    gl.disable(gl.DEPTH_TEST);

    for (var i = 0; i < numSteps; i++) {
      drawTo(gl, textures['max' + ((i + 1) % 2)], width, height,
        function() {
          drawFromTextureQuad(gl, getShader('max'), {
            texture: 0, 
            delta: delta
          }, function() {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures['max' + (i % 2)]);
          });
        }
      );

      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // the final value is in numSteps % 2
    var maxTex = textures['max' + (i % 2)];

    // 5. do JFA to get a distance field
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // initialize JFA texture (set the thresholded regions)
    drawTo(gl, textures['dist0'], width, height, 
      function() {
        drawFromTextureQuad(gl, getShader('jfainit'), {
          texture: 0,
          maxTex: 1,
          upperLimit: 0.5
        }, function() {
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, textures['blur0']);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, maxTex);
        })
      }
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // iterate until distance field floods
    var log2 = Math.log(maxDim) / Math.log(2);
    var n = Math.ceil(log2);
    var k = Math.pow(2, n - 1);
    n = (n - 1) / (2 + 1);

    for (var i = 0; i < 2 * n; i++) {
      drawTo(gl, textures['dist' + ((i+1) % 2)], width, height,
        function() {
          drawFromTextureQuad(gl, getShader('jfa'), {
            kStep: k,
            delta: delta,
            texture: 0
          }, function() {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures['dist' + (i % 2)]);
          })
        }
      );

      k = Math.max(1, Math.round(k / 2));
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // 6. Debug the JFA (?!?!?!?!)
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    drawFromTextureQuad(gl, getShader('jfatest'), {
      texture: 0,
      maxDist: 700
    }, function() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures['dist0']);
    });
    

  };	

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
    var colors = newScale.range();

    colorRampWidth = Math.ceil(Math.sqrt(colors.length));
    flattenedColors = new Uint8Array(colorRampWidth * colorRampWidth  * 4);
    colors.forEach(function(d, i) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(d);
      flattenedColors[i * 4]     = parseInt(result[1], 16);
      flattenedColors[i * 4 + 1] = parseInt(result[2], 16);
      flattenedColors[i * 4 + 2] = parseInt(result[3], 16);
      flattenedColors[i * 4 + 3] = 255;
    });
    
    return splatterplot;
  }

  splatterplot.circleSize = function(newSize) {
    ptSize = newSize;
    return splatterplot;
  }


	return splatterplot;
}