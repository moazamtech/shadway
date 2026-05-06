"use client";

import { useEffect, useRef } from "react";

/**
 * Iridescent black-oil shader.
 *
 * A real-time 2D fluid simulation (Stable Fluids style) rendered as
 * an iridescent oil surface. The pointer is "the stick": dragging it
 * splats velocity + dye into the field, with force scaling
 * quadratically against pointer speed — fast moves carve deep,
 * slow moves whisper.
 *
 *  Pipeline per frame:
 *   1. Splat   (inject velocity + dye along the pointer segment)
 *   2. Curl + Vorticity confinement (preserve swirl)
 *   3. Advect velocity (semi-Lagrangian)
 *   4. Divergence
 *   5. Pressure (Jacobi, ~24 iters)
 *   6. Gradient subtract (project to divergence-free)
 *   7. Advect dye + decay
 *   8. Render (normals, Fresnel, thin-film interference, GGX spec)
 */
export default function OilShader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      // Graceful fallback: just show a dark gradient.
      canvas.style.background =
        "radial-gradient(ellipse at center, #0a0a0f 0%, #000 70%)";
      return;
    }

    // Float textures are required for the sim.
    const floatExt = gl.getExtension("EXT_color_buffer_float");
    const linearFloat = gl.getExtension("OES_texture_float_linear");
    if (!floatExt) {
      canvas.style.background =
        "radial-gradient(ellipse at center, #0a0a0f 0%, #000 70%)";
      return;
    }

    // ---------- Shaders ----------

    const baseVert = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 a_pos;
    out vec2 v_uv;
    out vec2 v_l;
    out vec2 v_r;
    out vec2 v_t;
    out vec2 v_b;
    uniform vec2 u_texel;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      v_l = v_uv - vec2(u_texel.x, 0.0);
      v_r = v_uv + vec2(u_texel.x, 0.0);
      v_t = v_uv + vec2(0.0, u_texel.y);
      v_b = v_uv - vec2(0.0, u_texel.y);
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

    const copyFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_tex;
    out vec4 o;
    void main() { o = texture(u_tex, v_uv); }`;

    const clearFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_value;
    out vec4 o;
    void main() { o = u_value * texture(u_tex, v_uv); }`;

    const splatFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_target;
    uniform float u_aspect;
    uniform vec4 u_color;          // amount injected per channel
    uniform vec2 u_point;          // current point [0..1]
    uniform vec2 u_prev;           // previous point [0..1]
    uniform float u_radius;
    uniform float u_segment;       // 1.0 if drawing a segment
    out vec4 o;

    // Distance from uv to segment prev->point in aspect-corrected space.
    float sdSeg(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      return length(pa - ba * h);
    }

    void main() {
      vec2 p = v_uv;
      p.x *= u_aspect;
      vec2 a = u_prev;  a.x *= u_aspect;
      vec2 b = u_point; b.x *= u_aspect;
      float d = mix(length(p - b), sdSeg(p, a, b), u_segment);
      // Soft falloff — gaussian-ish.
      float s = exp(-d * d / max(u_radius, 1e-5));
      vec4 base = texture(u_target, v_uv);
      o = base + s * u_color;
    }`;

    const advectFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_velocity;
    uniform sampler2D u_source;
    uniform vec2 u_texel;          // source texel
    uniform vec2 u_velTexel;       // velocity texel
    uniform float u_dt;
    uniform float u_dissipation;
    out vec4 o;

    // Bicubic-ish 4-tap bilinear (MacCormack-lite would be better, but
    // good bilinear + low dissipation already looks gorgeous).
    vec4 sampleBi(sampler2D tex, vec2 uv) {
      return texture(tex, uv);
    }

    void main() {
      vec2 vel = texture(u_velocity, v_uv).xy;
      vec2 coord = v_uv - u_dt * vel * u_velTexel;
      vec4 result = sampleBi(u_source, coord);
      float decay = 1.0 + u_dissipation * u_dt;
      o = result / decay;
    }`;

    const divergenceFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    in vec2 v_l;
    in vec2 v_r;
    in vec2 v_t;
    in vec2 v_b;
    uniform sampler2D u_velocity;
    out vec4 o;
    void main() {
      float L = texture(u_velocity, v_l).x;
      float R = texture(u_velocity, v_r).x;
      float T = texture(u_velocity, v_t).y;
      float B = texture(u_velocity, v_b).y;
      // Reflective boundary: if sample is out of bounds, mirror velocity.
      vec2 c = texture(u_velocity, v_uv).xy;
      if (v_l.x < 0.0)  L = -c.x;
      if (v_r.x > 1.0)  R = -c.x;
      if (v_t.y > 1.0)  T = -c.y;
      if (v_b.y < 0.0)  B = -c.y;
      float div = 0.5 * (R - L + T - B);
      o = vec4(div, 0.0, 0.0, 1.0);
    }`;

    const curlFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    in vec2 v_l;
    in vec2 v_r;
    in vec2 v_t;
    in vec2 v_b;
    uniform sampler2D u_velocity;
    out vec4 o;
    void main() {
      float L = texture(u_velocity, v_l).y;
      float R = texture(u_velocity, v_r).y;
      float T = texture(u_velocity, v_t).x;
      float B = texture(u_velocity, v_b).x;
      float c = R - L - T + B;
      o = vec4(0.5 * c, 0.0, 0.0, 1.0);
    }`;

    const vorticityFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    in vec2 v_l;
    in vec2 v_r;
    in vec2 v_t;
    in vec2 v_b;
    uniform sampler2D u_velocity;
    uniform sampler2D u_curl;
    uniform float u_curlStrength;
    uniform float u_dt;
    out vec4 o;
    void main() {
      float L = texture(u_curl, v_l).x;
      float R = texture(u_curl, v_r).x;
      float T = texture(u_curl, v_t).x;
      float B = texture(u_curl, v_b).x;
      float C = texture(u_curl, v_uv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= max(length(force), 1e-4);
      force *= u_curlStrength * C;
      force.y *= -1.0;
      vec2 vel = texture(u_velocity, v_uv).xy;
      vel += force * u_dt;
      vel = clamp(vel, vec2(-1000.0), vec2(1000.0));
      o = vec4(vel, 0.0, 1.0);
    }`;

    const pressureFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    in vec2 v_l;
    in vec2 v_r;
    in vec2 v_t;
    in vec2 v_b;
    uniform sampler2D u_pressure;
    uniform sampler2D u_divergence;
    out vec4 o;
    void main() {
      float L = texture(u_pressure, v_l).x;
      float R = texture(u_pressure, v_r).x;
      float T = texture(u_pressure, v_t).x;
      float B = texture(u_pressure, v_b).x;
      float D = texture(u_divergence, v_uv).x;
      float p = (L + R + T + B - D) * 0.25;
      o = vec4(p, 0.0, 0.0, 1.0);
    }`;

    const gradientFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    in vec2 v_l;
    in vec2 v_r;
    in vec2 v_t;
    in vec2 v_b;
    uniform sampler2D u_pressure;
    uniform sampler2D u_velocity;
    out vec4 o;
    void main() {
      float L = texture(u_pressure, v_l).x;
      float R = texture(u_pressure, v_r).x;
      float T = texture(u_pressure, v_t).x;
      float B = texture(u_pressure, v_b).x;
      vec2 v = texture(u_velocity, v_uv).xy;
      v -= vec2(R - L, T - B);
      o = vec4(v, 0.0, 1.0);
    }`;

    // The big one: render the dye+velocity field as iridescent oil.
    const renderFrag = /* glsl */ `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_dye;
    uniform sampler2D u_velocity;
    uniform vec2 u_resolution;
    uniform vec2 u_dyeTexel;
    uniform float u_time;

    out vec4 fragColor;

    // ---- helpers ----
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    // Cheap value noise.
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    // Thin-film interference approximation.
    // Maps an optical path length (in nanometers) to an RGB color
    // by integrating against rough CIE-ish primaries — close enough
    // for a soap-bubble look.
    vec3 thinFilm(float opd) {
      // Each channel is a cosine peaked at a wavelength, squared for
      // intensity. This approximates the iridescent rainbow you see
      // on oil and bubbles.
      const float PI = 3.14159265;
      float r = cos(2.0 * PI * opd / 650.0);
      float g = cos(2.0 * PI * opd / 550.0);
      float b = cos(2.0 * PI * opd / 450.0);
      vec3 c = vec3(r, g, b);
      return c * c; // [0..1] intensity, peaks shifted by wavelength
    }

    // ACES filmic tonemap (Narkowicz fit).
    vec3 aces(vec3 x) {
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    // Schlick Fresnel.
    float fresnel(float cosTheta, float F0) {
      float m = clamp(1.0 - cosTheta, 0.0, 1.0);
      return F0 + (1.0 - F0) * pow(m, 5.0);
    }

    // GGX specular distribution.
    float ggx(float NdotH, float roughness) {
      float a = roughness * roughness;
      float a2 = a * a;
      float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
      return a2 / (3.14159265 * d * d);
    }

    void main() {
      vec2 uv = v_uv;

      // Sample dye with a 4-tap cross to derive normals from the
      // height field implied by dye thickness.
      vec2 e = u_dyeTexel;
      float hC = clamp(texture(u_dye, uv).a, 0.0, 1.5);
      float hL = clamp(texture(u_dye, uv - vec2(e.x, 0.0)).a, 0.0, 1.5);
      float hR = clamp(texture(u_dye, uv + vec2(e.x, 0.0)).a, 0.0, 1.5);
      float hT = clamp(texture(u_dye, uv + vec2(0.0, e.y)).a, 0.0, 1.5);
      float hB = clamp(texture(u_dye, uv - vec2(0.0, e.y)).a, 0.0, 1.5);

      // Surface normal in tangent space. Bigger height -> taller bump.
      // The 60.0 is a heightScale that controls how "pronounced" the
      // ripples feel.
      float heightScale = 60.0;
      vec3 n = normalize(vec3(
        (hL - hR) * heightScale,
        (hB - hT) * heightScale,
        1.0
      ));

      // View direction: looking straight at the screen.
      vec3 V = vec3(0.0, 0.0, 1.0);
      // Two key lights, one warm-ish rim, one cool top.
      vec3 L1 = normalize(vec3(0.45, 0.55, 0.85));
      vec3 L2 = normalize(vec3(-0.6, -0.3, 0.7));

      float NdotV = clamp(dot(n, V), 0.0, 1.0);

      // GGX specular for both lights.
      vec3 H1 = normalize(L1 + V);
      vec3 H2 = normalize(L2 + V);
      float spec1 = ggx(clamp(dot(n, H1), 0.0, 1.0), 0.18);
      float spec2 = ggx(clamp(dot(n, H2), 0.0, 1.0), 0.32);

      // Fake env reflection: an almost-black cool gradient. We deliberately
      // keep this near-zero so undisturbed surface reads as true black.
      vec3 R = reflect(-V, n);
      vec2 envUV = uv + R.xy * 0.08;
      float envY = clamp(envUV.y, 0.0, 1.0);
      vec3 envCool = vec3(0.002, 0.004, 0.007);
      vec3 envWarm = vec3(0.008, 0.007, 0.005);
      vec3 env = mix(envCool, envWarm, smoothstep(0.0, 1.0, envY));

      // Fresnel: at glancing angles we see more reflection + iridescence.
      float F = fresnel(NdotV, 0.012);

      // Thin-film: optical path depends on local "thickness" (dye) and
      // viewing angle (Fresnel cos). No baseline thickness — flat oil
      // stays jet black, only disturbed regions shimmer.
      float thickness = 1800.0 * hC;
      thickness += 12.0 * vnoise(uv * 6.0 + u_time * 0.05) * hC;
      // The angle modulates effective path length — classic thin-film.
      float opd = thickness * (2.0 * NdotV);
      vec3 iri = thinFilm(opd);
      // Iridescence only blooms where dye exists.
      float iriMask = smoothstep(0.02, 0.35, hC);

      // Velocity-driven subtle flow streaks (anisotropic sheen).
      vec2 vel = texture(u_velocity, uv).xy;
      float speed = length(vel);
      vec2 vdir = speed > 1e-4 ? vel / speed : vec2(0.0, 1.0);
      float aniso = abs(dot(n.xy, vec2(-vdir.y, vdir.x)));
      float streak = pow(aniso, 6.0) * smoothstep(0.0, 8.0, speed);

      // Base color: near-pure black with the faintest cool tint.
      vec3 base = vec3(0.0008, 0.0012, 0.0020);

      // Compose:
      //  - base oil (dominant)
      //  - reflected env, very subtle, only at glancing angles
      //  - iridescent rainbow, gated by dye thickness so undisturbed
      //    areas stay pure black
      //  - sharp specular highlights gated by dye so flat regions
      //    don't catch any highlight
      //  - flow streak sheen
      vec3 col = base;
      col = mix(col, env, F * 0.30);
      col += iri * iriMask * (0.45 + 0.55 * F) * 0.85;
      col += vec3(1.1, 1.05, 0.95) * spec1 * (0.5 + 0.5 * F) * iriMask;
      col += vec3(0.85, 0.9, 1.05) * spec2 * (0.35 + 0.45 * F) * iriMask;
      col += streak * vec3(0.7, 0.65, 0.55) * 0.18 * iriMask;

      // Stronger vignette pulls the edges into deep black.
      vec2 q = uv - 0.5;
      float vig = smoothstep(0.85, 0.15, length(q));
      col *= mix(0.45, 1.0, vig);

      // Mild chromatic aberration in fast-moving regions.
      float ca = clamp(speed * 0.0015, 0.0, 0.004);
      if (ca > 0.0001) {
        float rC = texture(u_dye, uv + vec2(ca, 0.0)).a;
        float bC = texture(u_dye, uv - vec2(ca, 0.0)).a;
        col.r += (rC - hC) * 0.10;
        col.b += (bC - hC) * 0.10;
      }

      // Tonemap + gamma + grain. Lowered exposure plus a slight black
      // crush keeps the resting surface pitch black while preserving
      // highlights inside the iridescent trails.
      col = aces(col * 0.85);
      col = pow(col, vec3(1.0 / 2.2));
      // Lift the black point: anything below ~0.01 gets crushed to 0.
      col = max(col - vec3(0.008), vec3(0.0));
      float grain = (hash21(gl_FragCoord.xy + fract(u_time) * 17.31) - 0.5) * 0.012;
      col += grain;

      fragColor = vec4(col, 1.0);
    }`;

    // ---------- GL helpers ----------

    function compile(src: string, type: number) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.error(
          "[v0] shader compile error:",
          gl!.getShaderInfoLog(sh),
          src,
        );
      }
      return sh;
    }

    function program(vsSrc: string, fsSrc: string) {
      const vs = compile(vsSrc, gl!.VERTEX_SHADER);
      const fs = compile(fsSrc, gl!.FRAGMENT_SHADER);
      const p = gl!.createProgram()!;
      gl!.attachShader(p, vs);
      gl!.attachShader(p, fs);
      gl!.bindAttribLocation(p, 0, "a_pos");
      gl!.linkProgram(p);
      if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
        console.error("[v0] program link error:", gl!.getProgramInfoLog(p));
      }
      // Cache uniform locations.
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      const n = gl!.getProgramParameter(p, gl!.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const info = gl!.getActiveUniform(p, i);
        if (!info) continue;
        uniforms[info.name] = gl!.getUniformLocation(p, info.name);
      }
      return { p, u: uniforms };
    }

    // Fullscreen triangle.
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const progs = {
      copy: program(baseVert, copyFrag),
      clear: program(baseVert, clearFrag),
      splat: program(baseVert, splatFrag),
      advect: program(baseVert, advectFrag),
      divergence: program(baseVert, divergenceFrag),
      curl: program(baseVert, curlFrag),
      vorticity: program(baseVert, vorticityFrag),
      pressure: program(baseVert, pressureFrag),
      gradient: program(baseVert, gradientFrag),
      render: program(baseVert, renderFrag),
    };

    type FBO = {
      tex: WebGLTexture;
      fbo: WebGLFramebuffer;
      w: number;
      h: number;
      texelX: number;
      texelY: number;
      attach: (id: number) => number;
    };

    function createFBO(
      w: number,
      h: number,
      internal: number,
      format: number,
      type: number,
      filter: number,
    ): FBO {
      const tex = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);

      const fbo = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
      gl!.framebufferTexture2D(
        gl!.FRAMEBUFFER,
        gl!.COLOR_ATTACHMENT0,
        gl!.TEXTURE_2D,
        tex,
        0,
      );
      gl!.viewport(0, 0, w, h);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      return {
        tex,
        fbo,
        w,
        h,
        texelX: 1 / w,
        texelY: 1 / h,
        attach(id: number) {
          gl!.activeTexture(gl!.TEXTURE0 + id);
          gl!.bindTexture(gl!.TEXTURE_2D, tex);
          return id;
        },
      };
    }

    type DoubleFBO = {
      readonly read: FBO;
      readonly write: FBO;
      swap: () => void;
      w: number;
      h: number;
      texelX: number;
      texelY: number;
    };

    function createDouble(
      w: number,
      h: number,
      internal: number,
      format: number,
      type: number,
      filter: number,
    ): DoubleFBO {
      let a = createFBO(w, h, internal, format, type, filter);
      let b = createFBO(w, h, internal, format, type, filter);
      return {
        get read() {
          return a;
        },
        get write() {
          return b;
        },
        swap() {
          const t = a;
          a = b;
          b = t;
        },
        w,
        h,
        texelX: 1 / w,
        texelY: 1 / h,
      };
    }

    // ---------- Sizes / FBOs ----------

    const SIM_RES = 256; // half-res-ish sim
    const DYE_RES = 1024;

    let velocity!: DoubleFBO;
    let dye!: DoubleFBO;
    let pressure!: DoubleFBO;
    let divergenceFbo!: FBO;
    let curlFbo!: FBO;

    function getRes(target: number, w: number, h: number) {
      const ar = w / h;
      if (ar > 1) return { w: Math.round(target * ar), h: target };
      return { w: target, h: Math.round(target / ar) };
    }

    let dprWidth = 0;
    let dprHeight = 0;

    function initFBOs() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprWidth = Math.max(1, Math.floor(rect.width * dpr));
      dprHeight = Math.max(1, Math.floor(rect.height * dpr));
      canvas!.width = dprWidth;
      canvas!.height = dprHeight;

      const sim = getRes(SIM_RES, dprWidth, dprHeight);
      const dyeR = getRes(DYE_RES, dprWidth, dprHeight);

      const filter = linearFloat ? gl!.LINEAR : gl!.NEAREST;
      // velocity: RG16F
      velocity = createDouble(
        sim.w,
        sim.h,
        gl!.RG16F,
        gl!.RG,
        gl!.HALF_FLOAT,
        filter,
      );
      // dye: RGBA16F (we use .a as height; .rgb optional flow color)
      dye = createDouble(
        dyeR.w,
        dyeR.h,
        gl!.RGBA16F,
        gl!.RGBA,
        gl!.HALF_FLOAT,
        filter,
      );
      // pressure / divergence / curl: R16F
      pressure = createDouble(
        sim.w,
        sim.h,
        gl!.R16F,
        gl!.RED,
        gl!.HALF_FLOAT,
        gl!.NEAREST,
      );
      divergenceFbo = createFBO(
        sim.w,
        sim.h,
        gl!.R16F,
        gl!.RED,
        gl!.HALF_FLOAT,
        gl!.NEAREST,
      );
      curlFbo = createFBO(
        sim.w,
        sim.h,
        gl!.R16F,
        gl!.RED,
        gl!.HALF_FLOAT,
        gl!.NEAREST,
      );
    }

    initFBOs();

    function blit(target: FBO | null) {
      if (target) {
        gl!.viewport(0, 0, target.w, target.h);
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo);
      } else {
        gl!.viewport(0, 0, dprWidth, dprHeight);
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      }
      gl!.bindVertexArray(vao);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    // ---------- Pointer ----------

    type Pointer = {
      x: number;
      y: number;
      px: number;
      py: number;
      dx: number;
      dy: number;
      down: boolean;
      moved: boolean;
      speed: number;
      smoothSpeed: number;
    };

    const pointer: Pointer = {
      x: 0.5,
      y: 0.5,
      px: 0.5,
      py: 0.5,
      dx: 0,
      dy: 0,
      down: false,
      moved: false,
      speed: 0,
      smoothSpeed: 0,
    };

    function updatePointer(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = 1.0 - (clientY - rect.top) / rect.height;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = nx;
      pointer.y = ny;
      pointer.dx = nx - pointer.px;
      pointer.dy = ny - pointer.py;
      pointer.speed = Math.sqrt(
        pointer.dx * pointer.dx + pointer.dy * pointer.dy,
      );
      pointer.moved = true;
    }

    const onMove = (e: PointerEvent) => {
      updatePointer(e.clientX, e.clientY);
    };
    const onDown = (e: PointerEvent) => {
      pointer.down = true;
      // Reset prev so a tap doesn't yank velocity from across the screen.
      const rect = canvas!.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) / rect.width;
      pointer.y = 1.0 - (e.clientY - rect.top) / rect.height;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
    };
    const onUp = () => {
      pointer.down = false;
    };

    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    // Resize.
    const ro = new ResizeObserver(() => {
      initFBOs();
    });
    ro.observe(canvas);

    // Pause when hidden.
    let visible = !document.hidden;
    const onVis = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    // ---------- Splat ----------

    function splat(
      target: DoubleFBO,
      x: number,
      y: number,
      px: number,
      py: number,
      color: [number, number, number, number],
      radius: number,
      asSegment: boolean,
    ) {
      const { p, u } = progs.splat;
      gl!.useProgram(p);
      gl!.uniform1i(u["u_target"]!, target.read.attach(0));
      gl!.uniform1f(u["u_aspect"]!, target.w / target.h);
      gl!.uniform2f(u["u_point"]!, x, y);
      gl!.uniform2f(u["u_prev"]!, px, py);
      gl!.uniform4f(u["u_color"]!, color[0], color[1], color[2], color[3]);
      gl!.uniform1f(u["u_radius"]!, radius);
      gl!.uniform1f(u["u_segment"]!, asSegment ? 1.0 : 0.0);
      blit(target.write);
      target.swap();
    }

    function applyPointerSplats() {
      const dx = pointer.dx;
      const dy = pointer.dy;
      const dlen = Math.hypot(dx, dy);
      if (dlen < 1e-5) return;

      // Smoothed speed for stable force scaling.
      pointer.smoothSpeed = pointer.smoothSpeed * 0.7 + dlen * 0.3;
      const s = pointer.smoothSpeed;

      // Super-linear response: slow = whisper, fast = furrow.
      // velocity injection (units: pixels/s in sim space)
      const speedBoost = 1.0 + Math.min(s * 140.0, 22.0);
      const splatVx = dx * 4500.0 * speedBoost;
      const splatVy = dy * 4500.0 * speedBoost;

      // Dye thickness injection (clamped so iridescence doesn't go nuclear).
      const dyeAmount = Math.min(0.18 + s * 8.0, 1.4);

      // Splat radius also grows a touch with speed.
      const baseR = 0.00026;
      const radius = baseR * (1.0 + Math.min(s * 18.0, 3.5));

      // Velocity splat — segment avoids gaps on fast moves.
      splat(
        velocity,
        pointer.x,
        pointer.y,
        pointer.px,
        pointer.py,
        [splatVx, splatVy, 0, 0],
        radius,
        true,
      );

      // Dye splat: alpha carries the height field, rgb a faint tint
      // so subsurface adds variation to env reflection.
      splat(
        dye,
        pointer.x,
        pointer.y,
        pointer.px,
        pointer.py,
        [dyeAmount * 0.06, dyeAmount * 0.07, dyeAmount * 0.08, dyeAmount],
        radius * 1.15,
        true,
      );

      // Reset prev to current so next frame without movement
      // doesn't keep injecting velocity.
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.dx = 0;
      pointer.dy = 0;
      pointer.speed = 0;
    }

    // Idle drift: gentle ambient swirl before user interacts, so the
    // surface is alive on first paint.
    let idleT = 0;
    function idleDrift(dt: number) {
      idleT += dt;
      if (pointer.moved) return;
      const cx = 0.5 + 0.22 * Math.sin(idleT * 0.31);
      const cy = 0.5 + 0.22 * Math.cos(idleT * 0.24);
      const px = 0.5 + 0.22 * Math.sin((idleT - dt) * 0.31);
      const py = 0.5 + 0.22 * Math.cos((idleT - dt) * 0.24);
      const dx = cx - px;
      const dy = cy - py;
      splat(
        velocity,
        cx,
        cy,
        px,
        py,
        [dx * 2200, dy * 2200, 0, 0],
        0.0004,
        true,
      );
      splat(dye, cx, cy, px, py, [0.004, 0.005, 0.006, 0.08], 0.0005, true);
    }

    // ---------- Main loop ----------

    let last = performance.now();
    let raf = 0;
    let startTime = performance.now();

    // Sim params.
    const VELOCITY_DISSIPATION = 0.6; // viscosity feel
    const DYE_DISSIPATION = 1.2; // how fast ripples settle
    const PRESSURE_ITERATIONS = 24;
    const CURL_STRENGTH = 22.0;

    function step(dt: number) {
      // 1) Curl
      {
        const { p, u } = progs.curl;
        gl!.useProgram(p);
        gl!.uniform2f(u["u_texel"]!, velocity.texelX, velocity.texelY);
        gl!.uniform1i(u["u_velocity"]!, velocity.read.attach(0));
        blit(curlFbo);
      }

      // 2) Vorticity
      {
        const { p, u } = progs.vorticity;
        gl!.useProgram(p);
        gl!.uniform2f(u["u_texel"]!, velocity.texelX, velocity.texelY);
        gl!.uniform1i(u["u_velocity"]!, velocity.read.attach(0));
        gl!.uniform1i(u["u_curl"]!, curlFbo.attach(1));
        gl!.uniform1f(u["u_curlStrength"]!, CURL_STRENGTH);
        gl!.uniform1f(u["u_dt"]!, dt);
        blit(velocity.write);
        velocity.swap();
      }

      // 3) Divergence
      {
        const { p, u } = progs.divergence;
        gl!.useProgram(p);
        gl!.uniform2f(u["u_texel"]!, velocity.texelX, velocity.texelY);
        gl!.uniform1i(u["u_velocity"]!, velocity.read.attach(0));
        blit(divergenceFbo);
      }

      // 4) Decay pressure a touch (helps numerical stability).
      {
        const { p, u } = progs.clear;
        gl!.useProgram(p);
        gl!.uniform1i(u["u_tex"]!, pressure.read.attach(0));
        gl!.uniform1f(u["u_value"]!, 0.8);
        blit(pressure.write);
        pressure.swap();
      }

      // 5) Pressure (Jacobi)
      {
        const { p, u } = progs.pressure;
        gl!.useProgram(p);
        gl!.uniform2f(u["u_texel"]!, pressure.texelX, pressure.texelY);
        for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
          gl!.uniform1i(u["u_pressure"]!, pressure.read.attach(0));
          gl!.uniform1i(u["u_divergence"]!, divergenceFbo.attach(1));
          blit(pressure.write);
          pressure.swap();
        }
      }

      // 6) Gradient subtract
      {
        const { p, u } = progs.gradient;
        gl!.useProgram(p);
        gl!.uniform2f(u["u_texel"]!, velocity.texelX, velocity.texelY);
        gl!.uniform1i(u["u_pressure"]!, pressure.read.attach(0));
        gl!.uniform1i(u["u_velocity"]!, velocity.read.attach(1));
        blit(velocity.write);
        velocity.swap();
      }

      // 7) Advect velocity
      {
        const { p, u } = progs.advect;
        gl!.useProgram(p);
        gl!.uniform2f(u["u_texel"]!, velocity.texelX, velocity.texelY);
        gl!.uniform2f(u["u_velTexel"]!, velocity.texelX, velocity.texelY);
        gl!.uniform1i(u["u_velocity"]!, velocity.read.attach(0));
        gl!.uniform1i(u["u_source"]!, velocity.read.attach(0));
        gl!.uniform1f(u["u_dt"]!, dt);
        gl!.uniform1f(u["u_dissipation"]!, VELOCITY_DISSIPATION);
        blit(velocity.write);
        velocity.swap();
      }

      // 8) Advect dye
      {
        const { p, u } = progs.advect;
        gl!.useProgram(p);
        gl!.uniform2f(u["u_texel"]!, dye.texelX, dye.texelY);
        gl!.uniform2f(u["u_velTexel"]!, velocity.texelX, velocity.texelY);
        gl!.uniform1i(u["u_velocity"]!, velocity.read.attach(0));
        gl!.uniform1i(u["u_source"]!, dye.read.attach(1));
        gl!.uniform1f(u["u_dt"]!, dt);
        gl!.uniform1f(u["u_dissipation"]!, DYE_DISSIPATION);
        blit(dye.write);
        dye.swap();
      }
    }

    function render() {
      const { p, u } = progs.render;
      gl!.useProgram(p);
      gl!.uniform1i(u["u_dye"]!, dye.read.attach(0));
      gl!.uniform1i(u["u_velocity"]!, velocity.read.attach(1));
      gl!.uniform2f(u["u_resolution"]!, dprWidth, dprHeight);
      gl!.uniform2f(u["u_dyeTexel"]!, dye.texelX, dye.texelY);
      gl!.uniform1f(u["u_time"]!, (performance.now() - startTime) / 1000);
      blit(null);
    }

    function frame() {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05; // clamp big spikes (tab-switch, etc.)

      if (visible) {
        idleDrift(dt);
        applyPointerSplats();
        step(dt);
        render();
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // ---------- Cleanup ----------
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("visibilitychange", onVis);

      // Best-effort GL resource cleanup.
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full touch-none select-none"
      style={{ cursor: "crosshair" }}
      aria-label="Interactive iridescent oil shader. Drag your cursor to disturb the surface."
    />
  );
}
