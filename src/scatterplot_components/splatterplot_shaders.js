/// !!! comments are not supported by the parsing code;
///     please place comments above the definition

export default {
  basicVertexShader: " \
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
    }",

  basicFragShader: " \
    precision highp float; \
    varying vec4 vColor; \
    \
    void main() { \
      gl_FragColor = vColor; \
      float dist = distance(gl_PointCoord, vec2(0.5)); \
      gl_FragColor.a = 1.0 - smoothstep(0.45, 0.55, dist); \
    }",

  /** SPLATTERPLOT-SPECIFIC SHADERS */
  spVPointShader: " \
    attribute vec3 position; \
    uniform float pointSize; \
    uniform mat4 mvp; \
    varying vec4 vColor; \
    \
    void main() { \
      gl_Position = mvp * vec4(position.xy, 0.0, 1.0); \
      gl_PointSize = pointSize; \
      vColor = vec4(1.0); \
    }",

  spFPointShader: " \
    precision highp float; \
    varying vec4 vColor; \
    void main() { \
      gl_FragColor = vColor; \
    }",

  spVBlurShader: " \
    attribute vec3 position; \
    varying vec2 coord; \
    \
    void main() { \
      coord = position.xy * 0.5 + 0.5; \
      gl_Position = vec4(position, 1.0); \
    }",

  spFBlurShader: function(d) {
    d = d || 128; 
    return " \
    precision highp float; \
    uniform sampler2D texture; \
    uniform vec2 offset; \
    uniform float sigma; \
    uniform vec2 delta; \
    \
    varying vec2 coord; \
    \
    void main() { \
      float sum = 0.0; \
      float accum = 0.0; \
      for (int i = -" + d + "; i <= " + d + "; i++) { \
        vec2 thisOffset = offset * vec2(float(i)) * delta; \
        vec2 target = coord + thisOffset; \
        \
        float gW = exp(-float(i*i) / (2.0 * sigma * sigma)); \
        \
        if (target.x >= 0.0 && target.x <= 1.0 && target.y >= 0.0 && target.y <= 1.0) { \
          sum += gW; \
          accum += texture2D(texture, vec2(target)).r * gW; \
        } \
      } \
      \
      accum /= sum; \
      gl_FragColor = vec4(accum / 50.0, 0.0, 0.0, 1.0); \
    }";
  },

  spFTestTexture: " \
    precision highp float; \
    uniform sampler2D texture; \
    varying vec2 coord; \
    \
    void main() { \
      gl_FragColor = texture2D(texture, coord); \
    }",
  
  spFMaxValue: " \
    precision highp float; \
    uniform sampler2D texture; \
    uniform vec2 delta; \
    \
    varying vec2 coord; \
    \
    void main() { \
      float curMax = 0.0; \
      for (int i = 0; i < 8; i++) { \
        for (int j = 0; j < 8; j++) { \
          vec2 thisPos = coord * 8.0 + vec2(float(i), float(j)) * delta; \
          if (thisPos.x < 0.0 || thisPos.x > 1.0 || thisPos.y < 0.0 || thisPos.y > 1.0) { \
            continue; \
          } \
          curMax = max(curMax, texture2D(texture, thisPos).r); \
        } \
      } \
      \
      gl_FragColor = vec4(curMax, 0.0, 0.0, 1.0); \
    }",

  spFJFAInit: " \
    precision highp float; \
    uniform sampler2D texture; \
    uniform sampler2D maxTex; \
    \
    uniform float upperLimit; \
    \
    varying vec2 coord; \
    \
    void main() { \
      float val = texture2D(texture, coord).r; \
      vec4 color = vec4(0, coord.x, coord.y, 1); \
      \
      float maxVal = texture2D(maxTex, vec2(0.0)).r; \
      val = val/maxVal; \
      \
      if (val < upperLimit) { \
        color.r = 1000.0; \
        color.g = 1000.0; \
        color.b = 1000.0; \
      } \
      \
      gl_FragColor = color; \
    }",

  spFJFA: " \
    precision highp float; \
    uniform sampler2D texture; \
    uniform float kStep; \
    uniform vec2 delta; \
    \
    varying vec2 coord; \
    \
    vec3 calcMin(vec3 curMin, vec2 coordsToQuery) { \
      if (coordsToQuery.x < 0.0 || coordsToQuery.x > 1.0 || coordsToQuery.y < 0.0 || coordsToQuery.y > 1.0) { \
        return curMin; \
      } \
      \
      vec3 query = texture2D(texture, coordsToQuery).xyz; \
      \
      if (query.y < 0.0 || query.y > 1.0 || query.z < 0.0 || query.z > 1.0) { \
        return curMin; \
      }	\
      \
      float dist = distance(coord / delta, query.yz / delta); \
      if (dist < curMin.x) { \
        return vec3(dist, query.yz); \
      } else { \
        return curMin; \
      } \
    } \
    \
    void main() { \
      vec3 minVal = texture2D(texture, coord).xyz; \
      \
      minVal = calcMin(minVal, vec2(coord.x + kStep * delta.x, coord.y + kStep * delta.y)); \
      minVal = calcMin(minVal, vec2(coord.x + kStep * delta.x, coord.y - kStep * delta.y)); \
      minVal = calcMin(minVal, vec2(coord.x - kStep * delta.x, coord.y + kStep * delta.y)); \
      minVal = calcMin(minVal, vec2(coord.x - kStep * delta.x, coord.y - kStep * delta.y)); \
      minVal = calcMin(minVal, vec2(coord.x,                   coord.y + kStep * delta.y)); \
      minVal = calcMin(minVal, vec2(coord.x,                   coord.y - kStep * delta.y)); \
      minVal = calcMin(minVal, vec2(coord.x + kStep * delta.x, coord.y                  )); \
      minVal = calcMin(minVal, vec2(coord.x - kStep * delta.x, coord.y                  )); \
      \
      vec4 color = vec4(minVal.xyz, 1.0); \
      gl_FragColor = color; \
    }",

  spFJFATest: " \
    precision highp float; \
    uniform sampler2D texture; \
    uniform float maxDist; \
    \
    varying vec2 coord; \
    \
    void main() { \
      float color = texture2D(texture, coord).r / maxDist; \
      gl_FragColor = vec4(vec3(color), 1.0); \
    }"
}
