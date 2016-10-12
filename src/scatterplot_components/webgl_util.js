import {default as shaders} from './splatterplot_shaders';

var webgl_util = function(gl, width, height) {
  this.gl = gl;
  this.width = width;
  this.height = height;
  
  this.progs = {};

  this.data = {};
  this.buffers = {};

  this.textures = {};

  this.fbo, this.rbo = undefined;

  this.quad;
  this.mvp;
  this.bounds;
};

webgl_util.prototype.initCanvas = function() {
  var gl = this.gl;
  var f = gl.getExtension("OES_texture_float");
  if (!f) 
    console.warn("The OES_texture_float WebGL extension is required for some operations.  Fatal errors may follow");

  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.viewport(0, 0, this.width, this.height);

  // set up default shader
  this.getShader("pointShader", shaders.basicVertexShader, shaders.basicFragShader);
};

webgl_util.prototype.setPoints = function(data) {
  this.setData("position", data);
}

webgl_util.prototype.setPointColors = function(data) {
  this.setData("colorIndex", data);
}

webgl_util.prototype.setData = function(name, data, type) {
  var gl = this.gl;
  type = type || Float32Array;
  this.data[name] = data;
  
  var thisData = [];
  var buf = this.buffers[name] || gl.createBuffer();
  
  // flatten the array, and chunk to avoid overflow
  var chunk = 10000;
  for (var i = 0; i < data.length; i += chunk) {
    thisData = Array.prototype.concat.apply(thisData, data.slice(i, i + chunk));
  }

  // set the buffer's data, including metadata for drawing 
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new type(thisData), gl.STATIC_DRAW);
  
  buf.type = type;
  buf.length = data.length;
  buf.spacing = thisData.length / data.length;

  if (buf.spacing != Math.round(buf.spacing) || buf.spacing > 4) {
    throw "Number of elements for each point is not consistent, or averages more than 4 items";
  }

  this.buffers[name] = buf;
}

webgl_util.prototype.setBounds = function(xDomain, yDomain) {
  if (!arguments.length) {
    // pull from position
    if (!this.data.hasOwnProperty("position")) 
      throw "Unable to set bounds with no parameters and no 'point' data set."
    
    var xDomain = [Infinity, -Infinity];
    var yDomain = [Infinity, -Infinity];
    var domain = this.data["position"].reduce(function(prev, point) {
      var x = point[0];
      var y = point[1];
      prev[0][0] = Math.min(prev[0][0], point[0]);
      prev[0][1] = Math.max(prev[0][1], point[0]);
      prev[1][0] = Math.min(prev[1][0], point[1]);
      prev[1][1] = Math.max(prev[1][1], point[1]);

      return prev;
    }, [[Infinity, -Infinity], [Infinity, -Infinity]]);

    xDomain = domain[0];
    yDomain = domain[1];
  }
  
  var scale_x = 2 / (xDomain[1] - xDomain[0]);
  var scale_y = 2 / (yDomain[1] - yDomain[0]);
  var trans_x = -1 - xDomain[0];
  var trans_y = -1 - yDomain[0];

  this.mvp = [
    scale_x, 0,       0, trans_x,
    0,       scale_y, 0, trans_y, 
    0,       0,       1, 0,
    0,       0,       0, 1
  ];
}

