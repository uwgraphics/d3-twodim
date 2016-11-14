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
    attribute vec3 quad; \
    varying vec2 coord; \
    \
    void main() { \
      coord = quad.xy * 0.5 + 0.5; \
      gl_Position = vec4(quad, 1.0); \
    }",

  identityFShader: " \
    precision highp float; \
    uniform sampler2D texture; \
    varying vec2 coord; \
    \
    void main() { \
      gl_FragColor = texture2D(texture, coord); \
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

  spFBlurTest: " \
    precision highp float; \
    uniform sampler2D texture; \
    uniform sampler2D maxTex; \
    \
    varying vec2 coord; \
    \
    void main() { \
      float maxVal = texture2D(maxTex, vec2(0.0)).r; \
      gl_FragColor = vec4(texture2D(texture, coord).x / maxVal, 0.0, 0.0, 1.0); \
    }",

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
    }",

  spVOutlier: " \
    uniform sampler2D jfa; \
    uniform float gridSize; \
    uniform vec2 resolution; \
    uniform vec2 offset; \
    uniform mat4 mvp; \
    \
    attribute vec3 position; \
    \
    varying vec4 vColor; \
    \
    void main() { \
      vec4 thisPos = mvp * vec4(position.xy, 0.0, 1.0); \
      vec2 coord = thisPos.xy * 0.5 + 0.5; \
      \n\
      // condition for discarding point \
      // distance from the thresholded region (don't draw points within the thresholded region) \n\
      float dist = texture2D(jfa, coord).r; \
      float clip = dist < (gridSize / 2.0) ? 0.0 : 1.0; \
      \n\
      // get the grid coordinates of this particular point, and convert to clip-space coordinates \n\
      vec2 c = floor((coord + offset) * resolution / gridSize); \
      c = 2.0 * (c / resolution) - 1.0; \
      \
      gl_Position = vec4(c, mod(position.z, 1.0), clip); \
      gl_PointSize = 1.0; \
      vColor = vec4(coord, 0.0, 1.0); \
    }",

  spFOutlierCombine: " \
    precision highp float; \
    uniform sampler2D grid; \
    uniform float gridSize; \
    uniform float pointRadius; \
    uniform vec2 resolution; \
    uniform vec2 offset; \
    \
    varying vec2 coord; \
    \
    float getDist(vec2 lookahead) { \
      vec2 gridPos = floor((coord + offset) * resolution / gridSize); \
      gridPos = (gridPos + lookahead) / resolution; \
      vec4 data = texture2D(grid, gridPos); \
      \
      if (data.a > 0.0) { \
        return distance(data.xy * resolution, coord * resolution); \
      } else { \
        return 10000.0; \
      } \
    } \
    \
    void main() { \
      float ret = 10000.0; \
      for (int i = -1; i <= 1; i++) { \
        for (int j = -1; j <= 1; j++) { \
          ret = min(ret, getDist(vec2(float(i), float(j)))); \
        } \
      } \
      \
      if (ret < pointRadius) { \
        gl_FragColor = vec4(1.0); \
      } else { \
        gl_FragColor = vec4(0.0); \
      } \
    }",

  spFShade: " \
    precision highp float; \
    uniform sampler2D texture; \
    uniform sampler2D distances; \
    uniform sampler2D maxTex; \
    uniform sampler2D outliers; \n\
    //uniform vec2 delta; \n\
    uniform vec3 rgbColor; \
    uniform float lowerLimit; \
    uniform float upperLimit; \
    varying vec2 coord; \
    \
    float f(float n, float eps, float k){ \
        if(n > eps){ \
        return pow(n, 1.0/3.0); \
      }else{ \
        return (k * n + 16.0) / 116.0; \
      } \
    } \
    vec3 XYZtoLRGB(vec3 xyz, bool clamp){ \
      vec3 M0 = vec3( 3.2404542, -1.5371385, -0.4985314); \
      vec3 M1 = vec3(-0.9692660,  1.8760108,  0.0415560); \
      vec3 M2 = vec3( 0.0556434, -0.2040259,  1.0572252); \
      \
      float r = dot(xyz, M0); \
      float g = dot(xyz, M1); \
      float b = dot(xyz, M2); \
      \
      if(clamp){ \
        r = min(max(r, 0.0), 1.0); \
        g = min(max(g, 0.0), 1.0); \
        b = min(max(b, 0.0), 1.0); \
      } \
      \
      return vec3(r,g,b); \
    } \
    vec3 LRGBtoXYZ(vec3 lrgb){ \
      vec3 M0 = vec3(0.4124564, 0.3575761, 0.1804375); \
      vec3 M1 = vec3(0.2126729, 0.7151522, 0.0721750); \
      vec3 M2 = vec3(0.0193339, 0.1191920, 0.9503041); \
      \
      return vec3(dot(lrgb, M0), dot(lrgb, M1), dot(lrgb, M2)); \
    } \
    vec3 XYZtoLAB(vec3 xyz){ \
      float Xr = 0.95047; \
      float Yr = 1.0; \
      float Zr = 1.08883; \
      \
      float eps = 216.0 / 24389.0; \
      float k = 24389.0 / 27.0; \
      \
      float xr = xyz.x / Xr; \
      float yr = xyz.y / Yr; \
      float zr = xyz.z / Zr; \
      \
      xr = f(xr, eps, k); \
      yr = f(yr, eps, k); \
      zr = f(zr, eps, k); \
      \
      float L = 116.0 * yr - 16.0; \
      float a = 500.0 * (xr - yr); \
      float b = 200.0 * (yr - zr); \
      \
      return vec3(L,a,b); \
    } \
    vec3 LABtoXYZ(vec3 lab){ \
      float Xr = 0.95047; \
      float Yr = 1.0; \
      float Zr = 1.08883; \
      \
      float eps = 216.0 / 24389.0; \
      float k = 24389.0 / 27.0; \
      \
      float L = lab.x; \
      float a = lab.y; \
      float b = lab.z; \
      \
      float fy  = (L + 16.0) / 116.0; \
      float fx  = a / 500.0 + fy; \
      float fz  = -b / 200.0 + fy; \
      \
      float xr = ((pow(fx, 3.0) > eps) ? pow(fx, 3.0) : (116.0 * fx - 16.0) / k); \
      float yr = ((L > (k * eps)) ? pow(((L + 16.0) / 116.0), 3.0) : L / k); \
      float zr = ((pow(fz, 3.0) > eps) ? pow(fz, 3.0) : (116.0 * fz - 16.0) / k); \
      \
      float X = xr * Xr; \
      float Y = yr * Yr; \
      float Z = zr * Zr; \
      \
      return vec3(X,Y,Z); \
    } \
    vec3 LABtoLCH(vec3 lab){ \
      float l = lab.x; \
      float a = lab.y; \
      float b = lab.z; \
      \
      float C = sqrt(a*a + b*b); \
      float H = atan(b,a); \
      \
      return vec3(l,C,H); \
    } \
    vec3 LCHtoLAB(vec3 lch){ \
      float l = lch.x; \
      float c = lch.y; \
      float h = lch.z; \
      \
      return vec3(l, c*cos(h), c*sin(h)); \
    } \
    vec3 RGBtoLAB(vec3 rgb){ \
      return  XYZtoLAB(LRGBtoXYZ(rgb)); \
    } \
    vec3 LABtoRGB(vec3 lab, bool clamp){ \
      return XYZtoLRGB(LABtoXYZ(lab),clamp); \
    } \
    \
    void main() { \n\
      // vec2 texCoords = coord + vec2(0.5) * delta; \n\
      float w = texture2D(texture, coord).r; \
      float dist = texture2D(distances, coord).r; \
      \
      float maxVal = texture2D(maxTex, vec2(0.0)).r; \
      float wf = w / maxVal; \
      float a = wf > lowerLimit ? wf : 0.0; \
      \
      vec3 lab = RGBtoLAB(rgbColor); \
      vec3 lch = LABtoLCH(lab); \
      \n\
      // draw outlier points \n\
      float outlier = texture2D(outliers, coord).r; \
      if (outlier > 0.0) { \
        a = 1000.0; \
      } else if ((dist > 0.0) && (dist < 3.0)) { \
        lch.x *= 0.95; \
        lch.y *= 0.95; \
        a = 1000.0; \
      } else { \
        if (wf >= upperLimit) { \
          wf = 1.0; \
          a = 1.0; \
        } else { \
          wf = wf/upperLimit; \
        } \
        \
        lch.x = lch.x * wf + (1.0 - wf) * 100.0; \
        lch.y = lch.y * wf; \
      } \
      \
      vec3 ret = LABtoRGB(LCHtoLAB(lch), true); \
      gl_FragColor = vec4(ret.xyz, a); \
    }",

  spFBlend: " \
    precision highp float; \
    uniform sampler2D texture0; \
    uniform sampler2D texture1; \
    uniform sampler2D texture2; \
    uniform sampler2D texture3; \
    uniform sampler2D texture4; \
    uniform sampler2D texture5; \
    uniform sampler2D texture6; \
    uniform sampler2D texture7; \
    \
    uniform int N; \
    uniform float lf; \
    uniform float cf; \
    \
    varying vec2 coord; \
    \
    float f(float n, float eps, float k) { \
      if(n > eps) { \
        return pow(n, 1.0/3.0); \
      } else { \
        return (k * n + 16.0) / 116.0; \
      } \
    } \
    vec3 XYZtoLRGB(vec3 xyz, bool clamp) { \
      vec3 M0 = vec3( 3.2404542, -1.5371385, -0.4985314); \
      vec3 M1 = vec3(-0.9692660,  1.8760108,  0.0415560); \
      vec3 M2 = vec3( 0.0556434, -0.2040259,  1.0572252); \
      \
      float r = dot(xyz, M0); \
      float g = dot(xyz, M1); \
      float b = dot(xyz, M2); \
      \
      if(clamp) { \
        r = min(max(r, 0.0), 1.0); \
        g = min(max(g, 0.0), 1.0); \
        b = min(max(b, 0.0), 1.0); \
      } \
      \
      return vec3(r,g,b); \
    } \
    vec3 LRGBtoXYZ(vec3 lrgb) { \
      vec3 M0 = vec3(0.4124564, 0.3575761, 0.1804375); \
      vec3 M1 = vec3(0.2126729, 0.7151522, 0.0721750); \
      vec3 M2 = vec3(0.0193339, 0.1191920, 0.9503041); \
      \
      return vec3(dot(lrgb, M0), dot(lrgb, M1), dot(lrgb, M2)); \
    } \
    vec3 XYZtoLAB(vec3 xyz) { \
      float Xr = 0.95047; \
      float Yr = 1.0; \
      float Zr = 1.08883; \
      \
      float eps = 216.0 / 24389.0; \
      float k = 24389.0 / 27.0; \
      \
      float xr = xyz.x / Xr; \
      float yr = xyz.y / Yr; \
      float zr = xyz.z / Zr; \
      \
      xr = f(xr, eps, k); \
      yr = f(yr, eps, k); \
      zr = f(zr, eps, k); \
      \
      float L = 116.0 * yr - 16.0; \
      float a = 500.0 * (xr - yr); \
      float b = 200.0 * (yr - zr); \
      \
      return vec3(L,a,b); \
    } \
    vec3 LABtoXYZ(vec3 lab) { \
      float Xr = 0.95047; \
      float Yr = 1.0; \
      float Zr = 1.08883; \
      \
      float eps = 216.0 / 24389.0; \
      float k = 24389.0 / 27.0; \
      \
      float L = lab.x; \
      float a = lab.y; \
      float b = lab.z; \
      \
      float fy  = (L + 16.0) / 116.0; \
      float fx  = a / 500.0 + fy; \
      float fz  = -b / 200.0 + fy; \
      \
      float xr = ((pow(fx, 3.0) > eps) ? pow(fx, 3.0) : (116.0 * fx - 16.0) / k); \
      float yr = ((L > (k * eps)) ? pow(((L + 16.0) / 116.0), 3.0) : L / k); \
      float zr = ((pow(fz, 3.0) > eps) ? pow(fz, 3.0) : (116.0 * fz - 16.0) / k); \
      \
      float X = xr * Xr; \
      float Y = yr * Yr; \
      float Z = zr * Zr; \
      \
      return vec3(X,Y,Z); \
    } \
    vec3 LABtoLCH(vec3 lab){ \
      float l = lab.x; \
      float a = lab.y; \
      float b = lab.z; \
      \
      float C = sqrt(a*a + b*b); \
      float H = atan(b,a); \
      return vec3(l,C,H); \
    } \
    vec3 LCHtoLAB(vec3 lch){ \
      float l = lch.x; \
      float c = lch.y; \
      float h = lch.z; \
      return vec3(l, c*cos(h), c*sin(h)); \
    } \
    vec3 RGBtoLAB(vec3 rgb){ \
      return XYZtoLAB(LRGBtoXYZ(rgb)); \
    } \
    vec3 LABtoRGB(vec3 lab, bool clamp){ \
      return XYZtoLRGB(LABtoXYZ(lab), clamp); \
    } \
    \
    void main() \
    { \
      if (N==0) { \
        gl_FragColor = texture2D(texture0, coord); \
      } else { \
        vec4 colors[8]; \
        colors[0] = texture2D(texture0, coord); \
        colors[1] = texture2D(texture1, coord); \
        colors[2] = texture2D(texture2, coord); \
        colors[3] = texture2D(texture3, coord); \
        colors[4] = texture2D(texture4, coord); \
        colors[5] = texture2D(texture5, coord); \
        colors[6] = texture2D(texture6, coord); \
        colors[7] = texture2D(texture7, coord); \
        \
        float x = 0.0; \
        float y = 0.0; \
        float z = 0.0; \
        \
        float Nf = 0.0; \
        float Npf = 0.0; \
        bool inshape = false; \
        \
        for (int i = 0; i < 8; i++) { \
          if (i >= N) break; \
          \
          vec3 lab = RGBtoLAB(colors[i].xyz); \
          if (!inshape) { \
            if (colors[i].w >= 1.0) { \
              inshape = true; \
              x = lab.x * colors[i].w; \
              y = lab.y * colors[i].w; \
              z = lab.z * colors[i].w; \
              Nf = colors[i].w; \
              Npf = min(1.0, colors[i].w); \
            } else { \
              x += lab.x * colors[i].w; \
              y += lab.y * colors[i].w; \
              z += lab.z * colors[i].w; \
              Nf += colors[i].w; \
              Npf += min(1.0, colors[i].w); \
            } \
          } else { \
            if(colors[i].w >= 1.0) { \
            x += lab.x * colors[i].w; \
            y += lab.y * colors[i].w; \
            z += lab.z * colors[i].w; \
            Nf += colors[i].w; \
            Npf += min(1.0, colors[i].w); \
          } \
        } \
      } \
      float pf = max(Npf-1.0, 0.0); \
      float Cdec = pow(cf, pf); \
      float Ldec = pow(lf, pf); \
      if (Nf > float(N)) { \
        Cdec = 1.0; \
        Ldec = 1.0; \
      } \
      if (Nf <= 0.0) { \
        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.0); \
      } else { \
        vec3 newLab = vec3(x/Nf, y/Nf, z/Nf); \
        vec3 newLch = LABtoLCH(newLab); \
        newLch.y = newLch.y * Cdec; \
        newLch.x = newLch.x * Ldec; \
        \
        vec3 ret = LABtoRGB(LCHtoLAB(newLch), true); \
        gl_FragColor = vec4(ret.x,ret.y,ret.z,min(1.0, Nf)); \
      } \
    } \
  }",

  spFMaxTexture: " \
    precision highp float; \
    uniform sampler2D max1; \
    uniform sampler2D max2; \
    varying vec2 coord; \
    \
    void main() { \
      float maxVal = max(texture2D(max1, coord).r, texture2D(max2, coord).r); \
      gl_FragColor = vec4(maxVal, 0.0, 0.0, 1.0); \
    }"
}
