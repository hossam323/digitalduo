import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// One fixed 3D stage for the hero and the customer journey below it. The camera
// follows scroll keyframes taken from [data-cj] elements in the page.
const hero = document.getElementById('heroSplit');
const mount = document.getElementById('stage3d');

const NOISE_GLSL = /* glsl */`
vec3 dd_mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 dd_mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 dd_permute(vec4 x){ return dd_mod289(((x * 34.0) + 1.0) * x); }
vec4 dd_taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float dd_snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = dd_mod289(i);
  vec4 p = dd_permute(dd_permute(dd_permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = dd_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// A physical material whose sphere surface is displaced by animated noise.
// Normals are rebuilt from neighbouring displaced samples so lighting and
// reflections follow the liquid surface instead of the original sphere.
function blobMaterial(params, seed) {
  const mat = new THREE.MeshPhysicalMaterial(params);
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.08 },
    uFreq: { value: 0.85 },
    uSeed: { value: seed },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uAmp;
        uniform float uFreq;
        uniform float uSeed;
        ${NOISE_GLSL}
        float dd_field(vec3 p){
          vec3 q = p * uFreq + vec3(uSeed, uSeed * 0.61, uTime * 0.32);
          return dd_snoise(q) * 0.85 + dd_snoise(q * 1.9 + uTime * 0.15) * 0.15;
        }
        vec3 dd_displace(vec3 p){ return p + normalize(p) * dd_field(p) * uAmp; }
      `)
      .replace('#include <beginnormal_vertex>', `
        vec3 dd_n = normalize(normal);
        vec3 dd_t = normalize(cross(dd_n, abs(dd_n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 dd_b = normalize(cross(dd_n, dd_t));
        float dd_e = 0.012;
        vec3 dd_p0 = dd_displace(position);
        vec3 dd_p1 = dd_displace(position + dd_t * dd_e);
        vec3 dd_p2 = dd_displace(position + dd_b * dd_e);
        vec3 objectNormal = normalize(cross(dd_p1 - dd_p0, dd_p2 - dd_p0));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif
      `)
      .replace('#include <begin_vertex>', 'vec3 transformed = dd_p0;');
  };
  return mat;
}

// A dark studio with brand-coloured light panels. The chrome orb reflects
// this, which is what makes it read as polished metal tinted with DigitalDuo red.
function buildStudio() {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x0b0a0a);
  const geo = new THREE.PlaneGeometry(1, 1);
  const panel = (hex, intensity, w, h, x, y, z) => {
    const color = new THREE.Color(hex).multiplyScalar(intensity);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  };
  panel(0xffffff, 4.0, 11, 3.2, 0, 6, 2);
  panel(0xffffff, 2.6, 3, 8, 6, 1, 4);
  panel(0xffffff, 1.4, 2, 2, -3, 4, 5);
  panel(0xe33226, 5.0, 2.2, 9, -6, 0, 1.5);
  panel(0xe33226, 2.4, 12, 1.4, 0, -5.5, -1);
  panel(0xffffff, 0.5, 7, 7, 0, 0, -8);
  return studio;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// ---------- Canvas UI helpers (screens and labels inside the 3D scene) ----------
const FONT = "'Plus Jakarta Sans', Arial, sans-serif";
const RED = '#e33226', WHITE = '#ffffff', MUTED = 'rgba(255,255,255,.55)', FAINT = 'rgba(255,255,255,.14)';
const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const rr = (x, X, Y, W, H, r) => { x.beginPath(); x.roundRect(X, Y, W, H, r); };
const txt = (x, s, X, Y, size, color, weight = 700, align = 'left') => {
  x.font = `${weight} ${size}px ${FONT}`; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic'; x.fillText(s, X, Y);
};
const toTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const smooth = (a, b, v) => { const u = Math.min(1, Math.max(0, (v - a) / (b - a))); return u * u * (3 - 2 * u); };

