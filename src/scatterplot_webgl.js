export default function() {
  var gl;
  var prog;

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

  var basicVertexShader = " \
    attribute vec2 position; \
    attribute float colorIndex; \
    \
    uniform mat4 mvp; \
    uniform float pointSize; \
    \
    uniform sampler2D colorRamp; \
    uniform float colorRampWidth; \
    \
    varying vec4 vColor; \
    \
    void main() { \
      gl_Position = mvp * vec4(position, 0.0, 1.0); \
      gl_PointSize = pointSize; \
      \
      float colorY = floor(colorIndex / colorRampWidth) / colorRampWidth; \
      float colorX = floor(mod(colorIndex, colorRampWidth)) / colorRampWidth; \
      vColor = texture2D(colorRamp, vec2(colorX, colorY) + vec2(1.0 / colorRampWidth / 2.0)); \
    }";
  
  var basicFragShader = " \
    precision highp float; \
    varying vec4 vColor; \
    \
    void main() { \
      gl_FragColor = vColor; \
      float dist = distance(gl_PointCoord, vec2(0.5)); \
      gl_FragColor.a = 1.0 - smoothstep(0.45, 0.55, dist); \
    }";

  function compileShaders() {
    function comp(str, type) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, str);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Error compiling shader: " + gl.getShaderInfoLog(shader));
        return null;
      }

      return shader;
    }

    prog = gl.createProgram();
    gl.attachShader(prog, comp(basicVertexShader, gl.VERTEX_SHADER));
    gl.attachShader(prog, comp(basicFragShader, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Could not initialize shader program");
      return;
    }

    gl.useProgram(prog);

    prog.points = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(prog.points);
    prog.colorIndex = gl.getAttribLocation(prog, 'colorIndex');
    gl.enableVertexAttribArray(prog.colorIndex);

    prog.pointSize = gl.getUniformLocation(prog, 'pointSize');
    prog.mvp = gl.getUniformLocation(prog, 'mvp');
    prog.colorRamp = gl.getUniformLocation(prog, 'colorRamp');
    prog.colorRampWidth = gl.getUniformLocation(prog, 'colorRampWidth');
  }

  function initCanvas() {
    gl.disable(gl.DEPTH_TEST);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.enable(gl.BLEND);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.viewport(0, 0, width, height);

    pointsBuf = gl.createBuffer();
  }

  function setBounds() {
    if (!scale)
      throw "Need to call webgl component with data before drawing";
    
    var scale_x = 2 / (scale.x.domain()[1] - scale.x.domain()[0]);
    var scale_y = 2 / (scale.y.domain()[1] - scale.y.domain()[0]);
    var trans_x = -1 - scale.x.domain()[0];
    var trans_y = -1 - scale.y.domain()[0];

    curTransform = new Float32Array([
      scale_x, 0,       0, 0,
      0,       scale_y, 0, 0, 
      0,       0,       1, 0,
      trans_x, trans_y, 0, 1
    ]);
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

    setBounds();
  }

  function setUniforms() {
    gl.uniform1f(prog.pointSize, ptSize);
    gl.uniformMatrix4fv(prog.mvp, false, curTransform);
    gl.uniform1f(prog.colorRampWidth, colorRampWidth);

    // set the color ramp
    colorRampTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, colorRampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, colorRampWidth, colorRampWidth,
      0, gl.RGBA, gl.UNSIGNED_BYTE, flattenedColors);
  }
  
  function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, colorRampTexture);
    gl.uniform1i(prog.colorRamp, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, pointsBuf);
    gl.vertexAttribPointer(prog.points, 2, gl.FLOAT, false, 12, 0);
    gl.vertexAttribPointer(prog.colorIndex, 1, gl.FLOAT, false, 12, 8);
    gl.drawArrays(gl.POINTS, 0, data.length);
  }
  
  // assume that an SVG/canvas combination has already been set up with correct width/height
  function scatterplot_webgl(selection, isDirty) {
    if (!gl) {
      var webglCanvas = selection.select('canvas');
      gl = webglCanvas.node().getContext('webgl');
      if (!gl) {
        console.error("Your browser does not seem to support WebGL, should revert to canvas/SVG.");
        return -1;
      }

      width = +webglCanvas.attr('width');
      height = +webglCanvas.attr('height');

      initCanvas();
    }

    if (!prog)
      compileShaders();

    if (isDirty) {
      genDataBuffer();
      setUniforms();
    }

    render();
  };

  scatterplot_webgl.setData = function(dataN, xValueN, yValueN, grpValueN, foundGroupsN, scaleN) {
    data = dataN;
    xValue = xValueN;
    yValue = yValueN;
    grpVal = grpValueN;
    foundGroups = foundGroupsN;
    scale = scaleN;

    return scatterplot_webgl;
  }

  scatterplot_webgl.setColorScale = function(newScale) {
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
    
    return scatterplot_webgl;
  }

  scatterplot_webgl.circleSize = function(newSize) {
    ptSize = newSize;
    return scatterplot_webgl;
  }

  return scatterplot_webgl;
}