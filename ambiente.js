/* =========================================================
   ambiente.js · fumaça de fundo do mapa 2.5D (Planta da Caixa)
   Usa o Flue (ProfitizeBuild), em WebGL2 puro: um triângulo de tela cheia e um fragment shader, sem bibliotecas.
   Aqui só há duas mudanças em relação ao original: a versão em JavaScript (sem as anotações de tipo) e as cores por
   andar (só valores do CONFIG, como o próprio Flue manda). O shader e as contas ficam como vieram.

   Como funciona no site:
   - O canvas vai atrás do mapa (o .viewport passa a ser transparente quando a fumaça está ligada).
   - Só liga na qualidade Alta (computador). Média e Leve ficam com o fundo liso de antes, sem custo nenhum.
   - Desliga sozinho quando o 3D ou as fichas estão abertos (o mapa fica coberto: não faz sentido gastar a placa).
   - Cada andar tem a sua cor: 1 a 4 em ferrugem e cinza de fábrica velha; o 5º em vermelho.
   - Com "reduzir movimento" no sistema, fica um quadro parado.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Flue (original, em JS) ---------- */
  const CONFIG = {
    bgColor: '#1d0f0c', colorA: '#6d2e26', colorB: '#c33e38', colorC: '#d78c8f', colorD: '#f1dcde',
    scale: 0.2, speed: 0.33, flow: 0.02, roughness: 0.47, lacunarity: 2.75, smokeScale: 3.06, curl: 0.57,
    curlScale: 1.46, rise: 0.05, slender: 1.57, width: 1.21, spread: 1.89, lean: 1.16, density: 1.4,
    contrast: 1.85, midpoint: 0.69, glow: 0.48, sink: 0.42, grain: 0, grainAnim: 0, dither: 0.43, vignette: 0.15,
    cursor: 1, pointerRadius: 0.38, draft: 4.5, pointerStrength: 0.73, parallax: 0.007, maxDpr: 1,
  };

  const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;
uniform vec2  iMouseVel;
uniform vec2  iMouseWake;

uniform vec3  uBgColor, uColorA, uColorB, uColorC, uColorD;
uniform float uScale, uSpeed, uFlow, uRoughness, uLacunarity;
uniform float uSmokeScale, uCurl, uCurlScale, uRise, uSlender;
uniform float uWidth, uSpread, uLean, uDensity;
uniform float uContrast, uMidpoint, uGlow, uSink;
uniform float uGrain, uDither, uVignette;
uniform float uPointerRadius, uDraft, uPointerStrength, uParallax;
#define OCTAVES 3
#define TRAIL_TAPS 6
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float hash1(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float snoise(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    v += amp * snoise(p);
    p *= uLacunarity;
    amp *= uRoughness;
  }
  return v;
}
float trail(vec2 uv, float radius) {
  vec2 wob = vec2(snoise(uv * 1.7 + vec2(0.0, iTime * 0.05)),
                  snoise(uv * 1.7 + vec2(4.3, -iTime * 0.04)));
  uv += wob * radius * 0.18;
  float a = 0.0, wsum = 0.0;
  float r2 = max(1e-4, radius * radius);
  for (int i = 0; i < TRAIL_TAPS; i++) {
    float k = float(i) / float(TRAIL_TAPS - 1);
    vec2 c = mix(iMouseWake, iMouse, k);
    vec2 dd = uv - c;
    float w = mix(0.30, 1.0, k);
    a += w * exp(-dot(dd, dd) / r2);
    wsum += w;
  }
  return a / wsum;
}
float potential(vec2 p) {
  return snoise(p) + 0.5 * snoise(p * 2.03 + vec2(3.7, -1.9));
}

vec2 curl(vec2 p, float e) {
  float nx1 = potential(p + vec2(0.0, e));
  float nx2 = potential(p - vec2(0.0, e));
  float ny1 = potential(p + vec2(e, 0.0));
  float ny2 = potential(p - vec2(e, 0.0));
  return vec2(nx1 - nx2, ny2 - ny1) / (2.0 * e);
}

vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.36, t));
  c = mix(c, uColorC, smoothstep(0.32, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.66, 1.00, t));
  return c;
}

float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}

