var plane;
var fbo, rbo;

export function compileShaders(gl, name, vertShader, fragShader) {
	// if (progs.hasOwnProperty(name))
	// 	return progs[name];

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
	gl.attachShader(prog, comp(vertShader, gl.VERTEX_SHADER));
	gl.attachShader(prog, comp(fragShader, gl.FRAGMENT_SHADER));
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
	while ((groups = re.exec(vertShader + fragShader)) != null) {
		prog.isSampler[groups[3]] = true;
	}
	
	return prog;
}

export function createTexture(gl, width, height, options) {
  // set defaults
  options = options || {};
  var filter = options.filter || gl.NEAREST;
  var type = options.type || gl.FLOAT;
  var format = options.format || gl.RGBA;
  var wrap = options.wrap || gl.CLAMP_TO_EDGE;
  var flipY = options.flipY || 0;

  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, options.data || null);

  return tex;
}

// draws data using a full quad, 
// useful for drawing from textures previously written to by a framebuffer
export function drawFromTextureQuad(gl, prog, uniforms, renderFunc) {
  if (!plane) {
    plane = {};
    plane.vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, plane.vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0,
       1, -1, 0,
      -1,  1, 0,
       1,  1, 0
    ]), gl.STATIC_DRAW);

    plane.indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, plane.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
      0, 1, 2,
      2, 1, 3
    ]), gl.STATIC_DRAW);
  }

  // set up the uniforms
  gl.useProgram(prog);
  parseUniforms(gl, prog, uniforms);

  // bind the full quad, and set up attribute (`position`)
  gl.bindBuffer(gl.ARRAY_BUFFER, plane.vertices);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, plane.indices);

  var coord = gl.getAttribLocation(prog, 'position');
  gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(coord);

  // call any user-defined function (e.g. setting depth test, clearing canvas)
  renderFunc();

  // draw the quad
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  // clean up bound buffers and pointers
  gl.disableVertexAttribArray(coord);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function parseUniforms(gl, prog, uniforms) {
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

export function draw(gl, prog, uniforms, attribs, buffer, renderFunc) {
	gl.useProgram(prog);
  parseUniforms(gl, prog, uniforms);

	function getSize(glEnum) {
    switch (glEnum) {
      case gl.BYTE:
      case gl.UNSIGNED_BYTE:
        return 1;
      case gl.SHORT:
      case gl.UNSIGNED_SHORT:
        return 2;
      case gl.FLOAT:
      case gl.FIXED:
        return 4;
      default:
        throw new Error("unknown glEnum for attribute type provided");
    }
  }

  // activate provided attribs
  if (!attribs)
    console.warn("Need defined attributes to draw: {name: {numElements, type, offset}, ...}");
  else {
    // bind the supplied buffer (required in WebGL to draw anything!)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // make sure we have a record of all required attribute locations
    for (var name in attribs) {
      var value = attribs[name];
      var location = prog.attribLocations[name] || gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(location);
      prog.attribLocations[name] = location;
    }

    // set up the attribute pointers, taking special care if multiple
    // attributes are part of a single buffer
    if (Object.keys(attribs).length === 1) {
      gl.vertexAttribPointer(location, value.numElements, value.type, false, 0, 0);
    } else {
      // figure out the stride between elements
      var stride = Object.keys(attribs)
        .reduce(function(p, d) { 
          return p + getSize(attribs[d].type) * attribs[d].numElements; 
        }, 0);
      for (var name in attribs) {
        var value = attribs[name];
        var location = prog.attribLocations[name];
        gl.vertexAttribPointer(location, value.numElements, value.type, false, stride, value.offset);
      }
    }
  }

	// actually call the render function
	renderFunc();

  // disable active attribute arrays 
  // (to prevent collisions if drawing with other shaders later)
  for (var name in attribs) {
    gl.disableVertexAttribArray(prog.attribLocations[name]);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

export function drawTo(gl, texture, width, height, callback) {
  var v = gl.getParameter(gl.VIEWPORT);

  fbo = fbo || gl.createFramebuffer();
  rbo = rbo || gl.createRenderbuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);

  if (width != rbo.width || height != rbo.height) {
    rbo.width = width;
    rbo.height = height;
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
  }

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
		throw new Error("Incomplete framebuffer detected");
	}
  
  gl.viewport(0, 0, width, height);
	
	callback();

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.viewport(v[0], v[1], v[2], v[3]);
}