/* Kaalchakra 2.0 — hero scene: a moonlit sea seen from the stern deck,
   with the Kaalchakra helm in the foreground and a galleon on the horizon.
   Everything is procedural (no image files). Requires three.js r128 (global THREE). */
(function () {
  "use strict";
  const canvas = document.getElementById("sea");
  const hero = document.querySelector(".hero");
  const fail = () => document.documentElement.classList.add("no-webgl");
  if (!canvas || !window.THREE) return fail();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) { return fail(); }
  if (!renderer.getContext()) return fail();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
  const MOON = new THREE.Vector3(0.16, 0.2, -1).normalize();

  /* ---------------- shared GLSL ---------------- */
  const SKY_GLSL = `
    uniform vec3 uMoon;
    vec3 skyColor(vec3 d){
      float h = clamp(d.y, 0.0, 1.0);
      vec3 zen = vec3(0.004, 0.012, 0.030);
      vec3 hor = vec3(0.060, 0.135, 0.180);
      vec3 c = mix(hor, zen, pow(h, 0.5));
      float m = max(dot(d, uMoon), 0.0);
      c += vec3(0.45, 0.55, 0.70) * pow(m, 8.0) * 0.09;
      c += vec3(0.95, 0.88, 0.70) * pow(m, 90.0) * 0.45;
      c += vec3(0.30, 0.14, 0.05) * exp(-abs(d.y) * 16.0) * (0.12 + 0.5 * pow(m, 3.0));
      if (d.y < 0.0) c = mix(hor, hor * 0.55, clamp(-d.y * 6.0, 0.0, 1.0));
      return c;
    }`;
  const NOISE_GLSL = `
    float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }`;

  /* ---------------- sky ---------------- */
  const skyUniforms = { uMoon: { value: MOON }, uTime: { value: 0 } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform float uTime; varying vec3 vDir; ${SKY_GLSL} ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = skyColor(d);
        if (d.y > 0.0) {
          vec3 p = d * 420.0; vec3 id = floor(p); float h = hash3(id);
          float tw = 0.55 + 0.45 * sin(uTime * 1.7 + h * 80.0);
          float star = step(0.9972, h) * smoothstep(0.55, 0.0, length(fract(p) - 0.5)) * tw;
          c += vec3(0.80, 0.86, 1.0) * star * smoothstep(0.02, 0.3, d.y) * 1.3;
          vec2 uv = d.xz / (d.y + 0.14) * 1.25 + vec2(uTime * 0.006, uTime * 0.002);
          float cl = smoothstep(0.48, 0.86, fbm(uv)) * smoothstep(0.0, 0.25, d.y);
          float lit = pow(max(dot(d, uMoon), 0.0), 10.0);
          c = mix(c, vec3(0.025, 0.04, 0.055) + vec3(0.24, 0.26, 0.30) * lit, cl * 0.55);
        }
        float md = dot(d, uMoon);
        float disc = smoothstep(0.99935, 0.99952, md);
        float crater = 0.85 + 0.15 * vnoise(d.xy * 900.0);
        c = mix(c, vec3(1.0, 0.95, 0.84) * 2.4 * crater, disc);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMat);
  scene.add(sky);

  /* ---------------- ocean (Gerstner waves) ---------------- */
  const WAVES = [ // dirX, dirZ, steepness, wavelength
    [1.0, 0.25, 0.16, 46], [0.55, 1.0, 0.13, 24], [-0.45, 0.85, 0.11, 13],
    [0.9, -0.55, 0.08, 7.0], [-0.7, -0.5, 0.06, 3.6]
  ];
  const waveUniform = WAVES.map((w) => new THREE.Vector4(w[0], w[1], w[2], w[3]));
  const seaUniforms = { uTime: { value: 0 }, uMoon: { value: MOON }, uCam: { value: new THREE.Vector3() }, uWaves: { value: waveUniform } };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: seaUniforms,
    vertexShader: `
      uniform float uTime; uniform vec4 uWaves[5];
      varying vec3 vWorld; varying vec3 vN; varying float vH;
      vec3 gerstner(vec4 w, vec3 p, inout vec3 T, inout vec3 B){
        float k = 6.2831853 / w.w; float c = sqrt(9.8 / k); vec2 d = normalize(w.xy);
        float f = k * (dot(d, p.xz) - c * uTime); float a = w.z / k; float s = sin(f), co = cos(f);
        T += vec3(-d.x*d.x*(w.z*s), d.x*(w.z*co), -d.x*d.y*(w.z*s));
        B += vec3(-d.x*d.y*(w.z*s), d.y*(w.z*co), -d.y*d.y*(w.z*s));
        return vec3(d.x*(a*co), a*s, d.y*(a*co));
      }
      void main(){
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 T = vec3(1.0, 0.0, 0.0), B = vec3(0.0, 0.0, 1.0), q = p;
        for (int i = 0; i < 5; i++) q += gerstner(uWaves[i], p, T, B);
        vN = normalize(cross(B, T)); vH = q.y; vWorld = q;
        gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uCam;
      varying vec3 vWorld; varying vec3 vN; varying float vH;
      ${SKY_GLSL}
      void main(){
        vec3 N = normalize(vN);
        float dist = length(vWorld - uCam);
        vec2 q = vWorld.xz;
        float a1 = q.x * 1.9 + q.y * 0.4 + uTime * 1.6, a2 = q.y * 2.6 - q.x * 0.7 - uTime * 1.3, a3 = (q.x + q.y) * 4.3 + uTime * 2.4;
        vec2 g = vec2(cos(a1) * 1.9 - cos(a2) * 0.7 + cos(a3) * 4.3, cos(a1) * 0.4 + cos(a2) * 2.6 + cos(a3) * 4.3);
        N = normalize(N + vec3(-g.x, 0.0, -g.y) * 0.022 * exp(-dist * 0.018));
        vec3 V = normalize(uCam - vWorld);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = skyColor(R);
        vec3 deep = vec3(0.002, 0.014, 0.022);
        vec3 scatter = vec3(0.0, 0.055, 0.065) * clamp(vH * 0.5 + 0.35, 0.0, 1.0);
        vec3 col = mix(deep + scatter, refl, fres);
        float sp = max(dot(R, uMoon), 0.0);
        col += vec3(1.0, 0.92, 0.76) * (pow(sp, 900.0) * 9.0 + pow(sp, 80.0) * 0.35 + pow(sp, 12.0) * 0.03);
        float foam = smoothstep(1.25, 2.1, vH) * exp(-dist * 0.012);
        col = mix(col, vec3(0.42, 0.47, 0.50), foam * 0.35);
        vec3 fogC = skyColor(normalize(vec3(-V.x, 0.015, -V.z)));
        float fog = 1.0 - exp(-pow(dist * 0.0042, 1.5));
        col = mix(col, fogC, clamp(fog, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });
  // Grid that is dense near the camera and sparse toward the horizon
  const SEG = lowPower ? 200 : 300;
  const seaGeo = new THREE.PlaneGeometry(2, 2, SEG, SEG);
  seaGeo.rotateX(-Math.PI / 2);
  const pos = seaGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setX(i, Math.sign(x) * Math.pow(Math.abs(x), 2.4) * 900);
    pos.setZ(i, Math.sign(z) * Math.pow(Math.abs(z), 2.4) * 900);
  }
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.frustumCulled = false;
  scene.add(sea);

  // CPU copy of the waves so floating things ride the same swell
  function waveAt(x, z, t) {
    let px = x, py = 0, pz = z;
    for (const w of WAVES) {
      const k = (Math.PI * 2) / w[3], c = Math.sqrt(9.8 / k), l = Math.hypot(w[0], w[1]);
      const dx = w[0] / l, dz = w[1] / l, f = k * (dx * x + dz * z - c * t), a = w[2] / k;
      px += dx * a * Math.cos(f); py += a * Math.sin(f); pz += dz * a * Math.cos(f);
    }
    return py;
  }

  /* ---------------- procedural textures ---------------- */
  function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function woodTexture(w, h, base, dark, planks) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), r = rand(planks ? 7 : 3);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // grain lines
      const y = r() * h, amp = 2 + r() * 6, len = r() * w;
      g.strokeStyle = `rgba(${dark},${0.08 + r() * 0.22})`; g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath(); g.moveTo(-10, y);
      for (let x = 0; x < w + 10; x += 24) g.lineTo(x, y + Math.sin(x / len * 6 + i) * amp);
      g.stroke();
    }
    for (let i = 0; i < 18; i++) { // knots
      const x = r() * w, y = r() * h, rr = 3 + r() * 9;
      const grd = g.createRadialGradient(x, y, 0, x, y, rr * 2.2);
      grd.addColorStop(0, `rgba(${dark},.55)`); grd.addColorStop(1, `rgba(${dark},0)`);
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rr * 2.4, rr, 0, 0, Math.PI * 2); g.fill();
    }
    if (planks) {
      for (let y = 0; y < h; y += h / 8) { g.fillStyle = `rgba(${dark},.75)`; g.fillRect(0, y, w, 3); }
      for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(${dark},.6)`; g.fillRect(r() * w, Math.floor(r() * 8) * h / 8, 3, h / 8); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  /* ---------------- environment for metal reflections ---------------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat.clone());
  envSky.material.uniforms = { uMoon: { value: MOON }, uTime: { value: 0 } };
  envScene.add(envSky);
  const warm = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffa860 }));
  warm.position.set(60, 18, 50); envScene.add(warm); // a lantern for brass to catch
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  /* ---------------- lights ---------------- */
  const moonLight = new THREE.DirectionalLight(0xc4d4ff, 1.15);
  moonLight.position.copy(MOON).multiplyScalar(60);
  scene.add(moonLight);
  scene.add(new THREE.HemisphereLight(0x29465c, 0x060708, 0.55));
  const lantern = new THREE.PointLight(0xffa155, 2.6, 16, 2);
  scene.add(lantern);

  /* ---------------- materials ---------------- */
  const woodMap = woodTexture(1024, 256, "#6b4020", "38,18,6", false);
  woodMap.repeat.set(1, 1);
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.48, metalness: 0.0, envMapIntensity: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9973f, roughness: 0.3, metalness: 1.0, envMapIntensity: 1.6 });
  const deckMap = woodTexture(1024, 1024, "#3b2512", "20,10,3", true);
  deckMap.repeat.set(3, 1.4);
  const deckWood = new THREE.MeshStandardMaterial({ map: deckMap, roughness: 0.8, color: 0x8c7b6c, envMapIntensity: 0.25 });
  const railWood = new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.55, color: 0xb08a6a });

  /* ---------------- the Kaalchakra helm ---------------- */
  const helm = new THREE.Group();     // positioned in the scene
  const wheel = new THREE.Group();    // spins
  helm.add(wheel);

  const rimR = 2.0;
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.13, 28, 200), wood));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(rimR - 0.16, 0.035, 12, 200), brass));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.075, 20, 120), wood));

  // turned spoke profile (radius along the spoke's length), revolved with LatheGeometry
  const prof = [
    [0.0, 0.35], [0.085, 0.36], [0.075, 0.6], [0.095, 0.8], [0.11, 1.0], [0.095, 1.2], [0.075, 1.45], [0.07, 1.85],
    [0.062, 2.12], [0.07, 2.2], [0.06, 2.28], [0.085, 2.38], [0.1, 2.5], [0.085, 2.62], [0.05, 2.7], [0.058, 2.76],
    [0.09, 2.84], [0.1, 2.93], [0.07, 3.0], [0.0, 3.03]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const spokeGeo = new THREE.LatheGeometry(prof, 28);
  const bandGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 24, 1, true);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = new THREE.Mesh(spokeGeo, wood);
    s.rotation.z = a; wheel.add(s);
    const b = new THREE.Mesh(bandGeo, brass); // brass band where spoke meets rim
    b.position.set(-Math.sin(a) * rimR, Math.cos(a) * rimR, 0); b.rotation.z = a; wheel.add(b);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.42, 64), brass);
  hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 12, 64), brass);
  hubRing.position.z = 0.21; wheel.add(hubRing);

  // engraved hub plate
  const plateCanvas = document.createElement("canvas"); plateCanvas.width = plateCanvas.height = 512;
  const plateTex = new THREE.CanvasTexture(plateCanvas); plateTex.encoding = THREE.sRGBEncoding;
  function drawPlate() {
    const g = plateCanvas.getContext("2d"), c = 256;
    const grd = g.createRadialGradient(190, 170, 20, c, c, 260);
    grd.addColorStop(0, "#f4d998"); grd.addColorStop(0.55, "#c4923e"); grd.addColorStop(1, "#6e4a16");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(60,36,8,.7)"; g.lineWidth = 6;
    g.beginPath(); g.arc(c, c, 236, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(c, c, 160, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 24; i++) { // hour ticks: the wheel of time
      const a = i / 24 * Math.PI * 2, r1 = 168, r2 = i % 2 ? 182 : 196;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke();
    }
    g.fillStyle = "rgba(55,32,6,.85)"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = '120px "Tiro Devanagari Hindi", "Noto Serif Devanagari", serif';
    g.fillText("काल", c, c - 40);
    g.font = '70px "IM Fell English SC", Georgia, serif';
    g.fillText("2.0", c, c + 70);
    plateTex.needsUpdate = true;
  }
  drawPlate();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('120px "Tiro Devanagari Hindi"'), document.fonts.load('70px "IM Fell English SC"')])
      .then(drawPlate).catch(() => {});
  }
  const plate = new THREE.Mesh(new THREE.CircleGeometry(0.44, 64),
    new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.3 }));
  plate.position.z = 0.215; wheel.add(plate);

  // axle + pedestal (binnacle)
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 20), brass);
  axle.rotation.x = Math.PI / 2; axle.position.z = -0.45; helm.add(axle);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.62, 3.2, 0.7), railWood);
  post.position.set(0, -1.75, -0.95); helm.add(post);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.88), wood);
  cap.position.set(0, -0.1, -0.95); helm.add(cap);
  scene.add(helm);

  /* ---------------- deck & stern rail ---------------- */
  // built with the deck surface at y = 0; resize() lifts it to sit under the helm, well above the waterline
  const deck = new THREE.Group();
  const RAIL_Z = 0.6;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 12.5), deckWood);
  floor.position.set(0, -0.15, 6.6); deck.add(floor);
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(26, 0.16, 0.34), railWood);
  railTop.position.set(0, 1.27, RAIL_Z); deck.add(railTop);
  const balGeo = new THREE.LatheGeometry([[0.0, 0], [0.09, 0], [0.09, 0.12], [0.055, 0.3], [0.1, 0.75], [0.055, 1.25], [0.08, 1.55], [0.08, 1.95], [0, 1.95]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 12);
  for (let x = -12.6; x <= 12.6; x += 0.62) {
    const b = new THREE.Mesh(balGeo, railWood); b.position.set(x, 0, RAIL_Z); b.scale.y = 0.62; deck.add(b);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc27a }));
  deck.add(lamp);
  scene.add(deck);

  /* ---------------- galleon on the horizon ---------------- */
  function makeShip() {
    const ship = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x1d130c, roughness: 0.85 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xb9a681, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x0d0904 });
    const s = new THREE.Shape();
    s.moveTo(-5.4, -0.4); s.quadraticCurveTo(0, -1.9, 5.6, -0.3); s.lineTo(7.4, 1.5); s.lineTo(5.8, 1.25);
    s.lineTo(-3.4, 1.15); s.lineTo(-3.9, 2.5); s.lineTo(-6.1, 2.75); s.lineTo(-6.3, 1.5); s.closePath();
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.55, bevelSize: 0.35, bevelSegments: 3, curveSegments: 18 }), hullMat);
    hull.geometry.translate(0, 0, -1.1); ship.add(hull);
    const mastGeo = new THREE.CylinderGeometry(0.09, 0.13, 1, 8);
    [[3.2, 10], [0.2, 12.5], [-3.2, 9]].forEach(([x, h], mi) => {
      const m = new THREE.Mesh(mastGeo, hullMat); m.scale.y = h; m.position.set(x, 1 + h / 2, 0); ship.add(m);
      const tiers = mi === 1 ? 3 : 2;
      for (let t = 0; t < tiers; t++) {
        const w = (3.8 - t * 0.9) * (mi === 1 ? 1.1 : 1), sh = 2.4 - t * 0.35;
        const g = new THREE.PlaneGeometry(w, sh, 10, 6);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const u = p.getX(i) / w + 0.5, v = p.getY(i) / sh + 0.5;
          p.setZ(i, Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.9 + 0.2) * 0.75);
        }
        g.computeVertexNormals(); g.rotateY(Math.PI / 2);
        const sail = new THREE.Mesh(g, sailMat);
        sail.position.set(x + 0.2, 2.6 + t * 2.75 + (mi === 1 ? 0.6 : 0), 0); ship.add(sail);
      }
    });
    const sprit = new THREE.Mesh(mastGeo, hullMat); sprit.scale.y = 5; sprit.rotation.z = -1.15; sprit.position.set(8.6, 2.5, 0); ship.add(sprit);
    const jib = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(3.2, 9, 0), new THREE.Vector3(10.4, 3.4, 0), new THREE.Vector3(3.4, 2.4, 0)]), sailMat);
    jib.geometry.computeVertexNormals(); ship.add(jib);
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ color: 0xc86a1e, side: THREE.DoubleSide }));
    pennant.position.set(-0.6, 14.1, 0); ship.add(pennant);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffb066 });
    [[-6.0, 2.2, 1.5], [-6.0, 2.2, -1.5], [-2, 1.0, 1.5], [1.5, 0.9, 1.5]].forEach(([x, y, z]) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow); l.position.set(x, y, z); ship.add(l);
    });
    const shipLight = new THREE.PointLight(0xff9a4a, 3, 30, 2); shipLight.position.set(-6.2, 3, 2.5); ship.add(shipLight);
    return ship;
  }
  const ship = makeShip();
  scene.add(ship);
  const shipState = { x: -4, z: -140 };

  /* ---------------- sea spray motes ---------------- */
  const MOTES = lowPower ? 140 : 260;
  const moteGeo = new THREE.BufferGeometry();
  const mp = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) { mp[i * 3] = (Math.random() - 0.5) * 30; mp[i * 3 + 1] = 2 + Math.random() * 8; mp[i * 3 + 2] = -Math.random() * 30 + 4; }
  moteGeo.setAttribute("position", new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xbfd2d8, size: 0.045, transparent: true, opacity: 0.35, depthWrite: false }));
  scene.add(motes);

  /* ---------------- layout ---------------- */
  const layout = { helmPos: new THREE.Vector3(), helmScale: 1, camPos: new THREE.Vector3(), look: new THREE.Vector3() };
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // The camera stands on the stern deck ~6 m above the sea.
    if (aspect < 0.9) { // phones: helm low and centred under the copy
      camera.fov = 62;
      layout.camPos.set(0, 6.0, 11);
      layout.look.set(0, 4.3, -30);
      layout.helmPos.set(0.7, 2.9, 5.6);
      layout.helmScale = 0.62;
    } else {
      camera.fov = aspect > 1.9 ? 40 : 45;
      layout.camPos.set(0, 6.0, 11);
      layout.look.set(0, 4.6, -30);
      layout.helmPos.set(2.05 * Math.min(1.3, aspect / 1.6), 4.55, 5.6);
      layout.helmScale = 0.64;
    }
    helm.position.copy(layout.helmPos);
    helm.scale.setScalar(layout.helmScale);
    helm.rotation.set(-0.08, -0.32, 0);
    const deckTop = layout.helmPos.y - 3.35 * layout.helmScale; // bottom of the helm's pedestal
    deck.position.y = deckTop;
    lantern.position.set(layout.helmPos.x + 2.4, layout.helmPos.y + 1.6, layout.helmPos.z + 1.8);
    lamp.position.set(layout.helmPos.x + 2.6, 1.5, RAIL_Z);
    camera.updateProjectionMatrix();
    if (!running) renderOnce();
  }

  /* ---------------- interaction: drag the wheel, scroll turns it ---------------- */
  let spin = 0, vel = 0, dragging = false, lastX = 0, lastT = 0;
  const pointer = { x: 0, y: 0 }, cam = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastT = performance.now(); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - lastX;
    spin -= dx * 0.006; vel = -dx * 0.006 / Math.max(16, now - lastT) * 16;
    lastX = e.clientX; lastT = now;
    if (!running) renderOnce();
  });
  const release = () => { dragging = false; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  let scrollSpin = 0;
  window.addEventListener("scroll", () => { scrollSpin = -window.scrollY * 0.0028; if (!running) renderOnce(); }, { passive: true });

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  let t = 8, running = false, visible = true, raf = 0;
  function update(dt) {
    t += dt;
    skyUniforms.uTime.value = t; seaUniforms.uTime.value = t;
    // camera bob + gentle parallax
    cam.x += (pointer.x * 0.35 - cam.x) * 0.04; cam.y += (-pointer.y * 0.18 - cam.y) * 0.04;
    const roll = reduce ? 0 : Math.sin(t * 0.55) * 0.012;
    camera.position.set(layout.camPos.x + cam.x, layout.camPos.y + cam.y + (reduce ? 0 : Math.sin(t * 0.7) * 0.06), layout.camPos.z);
    camera.lookAt(layout.look); camera.rotateZ(roll);
    seaUniforms.uCam.value.copy(camera.position);
    sky.position.copy(camera.position);
    // wheel: inertia + scroll + idle sway
    if (!dragging) { spin += vel; vel *= 0.94; }
    const sway = reduce ? 0 : Math.sin(t * 0.45) * 0.22;
    wheel.rotation.z = spin + scrollSpin + sway;
    // lantern flicker
    lantern.intensity = 2.4 + (reduce ? 0 : Math.sin(t * 13.1) * 0.12 + Math.sin(t * 7.3) * 0.18);
    // galleon rides the swell and crosses the horizon
    if (!reduce) shipState.x += dt * 1.1;
    if (shipState.x > 90) shipState.x = -90;
    const sx = shipState.x, sz = shipState.z;
    const y = waveAt(sx, sz, t), yf = waveAt(sx + 5, sz, t), yb = waveAt(sx - 5, sz, t), ys = waveAt(sx, sz + 2, t);
    ship.position.set(sx, y - 0.2, sz);
    ship.rotation.set(Math.atan2(ys - y, 2) * 0.6, 0.22, Math.atan2(yf - yb, 10));
    // motes drift
    if (!reduce) {
      const p = moteGeo.attributes.position;
      for (let i = 0; i < MOTES; i++) {
        let x = p.getX(i) + dt * 0.35, yy = p.getY(i) + Math.sin(t + i) * dt * 0.05;
        if (x > 15) x = -15;
        p.setXY(i, x, yy);
      }
      p.needsUpdate = true;
    }
  }
  function renderOnce() { update(0); renderer.render(scene, camera); }
  function frame() {
    if (!running) return;
    update(Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function setRunning(on) {
    on = on && visible && !document.hidden && !reduce;
    if (on === running) return;
    running = on;
    if (on) { clock.getDelta(); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  }

  resize();
  window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; setRunning(true); }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener("visibilitychange", () => setRunning(!document.hidden));
  renderOnce();
  setRunning(true);
  // reduced motion still gets a still, fully lit frame (and responds to drag/scroll)
  requestAnimationFrame(() => { renderOnce(); canvas.classList.add("ready"); });
})();