uniform float uGrainAnim;
float houseGrain(vec2 fc) {
  uvec2 q = uvec2(fc) * uvec2(1597334677u, 3812015801u)
          + uint(floor(iTime * 24.0 * uGrainAnim)) * 2654435769u;
  uint n = q.x ^ q.y; n = n * 1664525u + 1013904223u; n ^= n >> 16u; n *= 2246822519u; n ^= n >> 13u;
  float a = float(n & 0xffffu) / 65535.0;
  n *= 3266489917u; n ^= n >> 16u;
  float b = float(n & 0xffffu) / 65535.0;
  return a + b - 1.0;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  float t = iTime * uSpeed;

  float tr = trail(uv, uPointerRadius);

  vec2 p = (uv - iMouse * uParallax) * uScale;

  vec2 sp = p + vec2(0.0, -t * uRise);

  vec2 c = curl(sp * uCurlScale + vec2(0.0, t * uFlow), 0.14) * uCurl;
  c += iMouseVel * uDraft * tr;

  vec2 mp = vec2(sp.x, sp.y * uSlender) * uSmokeScale + c;
  float dens = fbm(mp) * 0.5 + 0.5;

  float h = uv.y + 0.55;
  float lean = iMouse.x * uLean * clamp(h, 0.0, 1.6);
  float width = max(0.06, uWidth * (0.45 + uSpread * clamp(h, 0.0, 1.8)));
  float xr = (uv.x - lean) / width;
  float corridor = exp(-xr * xr);

  float cool = smoothstep(-0.65, 0.85, uv.y);
  float smoke = dens * corridor * mix(1.0, 0.30, cool) * uDensity;

  float f = clamp((smoke - uMidpoint) * uContrast + 0.5 + tr * uPointerStrength * 0.30, 0.0, 1.0);

  vec3 col = ramp4(f);
  col += uColorD * uGlow * pow(f, 4.0);
  col = mix(uBgColor, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);
  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

  const hexToVec3 = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  }

  function mountFlue(host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.style.backgroundColor = CONFIG.bgColor;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let canvas = null, gl = null, program = null, ready = false, lost = false, disposed = false, visible = false, raf = 0;
    let LOC = {};
    const loc = n => (n in LOC ? LOC[n] : (LOC[n] = gl.getUniformLocation(program, n)));
    const u1f = (n, v) => gl.uniform1f(loc(n), v);
    const u2f = (n, x, y) => gl.uniform2f(loc(n), x, y);
    const u3c = (n, hex) => { const c = hexToVec3(hex); gl.uniform3f(loc(n), c[0], c[1], c[2]); };

    const applyConfig = () => {
      for (const [key, value] of Object.entries(CONFIG)) {
        if (key === 'cursor' || key === 'maxDpr') continue;
        const name = 'u' + key[0].toUpperCase() + key.slice(1);
        if (typeof value === 'string') u3c(name, value); else u1f(name, value);
      }
    };

    const resize = () => {
      if (!gl || !canvas || !ready) return;
      const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      u2f('iResolution', w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const mouse = { x: 0, y: 0, ax: 0, ay: 0, wx: 0, wy: 0, tx: 0, ty: 0 };
    let rest = null;
    const aim = e => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * (r.width / r.height);
      mouse.ty = 0.5 - (e.clientY - r.top) / r.height;
    };
    host.addEventListener('pointermove', aim, { passive: true });
    host.addEventListener('pointerdown', aim, { passive: true });

    let prevT = 0, clock = 0;
    const frame = now => {
      raf = requestAnimationFrame(frame);
      const raw = now - prevT;
      prevT = now;
      if (!visible || document.hidden || !gl || !ready) return;
      const ms = raw > 50 ? 50 : raw < 4.167 ? 4.167 : raw;
      const s = ms > 36.7 ? 2.2 : ms * 0.06;
      clock += ms * 0.001;
      const kLead = 0.105 * s, kBody = 0.043 * s, kWake = 0.017 * s;
      mouse.ax += (mouse.tx - mouse.ax) * kLead;
      mouse.ay += (mouse.ty - mouse.ay) * kLead;
      mouse.x += (mouse.ax - mouse.x) * kBody;
      mouse.y += (mouse.ay - mouse.y) * kBody;
      mouse.wx += (mouse.x - mouse.wx) * kWake;
      mouse.wy += (mouse.y - mouse.wy) * kWake;
      u1f('iTime', clock);
      if (rest === null) rest = { x: mouse.tx, y: mouse.ty };
      if (!CONFIG.cursor) { mouse.tx = rest.x; mouse.ty = rest.y; }
      u2f('iMouse', mouse.x, mouse.y);
      u2f('iMouseVel', mouse.ax - mouse.x, mouse.ay - mouse.y);
      u2f('iMouseWake', mouse.wx, mouse.wy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const start = () => {
      if (raf || reduced) return;
      prevT = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const link = (ctx, prog, shaders) => {
      if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
        for (const sh of shaders) if (!ctx.getShaderParameter(sh, ctx.COMPILE_STATUS)) console.error(ctx.getShaderInfoLog(sh));
        console.error(ctx.getProgramInfoLog(prog));
        return;
      }
      ctx.useProgram(prog);
      ctx.bindVertexArray(ctx.createVertexArray());
      program = prog;
      LOC = {};
      applyConfig();
      ready = true;
      resize();
      start();
    };

    const setup = () => {
      const c = document.createElement('canvas');
      c.setAttribute('aria-hidden', 'true');
      c.style.cssText = 'position:absolute;inset:0;z-index:-1;display:block;width:100%;height:100%;pointer-events:none';
      host.prepend(c);
      canvas = c;
      const ctx = c.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
      if (!ctx) { host.classList.add('no-gl'); return; }
      gl = ctx;
      c.addEventListener('webglcontextlost', e => {
        e.preventDefault(); gl = null; ready = false; lost = true;
        if (visible) setTimeout(() => visible && lost && !disposed && rebuild(), 100);
      }, { once: true });
      const prog = ctx.createProgram();
      const shaders = [compile(ctx, ctx.VERTEX_SHADER, VERT), compile(ctx, ctx.FRAGMENT_SHADER, FRAG)];
      for (const sh of shaders) ctx.attachShader(prog, sh);
      ctx.linkProgram(prog);
      const parallel = ctx.getExtension('KHR_parallel_shader_compile');
      const poll = () => {
        if (gl !== ctx || disposed) return;
        if (parallel && !ctx.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) requestAnimationFrame(poll);
        else link(ctx, prog, shaders);
      };
      if (parallel) requestAnimationFrame(poll); else poll();
    };
    const rebuild = () => { lost = false; if (canvas) canvas.remove(); canvas = null; setup(); };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && lost) rebuild(); });
    io.observe(host);
    const near = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; near.disconnect(); setup(); }, { rootMargin: '400px' });
    near.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); near.disconnect(); ro.disconnect();
      host.removeEventListener('pointermove', aim);
      host.removeEventListener('pointerdown', aim);
      if (gl) { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
      if (canvas) canvas.remove();
    };
  }

  /* ---------- Cores por andar (só valores do CONFIG) ----------
     1 a 4: fábrica velha, ferrugem e cinza quente, fumaça rala. 5: o vermelho original, mais denso. */
  const PALETAS = {
    ferrugem: { bgColor: '#0c0a09', colorA: '#2a1d16', colorB: '#5c3b24', colorC: '#a07a50', colorD: '#e0cfb0', density: 0.95, glow: 0.18, vignette: 0.35 },
    vermelho: { bgColor: '#1d0f0c', colorA: '#6d2e26', colorB: '#c33e38', colorC: '#d78c8f', colorD: '#f1dcde', density: 1.15, glow: 0.3, vignette: 0.3 },
  };
  const BASE = Object.assign({}, CONFIG);
  const paletaDoAndar = a => (a >= 5 ? 'vermelho' : 'ferrugem');

  /* ---------- Ligação com o site ---------- */
  const palco = () => document.querySelector('.palco-area');
  const andar = () => { const b = document.querySelector('.andar-btn.atual'); return b ? +b.dataset.andar || 1 : 1; };
  const qual = () => { try { return window.ACF_QUALIDADE ? window.ACF_QUALIDADE.efetiva() : 'leve'; } catch (e) { return 'leve'; } };
  const coberto = () => document.body.classList.contains('s3d-aberta') || document.body.classList.contains('fx-aberta');

  let desmontar = null, paletaAtual = null;
  function ligar() {
    const host = palco();
    if (!host || desmontar) return;
    const p = paletaDoAndar(andar());
    Object.assign(CONFIG, BASE, PALETAS[p]);
    paletaAtual = p;
    host.classList.add('amb-on');
    desmontar = mountFlue(host);
  }
  function desligar() {
    if (!desmontar) return;
    desmontar(); desmontar = null; paletaAtual = null;
    const host = palco();
    if (host) { host.classList.remove('amb-on'); host.style.backgroundColor = ''; host.style.isolation = ''; }
  }
  function conferir() {
    const quer = qual() === 'alta' && !coberto();
    if (quer && !desmontar) ligar();
    else if (!quer && desmontar) desligar();
    else if (quer && desmontar && paletaAtual !== paletaDoAndar(andar())) { desligar(); ligar(); }
  }

  function iniciar() {
    if (!palco()) return;
    const st = document.createElement('style');
    st.textContent = '.palco-area.amb-on .viewport{background:transparent}';
    document.head.appendChild(st);
    new MutationObserver(conferir).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const la = document.getElementById('listaAndares');
    if (la) new MutationObserver(conferir).observe(la, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('acf-perfil', () => setTimeout(conferir, 300));
    setTimeout(conferir, 600);
    setTimeout(conferir, 2500);
  }
  window.ACF_AMBIENTE = { conferir, ligar, desligar, ativo: () => !!desmontar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
