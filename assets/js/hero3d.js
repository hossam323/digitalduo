import * as THREE from 'three';

const hero = document.getElementById('heroSplit');
const mount = document.getElementById('hero3d');

if (hero && mount) {
  try {
    init();
  } catch (err) {
    console.warn('3D hero unavailable, falling back to the static mark.', err);
  }
}

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

function init() {
  const compact = window.innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const BASE_Z = 11;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, BASE_Z);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(buildStudio(), 0.02).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 5, 6);
  scene.add(key);
  const redLight = new THREE.PointLight(0xe33226, 45, 16, 2);
  redLight.position.set(-3.5, -1.5, 3.5);
  scene.add(redLight);

  const rig = new THREE.Group();
  scene.add(rig);

  // ---------- The duo: two liquid orbs in a binary orbit ----------
  const core = new THREE.Group();
  core.rotation.set(0.32, 0, -0.2);
  rig.add(core);

  const seg = compact ? 80 : 144;
  const sphere = new THREE.SphereGeometry(1, seg, seg);
  const ORB_R = 0.9;
  const redMat = blobMaterial({
    color: 0xe33226, metalness: 0.2, roughness: 0.2,
    clearcoat: 1, clearcoatRoughness: 0.05,
    emissive: 0x3a0603, sheen: 0.5, sheenColor: new THREE.Color(0xff8a7a),
  }, 1.7);
  const chromeMat = blobMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.06,
    clearcoat: 0.6, clearcoatRoughness: 0.04,
  }, 8.3);
  const redOrb = new THREE.Mesh(sphere, redMat);
  const chromeOrb = new THREE.Mesh(sphere, chromeMat);
  redOrb.scale.setScalar(ORB_R);
  chromeOrb.scale.setScalar(ORB_R);
  core.add(redOrb, chromeOrb);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xe33226, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(8, 8, 1);
  halo.position.z = -2;
  rig.add(halo);

  // ---------- Shared uniforms for the network + data stream ----------
  const shared = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector3(999, 999, 999) },
    uPulse: { value: 0 },
    uFade: { value: 1 },
    uPixelRatio: { value: renderer.getPixelRatio() },
  };

  // ---------- Neural network: nodes + connections carrying pulses ----------
  const rand = seeded(20260913);
  const NODE_COUNT = compact ? 80 : 150;
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 2.7 + Math.pow(rand(), 0.7) * 3.1;
    nodes.push(new THREE.Vector3(Math.cos(th) * s * r * 1.35, u * r * 0.8, Math.sin(th) * s * r * 0.9));
  }

  const edges = [];
  const degree = new Array(NODE_COUNT).fill(0);
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT && degree[i] < 4; j++) {
      if (degree[j] >= 4) continue;
      if (nodes[i].distanceTo(nodes[j]) < 1.8) {
        edges.push([nodes[i], nodes[j]]);
        degree[i]++; degree[j]++;
      }
    }
  }
  // Spokes from the duo out to the inner ring of nodes: the orchestration layer.
  const origin = new THREE.Vector3();
  nodes
    .map((n) => ({ n, d: n.length() }))
    .sort((a, b) => a.d - b.d)
    .slice(0, compact ? 8 : 14)
    .forEach(({ n }) => edges.push([origin, n]));

  const net = new THREE.Group();
  rig.add(net);

  const linePos = new Float32Array(edges.length * 6);
  const lineT = new Float32Array(edges.length * 2);
  const linePhase = new Float32Array(edges.length * 2);
  edges.forEach(([a, b], k) => {
    linePos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
    lineT[k * 2] = 0; lineT[k * 2 + 1] = 1;
    const ph = rand();
    linePhase[k * 2] = ph; linePhase[k * 2 + 1] = ph;
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('aT', new THREE.BufferAttribute(lineT, 1));
  lineGeo.setAttribute('aPhase', new THREE.BufferAttribute(linePhase, 1));
  const lineMat = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aT;
      attribute float aPhase;
      uniform vec3 uPointer;
      varying float vT;
      varying float vPhase;
      varying float vNear;
      void main(){
        vT = aT; vPhase = aPhase;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNear = smoothstep(2.8, 0.0, distance(wp.xyz, uPointer));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uPulse;
      uniform float uFade;
      varying float vT;
      varying float vPhase;
      varying float vNear;
      void main(){
        float head = fract(uTime * 0.22 + vPhase);
        float carrier = step(0.45, fract(vPhase * 7.31));
        float glow = smoothstep(0.14, 0.0, abs(vT - head)) * carrier;
        float a = 0.07 + glow * 0.8 + vNear * 0.4 + uPulse * 0.45;
        vec3 col = mix(vec3(1.0), vec3(0.95, 0.24, 0.17), step(0.55, fract(vPhase * 3.7)));
        gl_FragColor = vec4(col, a * uFade);
      }`,
  });
  net.add(new THREE.LineSegments(lineGeo, lineMat));

  const nodePos = new Float32Array(NODE_COUNT * 3);
  const nodeSize = new Float32Array(NODE_COUNT);
  const nodePhase = new Float32Array(NODE_COUNT);
  nodes.forEach((n, i) => {
    nodePos.set([n.x, n.y, n.z], i * 3);
    nodeSize[i] = 2.2 + rand() * 3.4;
    nodePhase[i] = rand();
  });
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSize, 1));
  nodeGeo.setAttribute('aPhase', new THREE.BufferAttribute(nodePhase, 1));
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec3 uPointer;
      uniform float uPulse;
      varying float vPhase;
      varying float vNear;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNear = smoothstep(2.5, 0.0, distance(wp.xyz, uPointer));
        vec4 mv = viewMatrix * wp;
        float twinkle = 0.75 + 0.25 * sin(uTime * 1.7 + aPhase * 6.2831);
        gl_PointSize = aSize * uPixelRatio * (twinkle + vNear * 1.4 + uPulse * 0.9) * (12.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vPhase = aPhase;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFade;
      varying float vPhase;
      varying float vNear;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.6);
        vec3 col = mix(vec3(1.0), vec3(0.95, 0.24, 0.17), step(0.7, vPhase));
        gl_FragColor = vec4(col, a * (0.6 + vNear * 0.4) * uFade);
      }`,
  });
  net.add(new THREE.Points(nodeGeo, nodeMat));

  // ---------- Data stream flowing between the two orbs ----------
  const STREAM = compact ? 70 : 140;
  const streamPos = new Float32Array(STREAM * 3);
  const streamAlpha = new Float32Array(STREAM);
  const streamDir = new Float32Array(STREAM);
  const streamOff = [];
  const streamJit = [];
  for (let i = 0; i < STREAM; i++) {
    streamDir[i] = i % 2;
    streamOff.push(rand());
    streamJit.push(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.35));
  }
  const streamGeo = new THREE.BufferGeometry();
  const streamPosAttr = new THREE.BufferAttribute(streamPos, 3).setUsage(THREE.DynamicDrawUsage);
  const streamAlphaAttr = new THREE.BufferAttribute(streamAlpha, 1).setUsage(THREE.DynamicDrawUsage);
  streamGeo.setAttribute('position', streamPosAttr);
  streamGeo.setAttribute('aAlpha', streamAlphaAttr);
  streamGeo.setAttribute('aDir', new THREE.BufferAttribute(streamDir, 1));
  const streamMat = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aAlpha;
      attribute float aDir;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vDir;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (2.0 + aAlpha * 4.0) * uPixelRatio * (12.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vAlpha = aAlpha; vDir = aDir;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFade;
      varying float vAlpha;
      varying float vDir;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.5) * vAlpha;
        vec3 col = mix(vec3(1.0, 0.32, 0.24), vec3(1.0), vDir);
        gl_FragColor = vec4(col, a * uFade);
      }`,
  });
  const stream = new THREE.Points(streamGeo, streamMat);
  stream.frustumCulled = false;
  core.add(stream);

  // ---------- Layout ----------
  const base = new THREE.Vector3();
  let baseScale = 1;
  const layout = () => {
    const w = mount.clientWidth || hero.clientWidth;
    const h = mount.clientHeight || hero.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * BASE_Z;
    const halfW = halfH * camera.aspect;
    if (camera.aspect > 1.05) {
      baseScale = Math.min(0.95, halfW / 5.6);
      base.set(halfW * 0.55, 0.15, 0);
    } else {
      baseScale = Math.min(0.6, halfW / 2.4);
      base.set(0, -halfH * 0.62, 0);
    }
    shared.uPixelRatio.value = renderer.getPixelRatio();
  };
  layout();
  new ResizeObserver(layout).observe(mount);

  // ---------- Interaction ----------
  const ptr = new THREE.Vector2();
  const ptrTarget = new THREE.Vector2();
  let hovering = false;
  let lastMove = -1e9;
  let energy = 0;
  let pulse = 0;

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    energy = Math.min(1, energy + Math.hypot(nx - ptrTarget.x, ny - ptrTarget.y) * 2.2);
    ptrTarget.set(nx, ny);
    hovering = e.pointerType === 'mouse' || e.pointerType === 'pen';
    lastMove = performance.now();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { hovering = false; });
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input, textarea, select')) return;
    pulse = 1;
    energy = 1;
  });

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const P = new THREE.Vector3();

  // ---------- Render loop ----------
  const clock = new THREE.Clock();
  let t = 0;
  let started = false;

  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    const rect = hero.getBoundingClientRect();
    const scrollP = THREE.MathUtils.clamp(-rect.top / (rect.height || 1), 0, 1);

    if (!hovering && performance.now() - lastMove > 2500) {
      ptrTarget.set(Math.sin(t * 0.33) * 0.35, Math.cos(t * 0.26) * 0.22);
    }
    ptr.lerp(ptrTarget, 1 - Math.pow(0.004, dt));
    energy *= Math.pow(0.3, dt);
    pulse *= Math.pow(0.1, dt);

    shared.uTime.value = t;
    shared.uPulse.value = pulse;
    shared.uFade.value = 1 - scrollP * 0.75;

    const amp = 0.075 + energy * 0.09 + pulse * 0.2;
    redMat.userData.uniforms.uTime.value = t;
    chromeMat.userData.uniforms.uTime.value = t * 0.9;
    redMat.userData.uniforms.uAmp.value = amp;
    chromeMat.userData.uniforms.uAmp.value = amp * 0.85;

    rig.position.set(base.x, base.y + scrollP * 1.4, 0);
    rig.scale.setScalar(baseScale * (1 + pulse * 0.07));
    rig.rotation.y = ptr.x * 0.5 + scrollP * 0.7;
    rig.rotation.x = -ptr.y * 0.3 + scrollP * 0.3;
    camera.position.z = BASE_Z - scrollP * 2.4;

    net.rotation.y += dt * 0.045;
    net.rotation.x = Math.sin(t * 0.12) * 0.1;

    const ang = t * 0.34;
    const R = 1.28 + scrollP * 1.4;
    A.set(Math.cos(ang) * R, Math.sin(ang * 2) * 0.14, Math.sin(ang) * R);
    B.copy(A).multiplyScalar(-1);
    redOrb.position.copy(A);
    chromeOrb.position.copy(B);
    redOrb.rotation.y = t * 0.22;
    chromeOrb.rotation.y = -t * 0.27;

    for (let i = 0; i < STREAM; i++) {
      const tt = (t * 0.24 + streamOff[i]) % 1;
      const from = streamDir[i] ? B : A;
      const to = streamDir[i] ? A : B;
      C.set(0, streamDir[i] ? -0.95 : 0.95, 0);
      const k = 1 - tt;
      P.copy(from).multiplyScalar(k * k)
        .addScaledVector(C, 2 * k * tt)
        .addScaledVector(to, tt * tt);
      const env = Math.sin(tt * Math.PI);
      P.addScaledVector(streamJit[i], env);
      streamPos[i * 3] = P.x; streamPos[i * 3 + 1] = P.y; streamPos[i * 3 + 2] = P.z;
      streamAlpha[i] = Math.pow(env, 1.4) * (0.65 + pulse * 0.35);
    }
    streamPosAttr.needsUpdate = true;
    streamAlphaAttr.needsUpdate = true;

    halo.material.opacity = (0.3 + energy * 0.12 + pulse * 0.3) * (1 - scrollP * 0.6);
    halo.scale.setScalar(8 + pulse * 2);

    if (hovering) {
      rig.updateMatrixWorld();
      raycaster.setFromCamera(ptr, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) shared.uPointer.value.copy(hit);
    } else {
      shared.uPointer.value.set(999, 999, 999);
    }

    renderer.render(scene, camera);
    if (!started) {
      started = true;
      hero.classList.add('has-3d');
    }
  };

  // Only render while the hero is on screen and the tab is visible.
  let inView = true;
  const sync = () => {
    const run = inView && !document.hidden;
    if (run) clock.getDelta();
    renderer.domElement.style.visibility = inView ? '' : 'hidden';
    renderer.setAnimationLoop(run ? frame : null);
  };
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  renderer.domElement.addEventListener('webglcontextlost', () => {
    renderer.setAnimationLoop(null);
    hero.classList.remove('has-3d');
  });
  sync();
}
