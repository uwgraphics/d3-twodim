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

  this.prevViewport = [];

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

  // set up default shaders
  this.getShader("pointShader", shaders.basicVertexShader, shaders.basicFragShader);
  this.getShader("quadShader", shaders.spVBlurShader, shaders.identityFShader);

  // set up render/framebuffer
  this.fbo = gl.createFramebuffer();
  this.rbo = gl.createRenderbuffer();
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

  // release the bound buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

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

  // gl.clearColor(0.0, 0.0, 0.0, 0.0);
  // gl.clear(gl.COLOR_BUFFER_BIT);

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
		if (!location || location == -1) {
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
};

function bindUniformsAndRequestedBuffers(prog, options) {
  var gl = this.gl;
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
};

function setUpDrawingState(options) {
  var self = this;
  var gl = this.gl;
  var prog = this.progs[options.shader];

  if (prog === undefined)
    throw "Shader '" + options.shader + "' not found in library; did you forget to call getShader('"+options.shader+"',{vert},{frag})?";

  // add to-be-bound textures and their positions to the uniform list
  // allow textures to be named something other than what they're named within the shader 
  //     iif array elements are of length two (texName, shaderName);
  if (options.textures.length != 0 && Array.isArray(options.textures[0])) {
    options.textures.forEach(function(texMapEntry, i) {
      options.uniforms[texMapEntry[1]] = i;
    });
  } else {
    options.textures.forEach(function(texName, i) {
      options.uniforms[texName] = i;
    });
  }

  bindUniformsAndRequestedBuffers.call(this, prog, options);

  // clear the viewport, if requested
  // if `options.clear` is an array, use those colors to clear
  if (!!options.clear) {
    if (Array.isArray(options.clear))
      gl.clearColor(options.clear[0], options.clear[1], options.clear[2], options.clear[3]);
    else
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  
  // bind the requested textures, if requested
  options.textures.forEach(function(texName, i) {
    if (Array.isArray(texName) && texName.length == 2)
      self.bindTexture(texName[0], i);
    else
      self.bindTexture(texName, i);
  });

  // if drawing to texture, set up frame/renderbuffer for drawing
  var v;
  if (!!options.drawToTexture) {
    var drawToTex = this.textures[options.drawToTexture];
    if (!drawToTex)
      throw new Error("Can't draw to texture " + options.drawToTexture + "; texture not found.");

    this.prevViewport = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.rbo);

    if (drawToTex.width != this.rbo.width || drawToTex.height != this.rbo.height) {
      this.rbo.width = drawToTex.width;
      this.rbo.height = drawToTex.height;
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, drawToTex.width, drawToTex.height);
    }

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, drawToTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rbo);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
      throw new Error("Incomplete framebuffer detected (maybe failed to bind requested texture " + options.drawToTexture + "?)");
  }
};

function tearDownDrawingState(options) {
  var self = this;
  var gl = this.gl;
  var v = this.prevViewport;
  var prog = this.progs[options.shader];

  // unbind any bound framebuffers
  if (!!options.drawToTexture) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.viewport(v[0], v[1], v[2], v[3]);
  }

  // unbind the bound textures
  options.textures.forEach(function(texName, i) {
    // texName parameter doesn't matter here; only i does
    self.unbindTexture(texName, i);
  });

  // disable all attribute pointers
  options.useData.forEach(function(bufNames) {
    gl.disableVertexAttribArray(prog.attribLocations[name]);
  });

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
};

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
      pointSize: ("drawDensity" in options && options.drawDensity) ? 1 : 7, 
      colorRampWidth: this.textures['colorRamp'].width
    }, 
    drawToTexture: false,
    drawDensity: false,
    clear: true, 
    textures: ['colorRamp'], 
    useData: ['position', 'colorIndex']
  };

  // merge objects together, overwriting defaults
  // don't overwrite uniforms, but overwrite everything else(?)
  options.uniforms = Object.assign(optionDefaults.uniforms, options.uniforms);
  options = Object.assign(optionDefaults, options);

  setUpDrawingState.call(this, options);
  
  if (options.drawDensity) {
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
  } else {
    // blend points nicely, especially if antialiasing the points
    gl.disable(gl.DEPTH_TEST);
    // srcAlpha must be ONE (otherwise resulting alpha will be 0???)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE); 
    gl.enable(gl.BLEND);
  }

  // actually draw the points
  gl.drawArrays(gl.POINTS, 0, this.buffers['position'].length);

  tearDownDrawingState.call(this, options);
}

webgl_util.prototype.drawQuad = function(options) {
  var gl = this.gl;

  if (!this.buffers.hasOwnProperty("quad")) {
    this.setData("quad", [
      [-1, -1, 0],
      [ 1, -1, 0],
      [-1,  1, 0],
      [-1,  1, 0],
      [ 1, -1, 0],
      [ 1,  1, 0]
    ]);
  }

  var optionDefaults = {
    shader: "quadShader",
    uniforms: {},
    drawToTexture: false,
    clear: true,
    textures: [],
    useData: ['quad']
  };

  // merge objects together, overwriting defaults
  // don't overwrite uniforms, but overwrite everything else(?)
  options.uniforms = Object.assign(optionDefaults.uniforms, options.uniforms);
  options = Object.assign(optionDefaults, options);

  setUpDrawingState.call(this, options);

  // set up state for drawing from a quad
  gl.disable(gl.DEPTH_TEST);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.DST_ALPHA);
  gl.disable(gl.BLEND);

  gl.drawArrays(gl.TRIANGLES, 0, this.buffers['quad'].length);

  tearDownDrawingState.call(this, options);  
}

webgl_util.prototype.getTextureData = function(name) {
  var gl = this.gl;
  var tex = this.textures[name];

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE) {
    var pixels = new Uint8Array(tex.width * tex.height * 4);
    gl.readPixels(0, 0, tex.width, tex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return pixels;
  }
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return [];
}

export default webgl_util;