// Crossfades a "without AI" canvas into a "with AI" canvas. While broken it glitches.
function screenMaterial(painC, fixC) {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: toTex(painC) }, uB: { value: toTex(fixC) }, uFix: { value: 0 }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D uA; uniform sampler2D uB; uniform float uFix; uniform float uTime;
      varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float pain = 1.0 - uFix;
        float band = floor(vUv.y * 22.0);
        float g = step(0.975, h(band + floor(uTime * 6.0) * 7.13)) * pain;
        vec2 uv = vUv; uv.x += (h(band * 1.7 + floor(uTime * 8.0)) - 0.5) * 0.07 * g;
        vec4 a = texture2D(uA, uv);
        a.rgb += vec3(0.12, 0.0, 0.0) * g;
        vec4 b = texture2D(uB, vUv);
        float edge = uFix * 1.25 - 0.12;
        float wipe = smoothstep(edge - 0.12, edge, 1.0 - vUv.y);
        vec4 c = mix(b, a, wipe);
        float line = (1.0 - smoothstep(0.0, 0.02, abs((1.0 - vUv.y) - edge + 0.06))) * step(0.02, uFix) * step(uFix, 0.98);
        c.rgb += vec3(1.0, 0.35, 0.28) * line;
        c.rgb *= mix(0.92 + 0.08 * sin(vUv.y * 900.0), 1.0, uFix);
        gl_FragColor = c;
      }`,
  });
}

// ---------- Station artwork ----------
function contentScreen(fixed) {
  const [c, x] = makeCanvas(520, 1010);
  x.fillStyle = '#0d0c0c'; x.fillRect(0, 0, 520, 1010);
  txt(x, '9:41', 30, 46, 22, MUTED, 600);
  if (fixed) { const g = x.createLinearGradient(26, 80, 98, 152); g.addColorStop(0, RED); g.addColorStop(1, '#ff8a7a'); x.fillStyle = g; } else x.fillStyle = '#2a2727';
  x.beginPath(); x.arc(62, 118, 36, 0, Math.PI * 2); x.fill();
  txt(x, 'yourbrand', 116, 110, 30, WHITE, 800);
  txt(x, fixed ? 'Posted today · 14 scheduled' : 'Last post: 23 days ago', 116, 144, 21, fixed ? 'rgba(255,255,255,.8)' : RED, 700);
  txt(x, fixed ? '186 posts   ·   12.4k followers' : '42 posts   ·   1,203 followers', 30, 198, 20, MUTED, 600);
  const S = 150, G = 10, X0 = 25, Y0 = 222;
  const arts = [
    (X, Y) => { const g = x.createLinearGradient(X, Y, X + S, Y + S); g.addColorStop(0, RED); g.addColorStop(1, '#5a0d08'); x.fillStyle = g; rr(x, X, Y, S, S, 10); x.fill(); txt(x, 'NEW', X + 16, Y + S - 18, 34, WHITE, 800); },
    (X, Y) => { x.fillStyle = '#f4f1ea'; rr(x, X, Y, S, S, 10); x.fill(); x.fillStyle = RED; x.beginPath(); x.arc(X + S / 2, Y + S / 2, 40, 0, Math.PI * 2); x.fill(); },
    (X, Y) => { x.fillStyle = '#1c1a1a'; rr(x, X, Y, S, S, 10); x.fill(); txt(x, '50%', X + S / 2, Y + S / 2 + 8, 40, RED, 800, 'center'); txt(x, 'OFF', X + S / 2, Y + S / 2 + 40, 20, WHITE, 800, 'center'); },
    (X, Y) => { x.fillStyle = RED; rr(x, X, Y, S, S, 10); x.fill(); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 6; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(X + i * 30, Y + 10); x.lineTo(X + i * 30 - 30, Y + S - 10); x.stroke(); } },
    (X, Y) => { const g = x.createRadialGradient(X + S / 2, Y + S / 2, 10, X + S / 2, Y + S / 2, 90); g.addColorStop(0, '#ffd2cc'); g.addColorStop(1, '#2a1110'); x.fillStyle = g; rr(x, X, Y, S, S, 10); x.fill(); },
    (X, Y) => { x.fillStyle = '#f4f1ea'; rr(x, X, Y, S, S, 10); x.fill(); txt(x, 'REEL', X + 16, Y + 40, 24, '#111', 800); x.fillStyle = RED; x.beginPath(); x.moveTo(X + 60, Y + 70); x.lineTo(X + 100, Y + 95); x.lineTo(X + 60, Y + 120); x.fill(); },
  ];
  for (let i = 0; i < 9; i++) {
    const X = X0 + (i % 3) * (S + G), Y = Y0 + Math.floor(i / 3) * (S + G);
    if (fixed) arts[(i * 5) % arts.length](X, Y);
    else if (i < 2) { x.fillStyle = '#211f1f'; rr(x, X, Y, S, S, 10); x.fill(); x.fillStyle = '#333'; x.beginPath(); x.moveTo(X + 20, Y + S - 30); x.lineTo(X + 60, Y + 60); x.lineTo(X + 100, Y + S - 30); x.fill(); }
    else { x.setLineDash([8, 8]); x.strokeStyle = FAINT; x.lineWidth = 2; rr(x, X + 2, Y + 2, S - 4, S - 4, 10); x.stroke(); x.setLineDash([]); txt(x, '+', X + S / 2, Y + S / 2 + 12, 34, FAINT, 400, 'center'); }
  }
  const by = 732;
  x.fillStyle = '#171515'; rr(x, 25, by, 470, 232, 22); x.fill();
  txt(x, 'This month', 50, by + 48, 22, MUTED, 700);
  txt(x, fixed ? '♥ 2.4k' : '♥ 12', 50, by + 118, 54, WHITE, 800);
  txt(x, fixed ? 'Reach ↑ 3.1x' : 'Reach ↓ 64%', 50, by + 176, 26, fixed ? WHITE : RED, 800);
  x.strokeStyle = fixed ? RED : 'rgba(255,255,255,.3)'; x.lineWidth = 6; x.beginPath();
  for (let i = 0; i <= 10; i++) { const X = 300 + i * 17, Y = by + (fixed ? 190 - i * i * 1.3 : 90 + i * 9 + (i % 2) * 10); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }
  x.stroke();
  return c;
}

function webScreen(fixed) {
  const [c, x] = makeCanvas(1024, 646);
  x.fillStyle = fixed ? '#0f0d0d' : '#0d0c0c'; x.fillRect(0, 0, 1024, 646);
  x.fillStyle = '#1b1919'; x.fillRect(0, 0, 1024, 56);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { x.fillStyle = fixed ? col : '#3a3636'; x.beginPath(); x.arc(30 + i * 26, 28, 8, 0, Math.PI * 2); x.fill(); });
  x.fillStyle = '#0d0c0c'; rr(x, 120, 14, 520, 28, 14); x.fill();
  txt(x, 'yourbrand.com', 140, 34, 17, MUTED, 600);
  if (!fixed) {
    x.fillStyle = '#242121'; x.fillRect(60, 96, 700, 70);
    x.fillStyle = '#1d1b1b'; x.fillRect(110, 190, 820, 210);
    x.strokeStyle = '#3a3636'; x.lineWidth = 4; x.strokeRect(150, 222, 150, 130); x.beginPath(); x.moveTo(150, 222); x.lineTo(300, 352); x.moveTo(300, 222); x.lineTo(150, 352); x.stroke();
    x.fillStyle = '#242121'; x.fillRect(340, 230, 380, 26); x.fillRect(340, 274, 300, 20); x.fillRect(360, 312, 340, 20);
    x.strokeStyle = RED; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.arc(512, 476, 30, 0.2, 4.6); x.stroke();
    txt(x, 'Loading… 8.4 s', 512, 548, 30, WHITE, 800, 'center');
    txt(x, 'Bounce rate 78%', 512, 600, 24, RED, 800, 'center');
  } else {
    txt(x, 'YOURBRAND', 60, 108, 22, WHITE, 800);
    ['Menu', 'About', 'Contact'].forEach((s, i) => txt(x, s, 700 + i * 100, 108, 18, MUTED, 700));
    txt(x, 'Book your table', 60, 210, 64, WHITE, 800);
    txt(x, 'in 30 seconds.', 60, 280, 64, RED, 800);
    txt(x, 'Fresh menu every week. Order or book in one tap.', 60, 330, 22, MUTED, 600);
    x.fillStyle = RED; rr(x, 60, 360, 210, 60, 30); x.fill(); txt(x, 'Book now', 165, 399, 24, WHITE, 800, 'center');
    const g = x.createLinearGradient(640, 150, 960, 430); g.addColorStop(0, RED); g.addColorStop(1, '#3d0905');
    x.fillStyle = g; rr(x, 640, 150, 320, 280, 24); x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(800, 290, 70, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 3; i++) { x.fillStyle = '#1b1919'; rr(x, 60 + i * 305, 460, 290, 90, 16); x.fill(); txt(x, ['★ 4.9 rating', 'Same-day delivery', 'Book in 1 tap'][i], 85 + i * 305, 515, 22, WHITE, 700); }
    txt(x, 'Loaded in 0.8 s · Conversions ↑ 2.7x', 512, 610, 24, WHITE, 800, 'center');
  }
  return c;
}

function leadsScreen(fixed) {
  const [c, x] = makeCanvas(640, 794);
  x.fillStyle = '#0d0c0c'; x.fillRect(0, 0, 640, 794);
  txt(x, 'Inbox', 34, 70, 40, WHITE, 800);
  x.fillStyle = fixed ? '#2a2727' : RED; rr(x, 150, 38, fixed ? 54 : 66, 40, 20); x.fill();
  txt(x, fixed ? '0' : '47', fixed ? 177 : 183, 66, 24, WHITE, 800, 'center');
  const rows = [['Sara', 'Hi, is this still available?', '11:42 PM'], ['Omar', 'How much is it?', '12:05 AM'], ['Lina', 'Can I book for Friday?', '1:17 AM'], ['Ahmed', 'Do you deliver to Marina?', '2:30 AM'], ['Maya', 'Hello? Anyone there?', '9:58 AM']];
  rows.forEach(([n, m, tm], i) => {
    const Y = 110 + i * 118;
    x.fillStyle = '#171515'; rr(x, 24, Y, 592, 104, 18); x.fill();
    x.fillStyle = ['#7a2a24', '#3b3535', '#5c1d18', '#2f2b2b', '#4a1712'][i]; x.beginPath(); x.arc(70, Y + 52, 26, 0, Math.PI * 2); x.fill();
    txt(x, n, 112, Y + 40, 24, WHITE, 800);
    txt(x, tm, 590, Y + 40, 18, MUTED, 600, 'right');
    txt(x, m, 112, Y + 74, 21, fixed ? MUTED : 'rgba(255,255,255,.85)', 600);
    if (fixed) txt(x, '✓✓ Replied in 3 s', 590, Y + 88, 18, WHITE, 800, 'right');
    else { x.fillStyle = RED; x.beginPath(); x.arc(584, Y + 74, 9, 0, Math.PI * 2); x.fill(); }
  });
  x.fillStyle = fixed ? '#1d1b1b' : 'rgba(227,50,38,.14)'; rr(x, 24, 714, 592, 60, 16); x.fill();
  txt(x, fixed ? 'Average reply: 3 s · 24/7' : 'Average reply: 14 hrs', 320, 754, 24, fixed ? WHITE : RED, 800, 'center');
  return c;
}

function pillLabel(text, sub, fixed, w = 900) {
  const [c, x] = makeCanvas(w, 220);
  x.fillStyle = fixed ? 'rgba(20,18,18,.88)' : 'rgba(40,10,8,.82)';
  rr(x, 6, 6, w - 12, 208, 104); x.fill();
  x.strokeStyle = fixed ? 'rgba(255,255,255,.25)' : 'rgba(227,50,38,.7)'; x.lineWidth = 4; rr(x, 6, 6, w - 12, 208, 104); x.stroke();
  txt(x, text, w / 2, 112, 62, fixed ? WHITE : RED, 800, 'center');
  txt(x, sub, w / 2, 168, 30, MUTED, 700, 'center');
  return c;
}

function appIcon(name, glyph) {
  const [c, x] = makeCanvas(256, 256);
  x.fillStyle = '#1b1919'; rr(x, 0, 0, 256, 256, 46); x.fill();
  txt(x, glyph, 128, 140, 84, RED, 800, 'center');
  txt(x, name, 128, 214, 32, WHITE, 800, 'center');
  return c;
}

function tileTexture(i, grey) {
  const [c, x] = makeCanvas(128, 128);
  if (grey) { x.fillStyle = '#2a2727'; rr(x, 0, 0, 128, 128, 18); x.fill(); x.fillStyle = '#3a3636'; x.beginPath(); x.moveTo(20, 104); x.lineTo(56, 50); x.lineTo(92, 104); x.fill(); }
  else {
    const g = x.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, i % 2 ? '#f4f1ea' : RED); g.addColorStop(1, i % 2 ? '#ffd9d4' : '#5a0d08');
    x.fillStyle = g; rr(x, 0, 0, 128, 128, 18); x.fill();
    x.fillStyle = i % 2 ? RED : WHITE; x.beginPath(); x.arc(64, 64, 22, 0, Math.PI * 2); x.fill();
  }
  return c;
}

// ---------- Stations ----------
function makeStations(frameMat, rand) {
  const stations = [];
  const device = (w, h, d, r, painC, fixC) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(w + 0.18, h + 0.18, d, 6, r), frameMat));
    const mat = screenMaterial(painC, fixC);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    scr.position.z = d / 2 + 0.005;
    g.add(scr);
    return { g, mat };
  };
  const label = (painC, fixC, w) => {
    const mat = screenMaterial(painC, fixC);
    return { m: new THREE.Mesh(new THREE.PlaneGeometry(w, w * (220 / painC.width)), mat), mat };
  };

  // 01 Content: a phone whose feed has gone quiet; posts fall away, then orbit once AI runs it
  {
    const group = new THREE.Group();
    const phone = device(1.7, 3.3, 0.16, 0.2, contentScreen(false), contentScreen(true));
    phone.g.rotation.y = -0.18;
    group.add(phone.g);
    const greyTex = toTex(tileTexture(0, true));
    const tiles = [...Array(8)].map((_, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: toTex(tileTexture(k, false)), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.userData = { colorMap: m.material.map, x: (rand() - 0.5) * 3.2, z: 0.4 + rand() * 0.8, spin: rand() * 6 };
      group.add(m);
      return m;
    });
    stations.push({ group, update(t, fix) {
      phone.mat.uniforms.uTime.value = t; phone.mat.uniforms.uFix.value = fix;
      phone.g.position.y = Math.sin(t * 0.9) * 0.06;
      tiles.forEach((m, k) => {
        const u = m.userData;
        const ph = (t * 0.11 + k / 8) % 1;
        const py = 2.4 - ph * 5.6, px = u.x + Math.sin(t + k) * 0.2;
        const a = t * 0.45 + (k / 8) * Math.PI * 2;
        const fx = Math.cos(a) * 2.1, fy = 0.4 + Math.sin(a * 2) * 0.25 + Math.sin(a) * 1.3, fz = Math.sin(a) * 0.9 + 0.3;
        m.position.set(px + (fx - px) * fix, py + (fy - py) * fix, u.z + (fz - u.z) * fix);
        m.rotation.set((1 - fix) * (t * 1.3 + u.spin), (1 - fix) * (t + u.spin) - 0.18 * fix, (1 - fix) * u.spin);
        m.material.map = fix > 0.5 ? u.colorMap : greyTex;
        m.material.opacity = fix > 0.5 ? 1 : Math.sin(ph * Math.PI) * 0.85;
      });
    } });
  }

  // 02 Website: a broken browser; visitors arrive and bounce, then arrive and convert
  {
    const group = new THREE.Group();
    const web = device(3.8, 2.4, 0.12, 0.12, webScreen(false), webScreen(true));
    web.g.position.y = 0.3;
    group.add(web.g);
    const N = 54;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), alpha = new Float32Array(N);
    const seeds = [...Array(N)].map(() => ({ s: new THREE.Vector3((rand() - 0.5) * 7, (rand() - 0.5) * 3.4 + 0.3, 4 + rand() * 2), e: new THREE.Vector3((rand() - 0.5) * 3.2, (rand() - 0.5) * 1.9 + 0.3, 0.1), off: rand() }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: 'attribute float aAlpha; varying float vA; varying vec3 vC; void main(){ vA = aAlpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = 70.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, pow(smoothstep(0.5, 0.0, d), 1.5) * vA); }',
    }));
    pts.frustumCulled = false;
    group.add(pts);
    const P = new THREE.Vector3(), Q = new THREE.Vector3();
    stations.push({ group, update(t, fix) {
      web.mat.uniforms.uTime.value = t; web.mat.uniforms.uFix.value = fix;
      seeds.forEach((sd, k) => {
        const p = (t * 0.2 + sd.off) % 1;
        // without AI: approach, hesitate, leave
        if (p < 0.55) P.lerpVectors(sd.s, sd.e, smooth(0, 1, p / 0.55));
        else { P.lerpVectors(sd.e, sd.s, smooth(0, 1, (p - 0.55) / 0.45)); P.y -= (p - 0.55) * 3; P.x += (p - 0.55) * (sd.s.x > 0 ? 3 : -3); }
        // with AI: approach and convert into the page
        Q.lerpVectors(sd.s, sd.e, smooth(0, 1, Math.min(1, p / 0.8)));
        P.lerp(Q, fix);
        pos.set([P.x, P.y, P.z], k * 3);
        const bouncing = p >= 0.55 ? 1 - fix : 0;
        col.set([1, 1 - bouncing * 0.75, 1 - bouncing * 0.8], k * 3);
        alpha[k] = fix > 0.5 ? (p < 0.8 ? 0.9 : (1 - (p - 0.8) / 0.2)) : Math.sin(p * Math.PI) * 0.9;
      });
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.aAlpha.needsUpdate = true;
    } });
  }

  // 03 Leads: unanswered messages pile up and topple; with AI each gets a reply
  {
    const group = new THREE.Group();
    const inbox = device(2.5, 3.1, 0.14, 0.16, leadsScreen(false), leadsScreen(true));
    inbox.g.position.x = -0.7;
    group.add(inbox.g);
    const shape = new THREE.Shape();
    shape.moveTo(-0.3, -0.13); shape.lineTo(0.3, -0.13); shape.quadraticCurveTo(0.38, -0.13, 0.38, -0.05); shape.lineTo(0.38, 0.05);
    shape.quadraticCurveTo(0.38, 0.13, 0.3, 0.13); shape.lineTo(-0.3, 0.13); shape.quadraticCurveTo(-0.38, 0.13, -0.38, 0.05);
    shape.lineTo(-0.38, -0.05); shape.quadraticCurveTo(-0.38, -0.13, -0.3, -0.13);
    const bGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    const checkGeo = new THREE.CircleGeometry(0.07, 20);
    const bubbles = [...Array(9)].map((_, k) => {
      const m = new THREE.Mesh(bGeo, new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.3, clearcoat: 1, transparent: true }));
      m.scale.setScalar(0.8);
      const check = new THREE.Mesh(checkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      check.position.set(0.24, 0, 0.06);
      m.add(check);
      m.userData.check = check;
      group.add(m);
      return m;
    });
    const white = new THREE.Color(0xf4f1ea), red = new THREE.Color(RED);
    stations.push({ group, update(t, fix) {
      inbox.mat.uniforms.uTime.value = t; inbox.mat.uniforms.uFix.value = fix;
      const fall = (t * 0.22) % 1;
      bubbles.forEach((m, k) => {
        const lean = Math.sin(t * 1.2) * 0.012 * k * k;
        let px = 1.55 + lean * 2, py = -1.35 + k * 0.27, pz = 0.25, rz = lean;
        if (k === bubbles.length - 1) { px += fall * 1.6; py += 0.3 - fall * fall * 4.5; rz = fall * 4; }
        const fx = 1.5, fy = -1.3 + k * 0.29, fz = 0.25;
        m.position.set(px + (fx - px) * fix, py + (fy - py) * fix, pz + (fz - pz) * fix);
        m.rotation.z = rz * (1 - fix);
        m.material.color.lerpColors(red, white, fix);
        m.material.opacity = k === bubbles.length - 1 ? 1 - fall * (1 - fix) : 1;
        m.userData.check.scale.setScalar(Math.max(0.001, fix));
        m.userData.check.material.color.set(fix > 0.5 ? RED : 0xffffff);
      });
    } });
  }

  // 04 Ads: budget pours into a cracked funnel and leaks; with AI it lands as sales
  {
    const group = new THREE.Group();
    const prof = [[0.22, -0.95], [0.24, -0.25], [0.42, 0.15], [0.9, 0.75], [1.35, 1.35], [1.5, 1.7]].map(([r, y]) => new THREE.Vector2(r, y));
    const funnel = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 }));
    group.add(funnel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.035, 12, 96), new THREE.MeshBasicMaterial({ color: RED }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 1.7;
    group.add(rim);
    const crackPts = [];
    for (let i = 0; i <= 8; i++) crackPts.push(new THREE.Vector3(0.66 + (i % 2) * 0.08 + i * 0.03, 0.15 + i * 0.09, 0.42 + i * 0.05));
    const crack = new THREE.Line(new THREE.BufferGeometry().setFromPoints(crackPts), new THREE.LineBasicMaterial({ color: RED, transparent: true }));
    group.add(crack);
    const bars = [0.9, 1.5, 2.3].map((h, j) => {
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.36, 1, 0.36, 4, 0.06), new THREE.MeshPhysicalMaterial({ color: j === 2 ? RED : 0xf4f1ea, roughness: 0.3, clearcoat: 1 }));
      b.position.set(1.7 + j * 0.5, -1.9, 0.2);
      b.userData.h = h;
      group.add(b);
      return b;
    });
    const coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.035, 24);
    const coinMat = new THREE.MeshPhysicalMaterial({ color: 0xe9c46a, metalness: 1, roughness: 0.28, clearcoat: 0.6 });
    const coins = [...Array(26)].map((_, k) => {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.userData = { a: rand() * Math.PI * 2, r: 0.3 + rand() * 0.8, off: k / 26 };
      group.add(m);
      return m;
    });
    const lbl = label(pillLabel('AED 12,400 spent', '3 sales this month', false), pillLabel('ROAS 4.6x', '212 sales this month', true), 2.7);
    lbl.m.position.set(0, 2.55, 0.4);
    group.add(lbl.m);
    const rOf = (y) => (y > 0.15 ? 0.42 + (y - 0.15) * (1.08 / 1.55) : 0.24) - 0.17;
    const P = new THREE.Vector3(), Q = new THREE.Vector3();
    stations.push({ group, update(t, fix) {
      lbl.mat.uniforms.uTime.value = t; lbl.mat.uniforms.uFix.value = fix;
      crack.material.opacity = (1 - fix) * (0.6 + Math.sin(t * 12) * 0.4);
      bars.forEach((b) => { const h = Math.max(0.05, b.userData.h * fix); b.scale.y = h; b.position.y = -2.05 + h / 2; });
      coins.forEach((m, k) => {
        const u = m.userData;
        const p = (t * 0.14 + u.off) % 1;
        let spin = 0;
        if (p < 0.28) { const q = p / 0.28; P.set(Math.cos(u.a) * u.r, 3.6 - q * q * 1.9, Math.sin(u.a) * u.r); }
        else if (p < 0.6) { const q = (p - 0.28) / 0.32; const y = 1.7 - q * 1.55; const a = u.a + q * 7; P.set(Math.cos(a) * rOf(y), y, Math.sin(a) * rOf(y)); spin = q; }
        else P.set(0, 0.15, 0);
        Q.copy(P);
        if (p >= 0.6) {
          const q = (p - 0.6) / 0.4;
          // leak out through the crack
          P.set(0.75 + q * 2.2, 0.4 - q * q * 5, 0.5 + q * 1.4);
          // or drop through the spout onto the sales bars
          const j = k % 3, b = bars[j];
          const top = -2.05 + Math.max(0.05, b.userData.h * fix);
          if (q < 0.4) Q.set(0, 0.15 - (q / 0.4) * 1.1, 0);
          else { const s = (q - 0.4) / 0.6; Q.set(b.position.x * s, -0.95 + (top + 0.05 + 0.95) * s - Math.sin(s * Math.PI) * -0.6, 0.2 * s); }
        }
        P.lerp(Q, fix);
        m.position.copy(P);
        m.rotation.set(t * 2 + k, spin * 4, t + k * 0.3);
        m.visible = !(fix < 0.5 && p > 0.95);
      });
    } });
  }

  // 05 Admin: disconnected tools tangled in wires; with AI they snap into one system
  {
    const group = new THREE.Group();
    const apps = [['CRM', '◎'], ['Sheets', '▦'], ['Email', '✉'], ['WhatsApp', '✆'], ['Calendar', '▤'], ['Invoices', '₤']];
    const tileGeo = new RoundedBoxGeometry(0.78, 0.78, 0.12, 4, 0.12);
    const tiles = apps.map(([n, gl], k) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(tileGeo, new THREE.MeshPhysicalMaterial({ color: 0x1b1919, roughness: 0.3, metalness: 0.5, clearcoat: 1 })));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshBasicMaterial({ map: toTex(appIcon(n, gl)), transparent: true }));
      face.position.z = 0.065;
      g.add(face);
      g.userData = { pain: new THREE.Vector3((rand() - 0.5) * 4.6, (rand() - 0.5) * 3 + 0.2, (rand() - 0.5) * 1.4), fixed: new THREE.Vector3(Math.cos(k * Math.PI / 3) * 1.85, Math.sin(k * Math.PI / 3) * 1.55 + 0.2, 0), spin: rand() * 6 };
      group.add(g);
      return g;
    });
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: RED, emissiveIntensity: 0.4, roughness: 0.15, clearcoat: 1 }));
    hub.position.y = 0.2;
    group.add(hub);
    const SEG = 36;
    const wires = tiles.map((_, k) => {
      const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3)), new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.85 }));
      line.frustumCulled = false;
      group.add(line);
      return line;
    });
    const pulses = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(tiles.length * 3), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, depthWrite: false }));
    pulses.frustumCulled = false;
    group.add(pulses);
    const clock = new THREE.Group();
    clock.add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ color: 0x141212 })));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 48), new THREE.MeshBasicMaterial({ color: RED }));
    clock.add(ring);
    const hand = (len, w) => { const h = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ color: 0xffffff })); h.geometry.translate(0, len / 2, 0.01); clock.add(h); return h; };
    const hourH = hand(0.22, 0.05), minH = hand(0.34, 0.035);
    clock.position.set(-1.1, 2.75, 0.3);
    group.add(clock);
    const lbl = label(pillLabel('31 hrs a week', 'lost to admin', false, 700), pillLabel('4 hrs a week', 'the rest runs itself', true, 700), 1.6);
    lbl.m.position.set(0.85, 2.75, 0.3);
    group.add(lbl.m);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), M = new THREE.Vector3(), V = new THREE.Vector3(), W = new THREE.Vector3();
    const hubPos = new THREE.Vector3(0, 0.2, 0);
    let clockT = 0;
    stations.push({ group, update(t, fix, dt) {
      lbl.mat.uniforms.uTime.value = t; lbl.mat.uniforms.uFix.value = fix;
      hub.scale.setScalar(Math.max(0.001, fix));
      tiles.forEach((g, k) => {
        const u = g.userData;
        V.copy(u.pain).add(W.set(Math.sin(t * 1.7 + k) * 0.08, Math.cos(t * 1.3 + k) * 0.08, 0));
        g.position.lerpVectors(V, u.fixed, fix);
        g.rotation.set((1 - fix) * Math.sin(t + u.spin) * 0.4, (1 - fix) * Math.sin(t * 0.7 + u.spin) * 0.6, (1 - fix) * Math.sin(t * 0.9 + u.spin) * 0.3);
      });
      wires.forEach((line, k) => {
        const arr = line.geometry.attributes.position.array;
        A.copy(tiles[k].position); B.copy(tiles[(k + 2) % tiles.length].position);
        M.addVectors(A, B).multiplyScalar(0.5).add(W.set(Math.sin(t * 0.8 + k * 2) * 1.4, Math.cos(t * 0.6 + k) * 1.2, 0.8));
        for (let i = 0; i < SEG; i++) {
          const s = i / (SEG - 1), o = 1 - s;
          const tx = o * o * A.x + 2 * o * s * M.x + s * s * B.x + Math.sin(i * 0.9 + t * 3 + k) * 0.08;
          const ty = o * o * A.y + 2 * o * s * M.y + s * s * B.y + Math.cos(i * 0.7 + t * 2.4 + k) * 0.08;
          const tz = o * o * A.z + 2 * o * s * M.z + s * s * B.z;
          V.copy(hubPos).lerp(tiles[k].position, s);
          arr[i * 3] = tx + (V.x - tx) * fix; arr[i * 3 + 1] = ty + (V.y - ty) * fix; arr[i * 3 + 2] = tz + (V.z - tz) * fix;
        }
        line.geometry.attributes.position.needsUpdate = true;
        line.material.color.set(fix > 0.5 ? 0xffffff : RED);
        line.material.opacity = 0.35 + 0.5 * (fix > 0.5 ? fix : 1 - fix);
        const s = (t * 0.6 + k / tiles.length) % 1;
        V.copy(hubPos).lerp(tiles[k].position, s);
        pulses.geometry.attributes.position.array.set([V.x, V.y, V.z + 0.05], k * 3);
      });
      pulses.geometry.attributes.position.needsUpdate = true;
      pulses.material.opacity = fix;
      clockT += dt * (6 - fix * 5.6);
      minH.rotation.z = -clockT * 2;
      hourH.rotation.z = -clockT / 6;
    } });
  }
  return stations;
}

function growthLabel() {
  const [c, x] = makeCanvas(700, 220);
  x.fillStyle = 'rgba(227,50,38,.92)'; rr(x, 6, 6, 688, 208, 104); x.fill();
  txt(x, 'Revenue ↑', 350, 112, 66, WHITE, 800, 'center');
  txt(x, 'one connected system', 350, 168, 30, 'rgba(255,255,255,.85)', 700, 'center');
  return c;
}

// ---------- Scene ----------
function init() {
  const mobileQ = window.matchMedia('(max-width: 760px)');
  const compact = mobileQ.matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x010000, 42, 120);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(buildStudio(), 0.02).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 5, 6);
  scene.add(key);
  const redLight = new THREE.PointLight(0xe33226, 45, 16, 2);
  redLight.position.set(-3.5, -1.5, 3.5);
  scene.add(redLight);

  // ---------- The duo: two liquid orbs, our guides through the journey ----------
  const duo = new THREE.Group();
  scene.add(duo);
  const core = new THREE.Group();
  core.rotation.set(0.32, 0, -0.2);
  duo.add(core);
  const seg = compact ? 80 : 144;
  const sphere = new THREE.SphereGeometry(1, seg, seg);
  const ORB_R = 0.9;
  const redMat = blobMaterial({ color: 0xe33226, metalness: 0.2, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x3a0603, sheen: 0.5, sheenColor: new THREE.Color(0xff8a7a) }, 1.7);
  const chromeMat = blobMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, clearcoat: 0.6, clearcoatRoughness: 0.04 }, 8.3);
  const redOrb = new THREE.Mesh(sphere, redMat);
  const chromeOrb = new THREE.Mesh(sphere, chromeMat);
  redOrb.scale.setScalar(ORB_R);
  chromeOrb.scale.setScalar(ORB_R);
  core.add(redOrb, chromeOrb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xe33226, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(8, 8, 1);
  halo.position.z = -2;
  duo.add(halo);

  const shared = { uTime: { value: 0 }, uPointer: { value: new THREE.Vector3(999, 999, 999) }, uPulse: { value: 0 }, uFade: { value: 1 }, uPixelRatio: { value: renderer.getPixelRatio() } };
  const rand = seeded(20260913);

  // Neural network around the hero
  const NODE_COUNT = compact ? 80 : 150;
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 2.7 + Math.pow(rand(), 0.7) * 3.1;
    nodes.push(new THREE.Vector3(Math.cos(th) * s * r * 1.35, u * r * 0.8, Math.sin(th) * s * r * 0.9));
  }
  const edges = [];
  const degree = new Array(NODE_COUNT).fill(0);
  for (let i = 0; i < NODE_COUNT; i++) for (let j = i + 1; j < NODE_COUNT && degree[i] < 4; j++) {
    if (degree[j] >= 4) continue;
    if (nodes[i].distanceTo(nodes[j]) < 1.8) { edges.push([nodes[i], nodes[j]]); degree[i]++; degree[j]++; }
  }
  const origin = new THREE.Vector3();
  nodes.map((n) => ({ n, d: n.length() })).sort((a, b) => a.d - b.d).slice(0, compact ? 8 : 14).forEach(({ n }) => edges.push([origin, n]));
  const net = new THREE.Group();
  scene.add(net);
  const linePos = new Float32Array(edges.length * 6), lineT = new Float32Array(edges.length * 2), linePhase = new Float32Array(edges.length * 2);
  edges.forEach(([a, b], k) => { linePos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6); lineT[k * 2 + 1] = 1; const ph = rand(); linePhase[k * 2] = ph; linePhase[k * 2 + 1] = ph; });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('aT', new THREE.BufferAttribute(lineT, 1));
  lineGeo.setAttribute('aPhase', new THREE.BufferAttribute(linePhase, 1));
  const PULSE_VS = /* glsl */`
    attribute float aT; attribute float aPhase; uniform vec3 uPointer;
    varying float vT; varying float vPhase; varying float vNear;
    void main(){ vT = aT; vPhase = aPhase; vec4 wp = modelMatrix * vec4(position, 1.0); vNear = smoothstep(2.8, 0.0, distance(wp.xyz, uPointer)); gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const PULSE_FS = /* glsl */`
    uniform float uTime; uniform float uPulse; uniform float uFade;
    varying float vT; varying float vPhase; varying float vNear;
    void main(){
      float head = fract(uTime * 0.22 + vPhase);
      float carrier = step(0.45, fract(vPhase * 7.31));
      float glow = smoothstep(0.14, 0.0, abs(vT - head)) * carrier;
      float a = 0.07 + glow * 0.8 + vNear * 0.4 + uPulse * 0.45;
      vec3 col = mix(vec3(1.0), vec3(0.95, 0.24, 0.17), step(0.55, fract(vPhase * 3.7)));
      gl_FragColor = vec4(col, a * uFade);
    }`;
  net.add(new THREE.LineSegments(lineGeo, new THREE.ShaderMaterial({ uniforms: shared, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: PULSE_VS, fragmentShader: PULSE_FS })));
  const nodePos = new Float32Array(NODE_COUNT * 3), nodeSize = new Float32Array(NODE_COUNT), nodePhase = new Float32Array(NODE_COUNT);
  nodes.forEach((n, i) => { nodePos.set([n.x, n.y, n.z], i * 3); nodeSize[i] = 2.2 + rand() * 3.4; nodePhase[i] = rand(); });
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSize, 1));
  nodeGeo.setAttribute('aPhase', new THREE.BufferAttribute(nodePhase, 1));
  net.add(new THREE.Points(nodeGeo, new THREE.ShaderMaterial({
    uniforms: shared, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase; uniform float uTime; uniform float uPixelRatio; uniform vec3 uPointer; uniform float uPulse;
      varying float vPhase; varying float vNear;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vNear = smoothstep(2.5, 0.0, distance(wp.xyz, uPointer)); vec4 mv = viewMatrix * wp;
        float tw = 0.75 + 0.25 * sin(uTime * 1.7 + aPhase * 6.2831);
        gl_PointSize = aSize * uPixelRatio * (tw + vNear * 1.4 + uPulse * 0.9) * (12.0 / -mv.z); gl_Position = projectionMatrix * mv; vPhase = aPhase; }`,
    fragmentShader: /* glsl */`
      uniform float uFade; varying float vPhase; varying float vNear;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = pow(smoothstep(0.5, 0.0, d), 1.6); vec3 col = mix(vec3(1.0), vec3(0.95, 0.24, 0.17), step(0.7, vPhase)); gl_FragColor = vec4(col, a * (0.6 + vNear * 0.4) * uFade); }`,
  })));

  // Data stream between the two orbs
  const STREAM = compact ? 70 : 140;
  const streamPos = new Float32Array(STREAM * 3), streamAlpha = new Float32Array(STREAM), streamDir = new Float32Array(STREAM);
  const streamOff = [], streamJit = [];
  for (let i = 0; i < STREAM; i++) { streamDir[i] = i % 2; streamOff.push(rand()); streamJit.push(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.35)); }
  const streamGeo = new THREE.BufferGeometry();
  streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPos, 3).setUsage(THREE.DynamicDrawUsage));
  streamGeo.setAttribute('aAlpha', new THREE.BufferAttribute(streamAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  streamGeo.setAttribute('aDir', new THREE.BufferAttribute(streamDir, 1));
  const stream = new THREE.Points(streamGeo, new THREE.ShaderMaterial({
    uniforms: shared, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aAlpha; attribute float aDir; uniform float uPixelRatio; varying float vAlpha; varying float vDir; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (2.0 + aAlpha * 4.0) * uPixelRatio * (12.0 / -mv.z); gl_Position = projectionMatrix * mv; vAlpha = aAlpha; vDir = aDir; }',
    fragmentShader: 'varying float vAlpha; varying float vDir; void main(){ float d = length(gl_PointCoord - 0.5); float a = pow(smoothstep(0.5, 0.0, d), 1.5) * vAlpha; gl_FragColor = vec4(mix(vec3(1.0, 0.32, 0.24), vec3(1.0), vDir), a); }',
  }));
  stream.frustumCulled = false;
  core.add(stream);

  // ---------- The business: five stations on a ring below the hero ----------
  const C = new THREE.Vector3(0, -34, 0);
  const RING = 16;
  const ANG = [0, 1, 2, 3, 4].map((i) => -0.5 + i * (Math.PI * 2 / 5));
  const stationPos = ANG.map((a) => new THREE.Vector3(C.x + Math.sin(a) * RING, C.y, C.z + Math.cos(a) * RING));
  const world = new THREE.Group();
  scene.add(world);

  const grid = new THREE.GridHelper(90, 60, 0xe33226, 0x3a1210);
  grid.position.set(C.x, C.y - 2.8, C.z);
  grid.material.transparent = true;
  grid.material.opacity = 0;
  world.add(grid);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(RING - 0.06, RING + 0.06, 160), new THREE.MeshBasicMaterial({ color: 0xe33226, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.set(C.x, C.y - 2.75, C.z);
  world.add(floorRing);

  let stations = [];
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x151313, roughness: 0.28, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.08 });
  const build = () => {
    stations = makeStations(frameMat, seeded(77));
    stations.forEach((s, i) => { s.group.position.copy(stationPos[i]); s.group.rotation.y = ANG[i]; world.add(s.group); });
  };
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  fontsReady.then(build);

  // Beams: the AI core reaching every station
  const beamMats = stationPos.map((p) => {
    const g = new THREE.BufferGeometry();
    const a = C.clone().add(new THREE.Vector3(0, 0.8, 0)), b = p.clone().add(new THREE.Vector3(0, 0.3, 0));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]), 3));
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array([0, 1]), 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uOn: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uOn; varying float vT;
        void main(){ float reach = step(vT, uOn * 1.05); float head = fract(uTime * 0.5 - vT); float glow = smoothstep(0.2, 0.0, head);
          gl_FragColor = vec4(mix(vec3(1.0, 0.3, 0.22), vec3(1.0), glow), (0.35 + glow * 0.65) * reach); }`,
    });
    world.add(new THREE.LineSegments(g, m));
    return m;
  });

  // Growth: a red line spiralling up around the ring once everything is connected
  const growthPts = [];
  for (let i = 0; i <= 60; i++) {
    const s = i / 60, a = ANG[0] - 0.6 + s * Math.PI * 1.6, r = RING + 3 - s * 2;
    growthPts.push(new THREE.Vector3(C.x + Math.sin(a) * r, C.y - 2 + Math.pow(s, 2.2) * 15, C.z + Math.cos(a) * r));
  }
  const growthCurve = new THREE.CatmullRomCurve3(growthPts);
  const growthGeo = new THREE.TubeGeometry(growthCurve, 300, 0.16, 12, false);
  const growth = new THREE.Mesh(growthGeo, new THREE.MeshBasicMaterial({ color: 0xe33226 }));
  world.add(growth);
  const growthTip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  world.add(growthTip);
  const growthTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: toTex(growthLabel()), transparent: true, depthWrite: false }));
  growthTag.scale.set(5.6, 1.76, 1);
  world.add(growthTag);
  const GROWTH_IDX = growthGeo.index.count;

  // ---------- Keyframes, one per story beat in the DOM ----------
  const outward = (i) => new THREE.Vector3(Math.sin(ANG[i]), 0, Math.cos(ANG[i]));
  const rightOf = (i) => new THREE.Vector3(Math.cos(ANG[i]), 0, -Math.sin(ANG[i]));
  const UP = new THREE.Vector3(0, 1, 0);
  const POSE_KEYS = ['shiftX', 'shiftY', 'duoScale', 'net', 'solve', 'beams', 'growth', 'show', 'world'];
  const poseFor = (name, mobile) => {
    const base = { shiftX: mobile ? 0 : 0.2, shiftY: mobile ? 0.2 : 0, duoScale: 0.45, net: 0, solve: 0, beams: 0, growth: 0, show: 1, world: 1 };
    if (name === 'hero') return { ...base, cam: new THREE.Vector3(0, 0, 11), target: new THREE.Vector3(), duo: new THREE.Vector3(), duoScale: 1, net: 1, world: 0, shiftX: mobile ? 0 : 0.24, shiftY: mobile ? -0.36 : 0 };
    if (name === 'intro') return { ...base, cam: C.clone().add(new THREE.Vector3(0, 24, 40)), target: C.clone().add(new THREE.Vector3(0, -2, 0)), duo: C.clone().add(new THREE.Vector3(0, 1.6, 0)), duoScale: 1.1 };
    const m = /^s(\d)$/.exec(name);
    if (m) {
      const i = +m[1], P = stationPos[i], n = outward(i), r = rightOf(i);
      const dist = [8.2, 8.8, 8.4, 10.5, 10.2][i];
      return { ...base, cam: P.clone().addScaledVector(n, dist).addScaledVector(UP, 1.5), target: P.clone().addScaledVector(UP, 0.25), duo: P.clone().addScaledVector(n, -1.5).addScaledVector(r, -2.9).addScaledVector(UP, 1.6), duoScale: 0.27 };
    }
    const top = { cam: C.clone().add(new THREE.Vector3(0, 21, 37)), target: C.clone().add(new THREE.Vector3(0, -1, 0)), duo: C.clone().add(new THREE.Vector3(0, 1, 0)), duoScale: 1.9 };
    if (name === 'ai') return { ...base, ...top, solve: 0.75, beams: 1 };
    if (name === 'growth') return { ...base, ...top, cam: C.clone().add(new THREE.Vector3(0, 17, 50)), target: C.clone().add(new THREE.Vector3(0, 4, 0)), solve: 1, beams: 1, growth: 1 };
    if (name === 'end') return { ...base, ...top, cam: C.clone().add(new THREE.Vector3(0, 17, 50)), target: C.clone().add(new THREE.Vector3(0, 4, 0)), solve: 1, beams: 1, growth: 1, show: 0 };
    return { ...base, cam: new THREE.Vector3(0, 0, 11), target: new THREE.Vector3(), duo: new THREE.Vector3() };
  };
  let anchors = [];
  const measure = () => {
    const mobile = mobileQ.matches, vh = window.innerHeight;
    anchors = [...document.querySelectorAll('[data-cj]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { y: r.top + window.scrollY + r.height / 2 - vh / 2, pose: poseFor(el.dataset.cj, mobile) };
    }).sort((a, b) => a.y - b.y);
    if (anchors.length && anchors[0].y > 0) anchors[0].y = 0;
  };
  const hold = (t) => smooth(0.15, 0.85, t);
  const cur = { cam: new THREE.Vector3(), target: new THREE.Vector3(), duo: new THREE.Vector3() };
  const sample = () => {
    const y = window.scrollY;
    let a = anchors[0], b = anchors[0], t = 0;
    if (y >= anchors[anchors.length - 1].y) a = b = anchors[anchors.length - 1];
    else for (let i = 0; i < anchors.length - 1; i++) if (y >= anchors[i].y && y < anchors[i + 1].y) { a = anchors[i]; b = anchors[i + 1]; t = hold((y - a.y) / (b.y - a.y || 1)); break; }
    cur.cam.lerpVectors(a.pose.cam, b.pose.cam, t);
    cur.target.lerpVectors(a.pose.target, b.pose.target, t);
    cur.duo.lerpVectors(a.pose.duo, b.pose.duo, t);
    POSE_KEYS.forEach((k) => { cur[k] = a.pose[k] + (b.pose[k] - a.pose[k]) * t; });
    return cur;
  };

  let W = 1, H = 1;
  const layout = () => {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    shared.uPixelRatio.value = renderer.getPixelRatio();
    measure();
  };
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('load', measure);
  new ResizeObserver(measure).observe(document.body);

  // ---------- Interaction in the hero ----------
  const ptr = new THREE.Vector2(), ptrTarget = new THREE.Vector2();
  let hovering = false, lastMove = -1e9, energy = 0, pulse = 0;
  hero.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / W) * 2 - 1, ny = -((e.clientY / H) * 2 - 1);
    energy = Math.min(1, energy + Math.hypot(nx - ptrTarget.x, ny - ptrTarget.y) * 2.2);
    ptrTarget.set(nx, ny);
    hovering = e.pointerType === 'mouse' || e.pointerType === 'pen';
    lastMove = performance.now();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { hovering = false; });
  hero.addEventListener('pointerdown', (e) => { if (e.target.closest('a, button, input, textarea, select')) return; pulse = 1; energy = 1; });

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), P = new THREE.Vector3(), dir = new THREE.Vector3();

  const clock = new THREE.Clock();
  let t = 0, started = false;
  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden || !anchors.length) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const p = sample();
    mount.style.opacity = Math.min(1, Math.max(0, p.show)).toFixed(3);
    if (p.show < 0.01) { mount.style.visibility = 'hidden'; return; }
    mount.style.visibility = '';

    // Camera: keyframed path, pulled back on narrow screens, lens-shifted so the subject sits beside the copy
    const fit = camera.aspect < 1.2 ? Math.min(2.3, 1.35 / camera.aspect) : 1;
    dir.subVectors(p.cam, p.target).multiplyScalar(fit);
    camera.position.copy(p.target).add(dir);
    camera.lookAt(p.target);
    scene.fog.near = 42 * fit; scene.fog.far = 120 * fit;
    camera.setViewOffset(W, H, -p.shiftX * W, p.shiftY * H, W, H);

    if (!hovering && performance.now() - lastMove > 2500) ptrTarget.set(Math.sin(t * 0.33) * 0.35, Math.cos(t * 0.26) * 0.22);
    ptr.lerp(ptrTarget, 1 - Math.pow(0.004, dt));
    energy *= Math.pow(0.3, dt);
    pulse *= Math.pow(0.1, dt);
    shared.uTime.value = t;
    shared.uPulse.value = pulse;
    shared.uFade.value = p.net;
    net.visible = p.net > 0.01;
    net.rotation.y += dt * 0.045;
    net.rotation.x = Math.sin(t * 0.12) * 0.1;

    const amp = 0.075 + energy * 0.09 + pulse * 0.2 + p.beams * 0.05;
    redMat.userData.uniforms.uTime.value = t;
    chromeMat.userData.uniforms.uTime.value = t * 0.9;
    redMat.userData.uniforms.uAmp.value = amp;
    chromeMat.userData.uniforms.uAmp.value = amp * 0.85;
    duo.position.copy(p.duo);
    duo.position.y += Math.sin(t * 1.1) * 0.08 * (1 - p.net);
    duo.scale.setScalar(p.duoScale * (1 + pulse * 0.07));
    duo.rotation.y = ptr.x * 0.5 * p.net + t * 0.25 * (1 - p.net);
    duo.rotation.x = -ptr.y * 0.3 * p.net;
    halo.material.opacity = 0.3 + energy * 0.12 + pulse * 0.3 + p.beams * 0.25;

    const ang = t * (0.34 + p.beams * 0.5);
    A.set(Math.cos(ang) * 1.28, Math.sin(ang * 2) * 0.14, Math.sin(ang) * 1.28);
    B.copy(A).multiplyScalar(-1);
    redOrb.position.copy(A); chromeOrb.position.copy(B);
    redOrb.rotation.y = t * 0.22; chromeOrb.rotation.y = -t * 0.27;
    for (let i = 0; i < STREAM; i++) {
      const tt = (t * 0.24 + streamOff[i]) % 1, from = streamDir[i] ? B : A, to = streamDir[i] ? A : B;
      Cc.set(0, streamDir[i] ? -0.95 : 0.95, 0);
      const k = 1 - tt;
      P.copy(from).multiplyScalar(k * k).addScaledVector(Cc, 2 * k * tt).addScaledVector(to, tt * tt);
      const env = Math.sin(tt * Math.PI);
      P.addScaledVector(streamJit[i], env);
      streamPos[i * 3] = P.x; streamPos[i * 3 + 1] = P.y; streamPos[i * 3 + 2] = P.z;
      streamAlpha[i] = Math.pow(env, 1.4) * (0.65 + pulse * 0.35);
    }
    streamGeo.attributes.position.needsUpdate = true;
    streamGeo.attributes.aAlpha.needsUpdate = true;

    // The business
    world.visible = p.world > 0.01;
    if (world.visible) {
      grid.material.opacity = 0.22 * p.world;
      floorRing.material.opacity = 0.25 + p.beams * 0.5;
      stations.forEach((s, i) => s.update(t, smooth(i * 0.12, i * 0.12 + 0.4, p.solve), dt));
      beamMats.forEach((m, i) => { m.uniforms.uOn.value = smooth(i * 0.12, i * 0.12 + 0.3, p.beams * p.solve * 1.2); });
      const g = p.growth;
      growth.visible = growthTip.visible = growthTag.visible = g > 0.01;
      growth.geometry.setDrawRange(0, Math.floor(GROWTH_IDX * g / 3) * 3);
      growthCurve.getPointAt(Math.max(0.001, g * 0.999), growthTip.position);
      growthTag.position.copy(growthTip.position).add(new THREE.Vector3(0, 1.4, 0));
      growthTag.material.opacity = smooth(0.8, 1, g);
    }

    if (hovering && p.net > 0.5) {
      raycaster.setFromCamera(ptr, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) shared.uPointer.value.copy(hit);
    } else shared.uPointer.value.set(999, 999, 999);

    renderer.render(scene, camera);
    if (!started) { started = true; hero.classList.add('has-3d'); }
  };
  requestAnimationFrame(frame);
  renderer.domElement.addEventListener('webglcontextlost', () => hero.classList.remove('has-3d'));
}

if (hero && mount) {
  try { init(); } catch (err) { console.warn('3D journey unavailable, falling back to the static mark.', err); }
}