webgl_util.prototype.getShader = function(name, vert, frag) {
  var gl = this.gl;
  var compileShader = function(vert, frag) {
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

    var prog = gl.createProgram();
    gl.attachShader(prog, comp(vert, gl.VERTEX_SHADER));
    gl.attachShader(prog, comp(frag, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Could not initialize shader program: " + gl.getProgramInfoLog(prog));
      return null;
    }

    prog.uniformLocations = {};
    prog.attribLocations = {};

    // progs[name] = prog;
    prog.isSampler = {};

    var groups;
    var re = /uniform\s+(sampler(1D|2D|3D|Cube)|int)\s+(\w+)\s*;/g;
    while ((groups = re.exec(vert + frag)) != null) {
      prog.isSampler[groups[3]] = true;
    }
    
    return prog;
  }

  if (!this.progs.hasOwnProperty(name)) {
    vert = vert || shaders.basicVertexShader;
    frag = frag || shaders.basicFragShader;
    var prog = compileShader(vert, frag);
    this.progs[name] = prog;
  }

  return this.progs[name];
};

webgl_util.prototype.createTexture = function(name, width, height, options) {
  var gl = this.gl;

  // set defaults
  options = options || {};
  var filter = options.filter || gl.NEAREST;
  var type = options.type || gl.FLOAT;
  var format = options.format || gl.RGBA;
  var wrap = options.wrap || gl.CLAMP_TO_EDGE;
  var flipY = options.flipY || 0;

  var tex = gl.createTexture();
  tex.width = width; tex.height = height;
  gl.bindTexture(gl.TEXTURE_2D, tex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, options.data || null);

  gl.bindTexture(gl.TEXTURE_2D, null);

  this.textures[name] = tex;
  return this.textures[name];
};

webgl_util.prototype.bindTexture = function(name, textureUnit) {
  var gl = this.gl;
  if (!isNaN(textureUnit) && textureUnit >= 8 && textureUnit < 0) {
    throw "textureUnit to webgl_util.bindTexture should between 0 and 7, inclusive.";
  }

  if (!this.textures.hasOwnProperty(name)) {
    throw "Unable to find texture '" + name + "' in the list of initialized textures";
  }

  gl.activeTexture(gl["TEXTURE" + textureUnit]);
  gl.bindTexture(gl.TEXTURE_2D, this.textures[name]);
}

webgl_util.prototype.unbindTexture = function(name, textureUnit) {
  var gl = this.gl;
  if (!isNaN(textureUnit) && textureUnit >= 8 && textureUnit < 0) {
    throw "textureUnit to webgl_util.bindTexture should between 0 and 7, inclusive.";
  }
  
  gl.activeTexture(gl["TEXTURE" + textureUnit]);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

webgl_util.prototype.setColorRamp = function(colors) {
  var gl = this.gl;
  var texWidth = Math.ceil(Math.sqrt(colors.length));
  var colorData = new Uint8Array(texWidth * texWidth * 4);
  colors.forEach(function(d, i) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(d);
    colorData[i * 4]     = parseInt(result[1], 16);
    colorData[i * 4 + 1] = parseInt(result[2], 16);
    colorData[i * 4 + 2] = parseInt(result[3], 16);
    colorData[i * 4 + 3] = 255;
  });

  this.createTexture("colorRamp", texWidth, texWidth, {
    type: gl.UNSIGNED_BYTE,
    data: colorData
  });
}

function parseUniforms(prog, uniforms) {
  var gl = this.gl;
  gl.useProgram(prog);

  for (var name in uniforms) {
		var location = prog.uniformLocations[name] || gl.getUniformLocation(prog, name);
		if (!location) {
			console.warn("unable to find uniform " + name);
			continue;
		}
		prog.uniformLocations[name] = location;

		var value = uniforms[name];
		if (Array.isArray(value)) {
			switch (value.length) {
				case 1: gl.uniform1fv(location, new Float32Array(value)); break;
				case 2: gl.uniform2fv(location, new Float32Array(value)); break;
				case 3: gl.uniform3fv(location, new Float32Array(value)); break;
				case 4: gl.uniform4fv(location, new Float32Array(value)); break;
				case 9: gl.uniformMatrix3fv(location, false, new Float32Array([
					value[0], value[3], value[6],
					value[1], value[4], value[7],
					value[2], value[5], value[8]
				])); break;
				case 16: gl.uniformMatrix4fv(location, false, new Float32Array([
					value[0], value[4], value[8],  value[12],
					value[1], value[5], value[9],  value[13],
					value[2], value[6], value[10], value[14],
					value[3], value[7], value[11], value[15]
				])); break;
				default: throw new Error("Uniform " + name + " contains a strange length, can't parse into shader");
			}
		} else if (!isNaN(parseFloat(value)) && isFinite(value)) {
			(prog.isSampler[name] ? gl.uniform1i : gl.uniform1f).call(gl, location, value);
		} else {
			throw new Error("Unable to set uniform " + name + ": unable to parse value " + value);
		}
	}
}

function arrayBufToGLType(type) {
  var gl = this.gl;
  switch(type.name) {
    case "UInt8Array":
      return gl.UNSIGNED_BYTE;
    case "Int8Array":
      return gl.BYTE;
    case "UInt16Array":
      return gl.UNSIGNED_SHORT;
    case "Int16Array":
      return gl.SHORT;
    case "Float32Array":
      return gl.FLOAT;
    default:
      throw "unknown array type passed to arrayBufToGLType()";
  }
}

// TODO: support drawing to texture
webgl_util.prototype.drawPoints = function(options) {
  var gl = this.gl;

  // check if position is set
  if (!this.buffers.hasOwnProperty('position'))
    throw "Point data has not been set; nothing to draw";

  // check if colorRamp is set, otherwise set default color for every point
  if (!this.textures.hasOwnProperty('colorRamp')) {
    this.setColorRamp(["#1f77b4"]);
    this.setPointColors(Array(this.data['position'].length).fill(0));
  }

  // check if mvp is set, otherwise force a computation
  if (this.mvp === undefined)
    this.setBounds();

  var optionDefaults = { 
    shader: "pointShader", 
    uniforms: {
      mvp: this.mvp, 
      pointSize: 7, 
      colorRampWidth: this.textures['colorRamp'].width
    }, 
    drawToTexture: false, 
    clear: true, 
    textures: ['colorRamp'], 
    useData: ['position', 'colorIndex']
  };

  // merge objects together, overwriting defaults
  options = Object.assign(optionDefaults, options);

  // add to-be-bound textures and their positions to the uniform list
  options.textures.forEach(function(d, i) {
    options.uniforms[d] = i;
  })

  var prog = this.progs[options.shader]
  gl.useProgram(prog);
  parseUniforms.call(this, prog, options.uniforms);

  // set up each buffer, based on requested buffers
  var self = this;
  options.useData.forEach(function(bufName) {
    var buf = self.buffers[bufName];
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);

    var location = prog.attribLocations[bufName] || gl.getAttribLocation(prog, bufName);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, buf.spacing, arrayBufToGLType.call(self, buf.type), false, 0, 0);

    prog.attribLocations[bufName] = location;
  });

  // clear the viewport, if requested
  if (options.clear)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // bind the requested textures, if requested
  options.textures.forEach(function(d, i) {
    self.bindTexture(d, i);
  });

  // blend points nicely, especially if antialiasing the points
  gl.disable(gl.DEPTH_TEST);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
  gl.enable(gl.BLEND);

  // actually draw the points
  gl.drawArrays(gl.POINTS, 0, this.buffers['position'].length);

  // unbind the bound textures
  options.textures.forEach(function(d, i) {
    self.unbindTexture(d, i);
  });

  // disable all attribute pointers
  options.useData.forEach(function(bufNames) {
    gl.disableVertexAttribArray(prog.attribLocations[name]);
  });

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}



export default webgl_util;