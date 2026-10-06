/* Kaalchakra 2.0 — hero world: a toon island at sunset with the Kaalchakra (the wheel of time)
   standing on it, a pirate ship at anchor, gulls, and a stylised sea. Procedural, no model files.
   Requires three.js r128 + toon.js. */
(function () {
  "use strict";
  const T = window.THREE, K = window.KCToon;
  const canvas = document.getElementById("world");
  const hero = document.querySelector(".hero");
  const fail = () => document.documentElement.classList.add("no-webgl");
  if (!canvas || !T || !K) return fail();
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true }); } catch (e) { return fail(); }
  if (!renderer.getContext()) return fail();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const C = {
    skyTop: new T.Color(0x23205c), skyMid: new T.Color(0xc4567c), horizon: new T.Color(0xffa36b), sunGlow: new T.Color(0xffe39a),
    shallow: new T.Color(0x3fe0cf), mid: new T.Color(0x16a3b8), deep: new T.Color(0x0e5a80), foam: new T.Color(0xf6fbf4)
  };
  const SUN = new T.Vector3(0.42, 0.11, -1).normalize();

  const scene = new T.Scene();
  scene.fog = new T.Fog(0xf08c76, 120, 420);
  const camera = new T.PerspectiveCamera(38, 1, 0.5, 3000);

  /* ---------- sky ---------- */
  const sky = new T.Mesh(new T.SphereGeometry(1400, 40, 20), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: C.skyTop }, uMid: { value: C.skyMid }, uHor: { value: C.horizon }, uGlow: { value: C.sunGlow }, uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
    fragmentShader: `uniform vec3 uTop,uMid,uHor,uGlow,uSun; uniform float uTime; varying vec3 vD;
      float h(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, y));
        c = mix(c, uTop, smoothstep(0.18, 0.75, y));
        float s = max(dot(d, uSun), 0.0);
        c = mix(c, uGlow, pow(s, 6.0) * 0.75);
        c += vec3(1.0, 0.95, 0.75) * smoothstep(0.9965, 0.998, s);            // sun disc
        c = mix(c, vec3(1.0,0.88,0.6), smoothstep(0.998, 1.0, s));
        float st = step(0.9983, h(floor(d * 380.0))) * smoothstep(0.35, 0.8, y);
        c += st * (0.5 + 0.5 * sin(uTime * 2.0 + h(floor(d*380.0)) * 40.0)) * 0.7;
        if (y < 0.0) c = uHor;
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  scene.add(sky);

  /* ---------- sea ---------- */
  const seaU = {
    uTime: { value: 0 }, uCam: { value: new T.Vector3() }, uSun: { value: SUN },
    uShallow: { value: C.shallow }, uMid: { value: C.mid }, uDeep: { value: C.deep }, uFoam: { value: C.foam },
    uHor: { value: new T.Color(0xf08c76) }, uIslandR: { value: 15.5 }
  };
  const seaGeo = new T.PlaneGeometry(1600, 1600, small ? 160 : 260, small ? 160 : 260);
  seaGeo.rotateX(-Math.PI / 2);
  // denser grid near the island
  const sp = seaGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i) / 800, z = sp.getZ(i) / 800;
    sp.setX(i, Math.sign(x) * Math.pow(Math.abs(x), 1.8) * 800); sp.setZ(i, Math.sign(z) * Math.pow(Math.abs(z), 1.8) * 800);
  }
  const sea = new T.Mesh(seaGeo, new T.ShaderMaterial({
    uniforms: seaU,
    vertexShader: `uniform float uTime; varying vec3 vW; varying vec3 vN;
      float wv(vec2 p){ return sin(p.x*0.22 + uTime*1.1)*0.35 + sin(p.y*0.31 - uTime*0.9)*0.28 + sin((p.x+p.y)*0.5 + uTime*1.7)*0.12; }
      void main(){
        vec3 p = position; float e = 0.6;
        float y = wv(p.xz); float yx = wv(p.xz + vec2(e,0.0)); float yz = wv(p.xz + vec2(0.0,e));
        p.y += y; vW = p; vN = normalize(vec3(-(yx-y)/e, 1.0, -(yz-y)/e));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float uTime, uIslandR; uniform vec3 uCam, uSun, uShallow, uMid, uDeep, uFoam, uHor; varying vec3 vW; varying vec3 vN;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hh(i),hh(i+vec2(1,0)),f.x), mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float d = length(vW.xz) - uIslandR;
        vec3 c = mix(uShallow, uMid, smoothstep(0.5, 9.0, d));
        c = mix(c, uDeep, smoothstep(9.0, 70.0, d));
        // drifting cartoon foam lines
        float n = vn(vW.xz * 0.09 + vec2(uTime*0.05, -uTime*0.035)) * 0.65 + vn(vW.xz * 0.23 - uTime*0.06) * 0.35;
        float lines = smoothstep(0.015, 0.0, abs(n - 0.55)) * smoothstep(140.0, 30.0, length(vW.xz - uCam.xz));
        // shoreline surf rings
        float r1 = 1.0 - smoothstep(0.0, 0.7, abs(d - 0.9 - sin(uTime*1.4)*0.5));
        float r2 = (1.0 - smoothstep(0.0, 0.5, abs(d - 3.6 - sin(uTime*1.4 + 1.5)*0.7))) * 0.7;
        float foam = clamp(lines * 0.55 + (r1 + r2) * step(-0.2, d), 0.0, 1.0);
        c = mix(c, uFoam, foam);
        // stylised sun glitter
        vec3 V = normalize(uCam - vW); vec3 R = reflect(-V, normalize(vN));
        float s = pow(max(dot(R, uSun), 0.0), 60.0) * (0.55 + 0.9 * vn(vW.xz * 1.3 + uTime * 0.8));
        c = mix(c, vec3(1.0, 0.94, 0.72), step(0.55, s));
        float fog = smoothstep(120.0, 520.0, length(vW - uCam));
        c = mix(c, uHor, fog);
        gl_FragColor = vec4(c, 1.0);
      }`
  }));
  scene.add(sea);

  /* ---------- lights ---------- */
  scene.add(new T.HemisphereLight(0xffd9b8, 0x3a4f7a, 0.72));
  const sunLight = new T.DirectionalLight(0xffe2b8, 0.95);
  sunLight.position.set(SUN.x * 60 - 20, 55, 40);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
  sunLight.shadow.bias = -0.0015;
  scene.add(sunLight);

  /* ---------- island ---------- */
  const island = new T.Group(); scene.add(island);
  const prof = [[17, -1.6], [15.6, -0.2], [13.8, 0.8], [11.5, 1.6], [8, 2.0], [0.01, 2.1]].map(([r, y]) => new T.Vector2(r, y)); // bottom→top so faces point outward
  const sandGeo = new T.LatheGeometry(prof, 64);
  const sg = sandGeo.attributes.position;
  for (let i = 0; i < sg.count; i++) { // lumpy coastline
    const x = sg.getX(i), z = sg.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
    const k = 1 + Math.sin(a * 3) * 0.06 + Math.sin(a * 7 + 1) * 0.03;
    sg.setX(i, Math.cos(a) * r * k); sg.setZ(i, Math.sin(a) * r * k);
  }
  sandGeo.computeVertexNormals();
  const sand = K.mesh(sandGeo, 0xf3cf8e, { outline: false }); sand.receiveShadow = true; island.add(sand);
  const grassShape = new T.Shape();
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, r = 8.6 + Math.sin(a * 5) * 0.6 + Math.sin(a * 11) * 0.3; i ? grassShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : grassShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const grass = K.mesh(new T.ShapeGeometry(grassShape), 0x63c45a, { outline: false, rot: [-Math.PI / 2, 0, 0], pos: [-1, 2.12, 0] });
  grass.receiveShadow = true; island.add(grass);
  for (let i = 0; i < 26; i++) { // grass tufts
    const a = Math.random() * Math.PI * 2, r = Math.random() * 7.5;
    island.add(K.mesh(new T.ConeGeometry(0.25, 0.9, 4), i % 2 ? 0x4fae4a : 0x7bd36a, { outline: false, pos: [Math.cos(a) * r - 1, 2.5, Math.sin(a) * r], rot: [0, a, 0] }));
  }
  // rocks
  [[12, 0.6, 6, 1.6], [-13, 0.4, -4, 2.2], [9, 0.9, -10, 1.2], [-6, 1.2, 11.5, 1.4], [15, -0.2, -3, 1.0]].forEach(([x, y, z, s]) => {
    const r = K.mesh(new T.DodecahedronGeometry(s, 0), 0x8d8fa3, { pos: [x, y, z], rot: [x, z, 0], thick: 0.06, shadow: true });
    island.add(r);
  });

  // palms
  function palm(x, z, h, lean, turn) {
    const g = new T.Group(); g.position.set(x, 2.0, z); g.rotation.y = turn;
    let px = 0, py = 0;
    for (let i = 0; i < 8; i++) {
      const seg = K.mesh(K.cyl(0.32 - i * 0.02, 0.38 - i * 0.02, h / 8 + 0.05, 10), i % 2 ? 0x9a6a3e : 0x83552f, { pos: [px, py + h / 16, 0], rot: [0, 0, -lean * (i / 8)], thick: 0.04, shadow: true });
      g.add(seg); px += Math.sin(lean * (i / 8)) * (h / 8); py += Math.cos(lean * (i / 8)) * (h / 8);
    }
    const top = new T.Group(); top.position.set(px, py, 0); g.add(top);
    const leafShape = new T.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(2.2, 0.75, 4.6, 0); leafShape.quadraticCurveTo(2.2, -0.75, 0, 0);
    const lg = new T.ShapeGeometry(leafShape, 10); const lp = lg.attributes.position;
    for (let i = 0; i < lp.count; i++) { const lx = lp.getX(i); lp.setZ(i, -0.09 * lx * lx); }
    lg.rotateX(-Math.PI / 2); lg.computeVertexNormals();
    for (let i = 0; i < 8; i++) {
      const leaf = K.mesh(lg, i % 2 ? 0x3aa14a : 0x52bf55, { matOpts: { side: T.DoubleSide }, thick: 0.03, shadow: true });
      leaf.rotation.set(0, (i / 8) * Math.PI * 2, 0.35 + (i % 2) * 0.15); top.add(leaf);
    }
    [0, 2.1, 4.2].forEach((a) => top.add(K.mesh(K.sphere(0.32, 10, 8), 0x6b3f1d, { pos: [Math.cos(a) * 0.35, -0.3, Math.sin(a) * 0.35], thick: 0.03 })));
    g.userData.top = top; island.add(g); return g;
  }
  const palms = [palm(7.5, 3, 7.5, 0.5, 0.2), palm(5.5, -5.5, 6.2, 0.45, -1.2), palm(-8, 5, 6.8, 0.55, 2.6), palm(-9.5, -2.5, 5.4, 0.35, 3.6)];

  /* ---------- the Kaalchakra: a giant ship's wheel standing on a stone plinth ---------- */
  const monument = new T.Group(); monument.position.set(-1, 2.0, -1.5); island.add(monument);
  monument.add(K.mesh(K.box(7, 1.0, 3.4), 0xb3a596, { pos: [0, 0.5, 0], thick: 0.05, shadow: true }));
  monument.add(K.mesh(K.box(5.4, 0.8, 2.6), 0xc9bcae, { pos: [0, 1.4, 0], thick: 0.05, shadow: true }));
  [-2.2, 2.2].forEach((x) => monument.add(K.mesh(K.box(0.6, 3.6, 0.6), 0x8b5a2b, { pos: [x, 3.4, 0], thick: 0.05, shadow: true })));
  const wheel = new T.Group(); wheel.position.set(0, 7.2, 0); monument.add(wheel);
  const WOOD = 0x8b5222, GOLD = 0xf2c14e;
  wheel.add(K.mesh(new T.TorusGeometry(3.6, 0.42, 14, 64), WOOD, { thick: 0.06, shadow: true }));
  wheel.add(K.mesh(new T.TorusGeometry(3.6, 0.16, 8, 64), GOLD, { pos: [0, 0, 0.36], thick: 0.03 }));
  wheel.add(K.mesh(new T.TorusGeometry(1.5, 0.24, 10, 40), WOOD, { thick: 0.05 }));
  wheel.add(K.mesh(K.cyl(0.9, 0.9, 0.9, 24), GOLD, { rot: [Math.PI / 2, 0, 0], thick: 0.05 }));
  const hubFace = new T.Mesh(new T.CircleGeometry(0.8, 32), new T.MeshBasicMaterial({ color: 0xffe9a8 }));
  hubFace.position.z = 0.46; wheel.add(hubFace);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new T.Group(); spoke.rotation.z = a; wheel.add(spoke);
    spoke.add(K.mesh(K.cyl(0.17, 0.22, 3.3, 10), WOOD, { pos: [0, 2.35, 0], thick: 0.04, shadow: true }));
    spoke.add(K.mesh(K.sphere(0.34, 12, 10), WOOD, { pos: [0, 4.45, 0], scale: [1, 1.4, 1], thick: 0.04 }));
    spoke.add(K.mesh(K.capsule(0.2, 0.5), WOOD, { pos: [0, 5.15, 0], thick: 0.04 }));
    spoke.add(K.mesh(K.box(0.6, 0.3, 0.92), GOLD, { pos: [0, 3.6, 0], thick: 0.03 }));
  }
  // glowing time-ring with 12 hour marks
  const glowMat = new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  const ring = new T.Mesh(new T.TorusGeometry(6.3, 0.07, 6, 96), glowMat); ring.position.copy(wheel.position); monument.add(ring);
  const ticks = new T.Group(); ticks.position.copy(wheel.position); monument.add(ticks);
  for (let i = 0; i < 12; i++) { const m = new T.Mesh(K.box(0.14, 0.7, 0.05), glowMat); const a = (i / 12) * Math.PI * 2; m.position.set(Math.sin(a) * 6.3, Math.cos(a) * 6.3, 0); m.rotation.z = -a; ticks.add(m); }
  const haloTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128); grd.addColorStop(0, "rgba(255,226,140,.9)"); grd.addColorStop(0.4, "rgba(255,180,90,.35)"); grd.addColorStop(1, "rgba(255,150,80,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256); return new T.CanvasTexture(c);
  })();
  const halo = new T.Mesh(new T.PlaneGeometry(18, 18), new T.MeshBasicMaterial({ map: haloTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  halo.position.set(0, 7.2, -0.6); monument.add(halo);
  // magic motes rising around the wheel
  const MOTES = 70, mg = new T.BufferGeometry(), mpos = new Float32Array(MOTES * 3), mseed = [];
  for (let i = 0; i < MOTES; i++) { mseed.push([Math.random() * Math.PI * 2, 3 + Math.random() * 5, Math.random() * 10]); }
  mg.setAttribute("position", new T.BufferAttribute(mpos, 3));
  const motes = new T.Points(mg, new T.PointsMaterial({ color: 0xffe9a0, size: 0.35, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
  monument.add(motes);

  // treasure pile + chest by the wheel
  const chest = K.chest(); chest.position.set(4.2, 2.0, 3.2); chest.rotation.y = -0.6; chest.scale.setScalar(1.2);
  chest.userData.lid.rotation.x = -1.0; chest.traverse((o) => { if (o.isMesh) o.castShadow = true; }); island.add(chest);
  for (let i = 0; i < 26; i++) {
    const c = new T.Mesh(K.coinGeo, K.coinMat); const a = Math.random() * Math.PI * 2, r = Math.random() * 1.6;
    c.position.set(4.2 + Math.cos(a) * r + 0.9, 2.12 + Math.random() * 0.15, 3.2 + Math.sin(a) * r + 0.8);
    c.rotation.set(Math.random() * 0.5, 0, Math.random() * 0.5); island.add(c);
  }
  // barrels + dock
  [[-4.6, 4.8], [-3.6, 5.7]].forEach(([x, z], i) => {
    const b = K.mesh(K.cyl(0.62, 0.62, 1.4, 14), 0x9a5f2c, { pos: [x, 2.7, z], thick: 0.04, shadow: true });
    b.add(K.mesh(new T.TorusGeometry(0.64, 0.06, 6, 20), 0x4a4a52, { rot: [Math.PI / 2, 0, 0], pos: [0, 0.4, 0], outline: false }));
    b.add(K.mesh(new T.TorusGeometry(0.64, 0.06, 6, 20), 0x4a4a52, { rot: [Math.PI / 2, 0, 0], pos: [0, -0.4, 0], outline: false }));
    island.add(b);
  });
  const dock = new T.Group(); dock.position.set(13, 1.1, 5); dock.rotation.y = -0.25; island.add(dock);
  for (let i = 0; i < 9; i++) dock.add(K.mesh(K.box(1.0, 0.22, 3.2), i % 2 ? 0xa8713d : 0x96612f, { pos: [i * 1.05, 0, 0], thick: 0.03, shadow: true }));
  [0, 4, 8].forEach((x) => [-1.4, 1.4].forEach((z) => dock.add(K.mesh(K.cyl(0.18, 0.18, 3.4, 8), 0x6e4522, { pos: [x, -1.4, z], thick: 0.03 }))));

  /* ---------- pirate ship at anchor ---------- */
  function sailTexture(main) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#f7ecd6"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(140,110,70,.35)"; g.lineWidth = 3; for (let x = 32; x < 256; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    if (main) {
      g.translate(128, 128); g.strokeStyle = "#c8372d"; g.fillStyle = "#c8372d"; g.lineWidth = 12;
      g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-5, 20, 10, 66); g.beginPath(); g.arc(0, 92, 10, 0, Math.PI * 2); g.fill(); }
    }
    return new T.CanvasTexture(c);
  }
  const ship = new T.Group(); ship.position.set(20, 0, -24); ship.rotation.y = -0.35; scene.add(ship);
  (function buildShip() {
    const hs = new T.Shape();
    hs.moveTo(-7, 1.2); hs.quadraticCurveTo(-6.8, -1.6, -3, -2.2); hs.lineTo(4.5, -2.2); hs.quadraticCurveTo(8, -1.5, 9.5, 2.2);
    hs.lineTo(6.5, 2.0); hs.lineTo(-4.8, 2.0); hs.lineTo(-5.2, 3.8); hs.lineTo(-8, 4.0); hs.closePath();
    const hull = new T.ExtrudeGeometry(hs, { depth: 4.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.4, bevelSegments: 3, curveSegments: 16 });
    hull.translate(0, 0, -2.3);
    ship.add(K.mesh(hull, 0x7a4320, { thick: 0.08, shadow: true }));
    const stripe = new T.ExtrudeGeometry((() => { const s = new T.Shape(); s.moveTo(-6.9, 0.5); s.lineTo(8.6, 0.5); s.lineTo(8.9, 1.1); s.lineTo(-6.9, 1.1); s.closePath(); return s; })(), { depth: 5.85, bevelEnabled: false });
    stripe.translate(0, 0, -2.92); ship.add(K.mesh(stripe, 0xf2c14e, { outline: false }));
    for (let i = 0; i < 5; i++) [-1, 1].forEach((sz) => ship.add(K.mesh(K.cyl(0.32, 0.32, 0.3, 12), 0x1d1410, { pos: [-3.5 + i * 2.4, -0.4, sz * 2.95], rot: [Math.PI / 2, 0, 0], outline: false })));
    ship.add(K.mesh(K.box(13.5, 0.3, 4.2), 0xc08a52, { pos: [0.5, 2.0, 0], outline: false }));
    const mastMat = 0x5c3517;
    [[3.5, 15, 1], [-1.8, 17, 1], [-6.2, 11, 0]].forEach(([x, h, main], mi) => {
      ship.add(K.mesh(K.cyl(0.22, 0.32, h, 10), mastMat, { pos: [x, 2 + h / 2, 0], thick: 0.05, shadow: true }));
      const tiers = mi === 1 ? 3 : 2;
      for (let t = 0; t < tiers; t++) {
        const w = 6.6 - t * 1.5, sh = 3.6 - t * 0.6, y = 5.6 + t * 3.9 + (mi === 1 ? 0.7 : 0);
        const g = new T.PlaneGeometry(w, sh, 12, 6), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5, v = p.getY(i) / sh + 0.5; p.setZ(i, Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.9 + 0.15) * 1.3); }
        g.computeVertexNormals(); g.rotateY(Math.PI / 2);
        const sail = new T.Mesh(g, K.mat(0xffffff, { side: T.DoubleSide, map: sailTexture(t === 0 && mi === 1) }));
        sail.castShadow = true; sail.position.set(x + 0.4, y, 0); ship.add(sail);
        ship.add(K.mesh(K.cyl(0.12, 0.12, w + 0.6, 6), mastMat, { pos: [x, y + sh / 2, 0], rot: [Math.PI / 2, 0, 0], outline: false }));
      }
    });
    const flagC = document.createElement("canvas"); flagC.width = 128; flagC.height = 80; const fg = flagC.getContext("2d");
    fg.fillStyle = "#14100d"; fg.fillRect(0, 0, 128, 80); fg.strokeStyle = "#f2c14e"; fg.lineWidth = 6; fg.beginPath(); fg.arc(64, 40, 22, 0, Math.PI * 2); fg.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; fg.beginPath(); fg.moveTo(64, 40); fg.lineTo(64 + Math.cos(a) * 32, 40 + Math.sin(a) * 32); fg.stroke(); }
    const flag = new T.Mesh(new T.PlaneGeometry(3, 1.9, 8, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(flagC), side: T.DoubleSide }));
    flag.position.set(-1.8 - 1.5, 19.6, 0); flag.rotation.y = Math.PI / 2; ship.add(flag); ship.userData.flag = flag;
    const nest = K.mesh(K.cyl(0.8, 0.6, 0.8, 12), mastMat, { pos: [-1.8, 15.4, 0], thick: 0.04 }); ship.add(nest);
    const sprit = K.mesh(K.cyl(0.16, 0.2, 6, 8), mastMat, { pos: [10.5, 3.6, 0], rot: [0, 0, -1.15], outline: false }); ship.add(sprit);
    const lantern = new T.Mesh(K.sphere(0.35, 10, 8), new T.MeshBasicMaterial({ color: 0xffd27a })); lantern.position.set(-8, 4.6, 0); ship.add(lantern);
  })();

  /* ---------- distant islands + clouds + gulls ---------- */
  [[-160, -260, 26, 0x7a6aa8], [120, -330, 34, 0x8d72a6], [260, -240, 20, 0x9b7aa6], [-300, -200, 18, 0x8a6f9e]].forEach(([x, z, s, c]) => {
    const m = new T.Mesh(new T.ConeGeometry(s * 2.2, s * 0.6, 9), new T.MeshBasicMaterial({ color: c })); m.position.set(x, s * 0.3 - 2, z); scene.add(m);
  });
  const cloudMat = new T.MeshToonMaterial({ color: 0xffd1c2, gradientMap: K.gradient, emissive: 0x6b2c4a });
  for (let i = 0; i < 9; i++) {
    const cl = new T.Group(); const a = -Math.PI * 0.85 + (i / 9) * Math.PI * 0.75;
    cl.position.set(Math.cos(a) * 420, 70 + Math.random() * 70, Math.sin(a) * 420);
    for (let j = 0; j < 5; j++) { const s = new T.Mesh(K.sphere(10 + Math.random() * 8, 14, 10), cloudMat); s.position.set((j - 2) * 13, Math.random() * 6, Math.random() * 6); s.scale.y = 0.6; cl.add(s); }
    cl.lookAt(0, cl.position.y, 0); scene.add(cl);
  }
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const g = new T.Group();
    const wingGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, -0.25), new T.Vector3(0, 0, 0.25), new T.Vector3(1.6, 0.1, 0)]);
    wingGeo.computeVertexNormals();
    const wm = new T.MeshBasicMaterial({ color: 0xfaf6ef, side: T.DoubleSide });
    const l = new T.Mesh(wingGeo, wm), r = new T.Mesh(wingGeo, wm); r.scale.x = -1; g.add(l, r);
    g.userData = { l, r, rad: 18 + Math.random() * 16, h: 16 + Math.random() * 10, sp: 0.18 + Math.random() * 0.12, ph: Math.random() * 6 };
    scene.add(g); gulls.push(g);
  }

  /* ---------- camera / layout ---------- */
  const look = new T.Vector3(); const base = new T.Vector3();
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (camera.aspect < 0.9) { camera.fov = 52; base.set(-1, 17, 64); look.set(-1, 11, 0); }
    else { camera.fov = 36; const k = Math.min(1.4, camera.aspect / 1.6); base.set(-16 * k, 13, 58); look.set(-17 * k, 7.5, 0); }
    camera.updateProjectionMatrix();
    if (!running) render(0);
  }
  let mx = 0, my = 0, cmx = 0, cmy = 0, scrollY = 0;
  window.addEventListener("pointermove", (e) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });
  window.addEventListener("scroll", () => { scrollY = window.scrollY; if (!running) render(0); }, { passive: true });

  let t = 4;
  function render(dt) {
    t += dt;
    seaU.uTime.value = t; sky.material.uniforms.uTime.value = t;
    cmx += (mx - cmx) * 0.04; cmy += (my - cmy) * 0.04;
    const orbit = reduce ? 0 : Math.sin(t * 0.06) * 0.08;
    const s = Math.min(1, scrollY / (window.innerHeight || 1));
    camera.position.set(base.x * Math.cos(orbit) + base.z * Math.sin(orbit) + cmx * 6, base.y - cmy * 3 + s * 10, base.z * Math.cos(orbit) - base.x * Math.sin(orbit) + s * 10);
    camera.lookAt(look.x, look.y + s * 2, look.z);
    seaU.uCam.value.copy(camera.position);
    sky.position.copy(camera.position);
    wheel.rotation.z = -t * 0.18; ticks.rotation.z = t * 0.05;
    glowMat.opacity = 0.65 + Math.sin(t * 2) * 0.2;
    halo.material.opacity = 0.75 + Math.sin(t * 1.3) * 0.2;
    const mp = mg.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      const [a, r, o] = mseed[i]; const life = (t * 0.6 + o) % 10;
      mp.setXYZ(i, Math.cos(a + t * 0.2) * r * 0.9, 2 + life * 1.2, Math.sin(a + t * 0.2) * r * 0.45);
    }
    mp.needsUpdate = true;
    ship.position.y = Math.sin(t * 0.9) * 0.35 - 0.6; ship.rotation.z = Math.sin(t * 0.7) * 0.035; ship.rotation.x = Math.sin(t * 0.8 + 1) * 0.02;
    ship.userData.flag.rotation.x = Math.sin(t * 4) * 0.12;
    palms.forEach((p, i) => { p.userData.top.rotation.z = Math.sin(t * 1.2 + i) * 0.04; p.userData.top.rotation.x = Math.cos(t * 0.9 + i) * 0.03; });
    gulls.forEach((g) => {
      const u = g.userData, a = t * u.sp + u.ph;
      g.position.set(Math.cos(a) * u.rad + 2, u.h + Math.sin(a * 2) * 1.5, Math.sin(a) * u.rad * 0.6);
      g.rotation.y = -a; const f = Math.sin(t * 7 + u.ph) * 0.5; u.l.rotation.z = f; u.r.rotation.z = -f;
    });
    renderer.render(scene, camera);
  }

  const clock = new T.Clock();
  let running = false, visible = true, raf = 0;
  function frame() { if (!running) return; render(Math.min(clock.getDelta(), 0.05)); raf = requestAnimationFrame(frame); }
  function setRunning(on) {
    on = on && visible && !document.hidden && !reduce;
    if (on === running) return; running = on;
    if (on) { clock.getDelta(); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  }
  window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window && hero) new IntersectionObserver((es) => { visible = es[0].isIntersecting; setRunning(true); }).observe(hero);
  document.addEventListener("visibilitychange", () => setRunning(true));
  resize(); render(0); setRunning(true);
  requestAnimationFrame(() => canvas.classList.add("ready"));
})();
