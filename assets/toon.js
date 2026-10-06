/* Kaalchakra 2.0 — toon toolkit: cel-shaded materials, ink outlines, rigged chibi characters and props.
   Everything is procedural (no model files). Requires three.js r128 as global THREE. */
(function () {
  "use strict";
  const T = window.THREE;
  if (!T) return;
  const K = {};

  /* ---------- materials ---------- */
  const grad = new T.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, T.LuminanceFormat);
  grad.minFilter = grad.magFilter = T.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
  K.gradient = grad;
  const mats = {};
  K.mat = (color, opts) => {
    const key = color + (opts ? JSON.stringify(opts) : "");
    if (!mats[key]) mats[key] = new T.MeshToonMaterial(Object.assign({ color, gradientMap: grad }, opts || {}));
    return mats[key];
  };
  const outlines = {};
  K.outlineMat = (thick = 0.035, color = 0x1b100a) => {
    const key = thick + ":" + color;
    if (!outlines[key]) outlines[key] = new T.ShaderMaterial({
      uniforms: { uC: { value: new T.Color(color) }, uT: { value: thick } },
      vertexShader: "uniform float uT; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uT, 1.0); }",
      fragmentShader: "uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 1.0); }",
      side: T.BackSide
    });
    return outlines[key];
  };
  /** mesh with toon material and (optionally) an ink outline child */
  K.mesh = (geo, color, o = {}) => {
    const m = new T.Mesh(geo, o.material || K.mat(color, o.matOpts));
    if (o.outline !== false) { const ol = new T.Mesh(geo, K.outlineMat(o.thick || 0.035)); ol.raycast = () => {}; m.add(ol); }
    if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
    if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    if (o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2]);
    m.castShadow = !!o.shadow;
    return m;
  };

  /* ---------- geometry helpers (smooth normals so outlines don't crack) ---------- */
  const geos = {};
  K.capsule = (r, len, seg = 12) => {
    const key = `cap${r}:${len}:${seg}`;
    if (geos[key]) return geos[key];
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new T.Vector2(Math.max(0.0001, Math.cos(a) * r), -len / 2 + Math.sin(a) * r)); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new T.Vector2(Math.max(0.0001, Math.cos(a) * r), len / 2 + Math.sin(a) * r)); }
    return (geos[key] = new T.LatheGeometry(pts, seg));
  };
  K.sphere = (r, w = 18, h = 14) => geos[`s${r}:${w}`] || (geos[`s${r}:${w}`] = new T.SphereGeometry(r, w, h));
  K.box = (x, y, z) => geos[`b${x}:${y}:${z}`] || (geos[`b${x}:${y}:${z}`] = new T.BoxGeometry(x, y, z));
  K.cyl = (a, b, h, s = 16, open = false, ts = 0, tl = Math.PI * 2) => {
    const key = `c${a}:${b}:${h}:${s}:${open}:${ts}:${tl}`;
    return geos[key] || (geos[key] = new T.CylinderGeometry(a, b, h, s, 1, open, ts, tl));
  };
  const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

  /* ---------- props ---------- */
  K.cutlass = () => {
    const g = new T.Group();
    const s = new T.Shape();
    s.moveTo(0, 0); s.lineTo(0.09, 0); s.quadraticCurveTo(0.2, 0.7, 0.04, 1.38); s.lineTo(-0.02, 1.3);
    s.quadraticCurveTo(0.06, 0.7, 0, 0);
    const blade = new T.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
    blade.translate(-0.045, 0.12, -0.012);
    g.add(K.mesh(blade, 0xdfe6ee, { thick: 0.02 }));
    g.add(K.mesh(K.cyl(0.035, 0.035, 0.24, 8), 0x3b2414, { pos: [0, -0.04, 0], thick: 0.015 }));
    g.add(K.mesh(new T.TorusGeometry(0.11, 0.025, 6, 16, Math.PI), 0xf2c14e, { pos: [0, 0.08, 0], rot: [0, Math.PI / 2, Math.PI], thick: 0.012 }));
    g.add(K.mesh(K.sphere(0.05, 8, 6), 0xf2c14e, { pos: [0, -0.18, 0], thick: 0.012 }));
    return g;
  };
  K.shovel = () => {
    const g = new T.Group();
    g.add(K.mesh(K.cyl(0.04, 0.04, 1.3, 8), 0x8a5a2b, { pos: [0, 0.35, 0], thick: 0.015 }));
    g.add(K.mesh(K.box(0.26, 0.32, 0.04), 0x9aa3ad, { pos: [0, -0.4, 0], thick: 0.015 }));
    return g;
  };
  K.chest = () => {
    const g = new T.Group();
    const wood = 0x8b4f22, gold = 0xf2c14e;
    g.add(K.mesh(K.box(1.4, 0.8, 0.9), wood, { pos: [0, 0.4, 0] }));
    [-0.5, 0.5].forEach((x) => g.add(K.mesh(K.box(0.12, 0.84, 0.94), gold, { pos: [x, 0.4, 0], thick: 0.02 })));
    const lid = new T.Group(); lid.position.set(0, 0.8, -0.45); g.add(lid);
    lid.add(K.mesh(K.cyl(0.45, 0.45, 1.4, 16, false, 0, Math.PI), wood, { pos: [0, 0, 0.45], rot: [0, 0, Math.PI / 2] }));
    lid.add(K.mesh(K.box(0.2, 0.22, 0.08), gold, { pos: [0, -0.02, 0.92], thick: 0.02 }));
    const glow = new T.Mesh(K.box(1.2, 0.08, 0.7), new T.MeshBasicMaterial({ color: 0xffe27a }));
    glow.position.set(0, 0.78, 0); g.add(glow);
    g.userData.lid = lid; g.userData.glow = glow;
    return g;
  };
  K.coinGeo = new T.CylinderGeometry(0.16, 0.16, 0.05, 14);
  K.coinMat = new T.MeshToonMaterial({ color: 0xffc83d, gradientMap: grad, emissive: 0x6b4500 });

  /* ---------- characters ---------- */
  /**
   * style: { kind: 'captain' | 'skeleton', coat, hatColor, ... }
   * Returns { root, P (joints), pose(state, t, u), hand, setItem(name) }
   * Units: about 3.3 tall; feet at y = 0; faces +z.
   */
  K.makeCharacter = function (style) {
    const s = Object.assign({
      kind: "captain", skin: 0xc68a5c, shirt: 0xf3ead8, coat: 0x1d6f7a, trim: 0xf2c14e, pants: 0x3b2c22,
      boots: 0x2b1a10, sash: 0xf08a24, hat: 0x1d1612, beard: 0x251811, bone: 0xf1ead6, bandana: 0xc8372d
    }, style);
    const skel = s.kind === "skeleton";
    const root = new T.Group();
    const body = new T.Group(); root.add(body); // body gets the lean / jump offsets
    const P = { root, body };
    const hips = at(new T.Group(), 0, 1.0, 0); body.add(hips); P.hips = hips;

    // legs
    ["L", "R"].forEach((side) => {
      const sx = side === "L" ? -1 : 1;
      const leg = at(new T.Group(), 0.21 * sx, 0, 0); hips.add(leg);
      const knee = at(new T.Group(), 0, -0.5, 0); leg.add(knee);
      if (skel) {
        leg.add(K.mesh(K.capsule(0.055, 0.38), s.bone, { pos: [0, -0.25, 0], thick: 0.02 }));
        knee.add(K.mesh(K.sphere(0.08, 10, 8), s.bone, { thick: 0.02 }));
        knee.add(K.mesh(K.capsule(0.05, 0.32), s.bone, { pos: [0, -0.22, 0], thick: 0.02 }));
        knee.add(K.mesh(K.sphere(0.12, 12, 8), s.bone, { pos: [0, -0.45, 0.07], scale: [1, 0.55, 1.5], thick: 0.02 }));
      } else {
        leg.add(K.mesh(K.capsule(0.15, 0.3), s.pants, { pos: [0, -0.24, 0] }));
        knee.add(K.mesh(K.capsule(0.13, 0.22), s.pants, { pos: [0, -0.16, 0] }));
        knee.add(K.mesh(K.capsule(0.15, 0.12), s.boots, { pos: [0, -0.32, 0] }));
        knee.add(K.mesh(K.sphere(0.16, 14, 10), s.boots, { pos: [0, -0.44, 0.08], scale: [1, 0.62, 1.55] }));
        knee.add(K.mesh(K.cyl(0.18, 0.17, 0.08, 14), s.boots, { pos: [0, -0.22, 0] }));
      }
      P["leg" + side] = leg; P["knee" + side] = knee;
    });

    // torso
    const torso = at(new T.Group(), 0, 0.02, 0); hips.add(torso); P.torso = torso;
    if (skel) {
      torso.add(K.mesh(K.capsule(0.06, 0.8), s.bone, { pos: [0, 0.48, -0.05], thick: 0.02 }));
      [0.75, 0.58, 0.41].forEach((y, i) => torso.add(K.mesh(new T.TorusGeometry(0.3 - i * 0.04, 0.045, 8, 20), s.bone, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.75, 1], thick: 0.02 })));
      torso.add(K.mesh(K.sphere(0.24, 14, 10), s.bone, { pos: [0, 0.04, 0], scale: [1.2, 0.5, 0.8], thick: 0.02 }));
      torso.add(K.mesh(new T.TorusGeometry(0.33, 0.06, 8, 20), s.bandana, { pos: [0, 0.1, 0], rot: [Math.PI / 2, 0, 0] }));
    } else {
      torso.add(K.mesh(K.capsule(0.37, 0.32, 16), s.shirt, { pos: [0, 0.47, 0] }));
      const coat = K.mesh(K.cyl(0.42, 0.56, 1.25, 20, true, 0.55, Math.PI * 2 - 1.1), s.coat,
        { pos: [0, 0.32, 0], matOpts: { side: T.DoubleSide } });
      torso.add(coat);
      torso.add(K.mesh(K.cyl(0.43, 0.43, 0.14, 20, true, 0.55, Math.PI * 2 - 1.1), s.trim, { pos: [0, 0.9, 0], matOpts: { side: T.DoubleSide }, thick: 0.02 }));
      torso.add(K.mesh(new T.TorusGeometry(0.4, 0.075, 8, 24), s.sash, { pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] }));
      torso.add(K.mesh(K.box(0.2, 0.16, 0.06), s.trim, { pos: [0, 0.12, 0.43], thick: 0.02 }));
      [0.62, 0.42].forEach((y) => [-1, 1].forEach((sx) => torso.add(K.mesh(K.sphere(0.04, 8, 6), s.trim, { pos: [0.27 * sx, y, 0.35], thick: 0.012 }))));
    }

    // arms
    ["L", "R"].forEach((side) => {
      const sx = side === "L" ? -1 : 1;
      const arm = at(new T.Group(), (skel ? 0.36 : 0.47) * sx, 0.84, 0); torso.add(arm);
      const elbow = at(new T.Group(), 0, -0.38, 0); arm.add(elbow);
      const hand = at(new T.Group(), 0, -0.36, 0); elbow.add(hand);
      if (skel) {
        arm.add(K.mesh(K.sphere(0.08, 10, 8), s.bone, { thick: 0.02 }));
        arm.add(K.mesh(K.capsule(0.045, 0.3), s.bone, { pos: [0, -0.19, 0], thick: 0.02 }));
        elbow.add(K.mesh(K.capsule(0.04, 0.28), s.bone, { pos: [0, -0.17, 0], thick: 0.02 }));
        hand.add(K.mesh(K.sphere(0.08, 10, 8), s.bone, { thick: 0.02 }));
      } else {
        arm.add(K.mesh(K.sphere(0.15, 12, 10), s.coat, {}));
        arm.add(K.mesh(K.capsule(0.12, 0.22), s.coat, { pos: [0, -0.18, 0] }));
        elbow.add(K.mesh(K.capsule(0.11, 0.18), s.coat, { pos: [0, -0.15, 0] }));
        elbow.add(K.mesh(new T.TorusGeometry(0.11, 0.04, 6, 14), s.trim, { pos: [0, -0.27, 0], rot: [Math.PI / 2, 0, 0], thick: 0.015 }));
        hand.add(K.mesh(K.sphere(0.11, 12, 10), s.skin, {}));
      }
      P["arm" + side] = arm; P["elbow" + side] = elbow; P["hand" + side] = hand;
    });

    // head
    const head = at(new T.Group(), 0, 0.98, 0); torso.add(head); P.head = head;
    const eyes = [];
    if (skel) {
      head.add(K.mesh(K.sphere(0.4, 18, 14), s.bone, { pos: [0, 0.42, 0], scale: [1, 0.95, 0.95] }));
      head.add(K.mesh(K.box(0.42, 0.16, 0.3), s.bone, { pos: [0, 0.12, 0.12] }));
      [-1, 1].forEach((sx) => { const e = K.mesh(K.sphere(0.1, 10, 8), 0x140b07, { pos: [0.15 * sx, 0.45, 0.33], scale: [1, 1.1, 0.5], outline: false }); head.add(e); });
      [-1, 1].forEach((sx) => head.add(new T.Mesh(K.sphere(0.035, 6, 4), new T.MeshBasicMaterial({ color: 0xff5a3c })).translateX(0.15 * sx).translateY(0.45).translateZ(0.39)));
      head.add(K.mesh(K.box(0.05, 0.08, 0.04), 0x140b07, { pos: [0, 0.32, 0.38], outline: false }));
      for (let i = -2; i <= 2; i++) head.add(K.mesh(K.box(0.04, 0.07, 0.02), 0x140b07, { pos: [i * 0.07, 0.15, 0.27], outline: false }));
      const cap = K.mesh(K.sphere(0.42, 18, 10, 0), s.bandana, { pos: [0, 0.5, -0.02], scale: [1.02, 0.75, 1.02] });
      head.add(cap);
      head.add(K.mesh(K.capsule(0.06, 0.25), s.bandana, { pos: [-0.36, 0.42, -0.3], rot: [0.4, 0, 0.9] }));
    } else {
      head.add(K.mesh(K.sphere(0.46, 22, 16), s.skin, { pos: [0, 0.42, 0] }));
      head.add(K.mesh(K.sphere(0.45, 18, 14), s.beard, { pos: [0, 0.5, -0.06], scale: [1.02, 0.98, 0.98] })); // hair at back
      [-1, 1].forEach((sx) => head.add(K.mesh(K.sphere(0.09, 10, 8), s.skin, { pos: [0.45 * sx, 0.4, 0], scale: [0.6, 1, 1] })));
      [-1, 1].forEach((sx) => {
        const eg = at(new T.Group(), 0.17 * sx, 0.47, 0.38); head.add(eg);
        const white = new T.Mesh(K.sphere(0.095, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff }));
        white.scale.set(1, 1.15, 0.5); eg.add(white);
        const pupil = new T.Mesh(K.sphere(0.058, 10, 8), new T.MeshBasicMaterial({ color: 0x1a110b })); pupil.position.set(0, -0.005, 0.045); eg.add(pupil);
        const shine = new T.Mesh(K.sphere(0.018, 6, 4), new T.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(0.02 * sx, 0.025, 0.09); eg.add(shine);
        eyes.push(eg);
        head.add(K.mesh(K.box(0.16, 0.04, 0.04), s.beard, { pos: [0.17 * sx, 0.6, 0.4], rot: [0, 0, -0.18 * sx], outline: false }));
      });
      head.add(K.mesh(K.sphere(0.075, 10, 8), 0xb57650, { pos: [0, 0.38, 0.45], scale: [1, 0.9, 1] }));
      head.add(K.mesh(K.sphere(0.28, 16, 12), s.beard, { pos: [0, 0.17, 0.22], scale: [1.15, 0.8, 0.8] }));
      [-1, 1].forEach((sx) => head.add(K.mesh(K.capsule(0.045, 0.14), s.beard, { pos: [0.11 * sx, 0.3, 0.42], rot: [0, 0, 1.2 * sx], thick: 0.015 })));
      const mouth = new T.Mesh(K.sphere(0.06, 10, 8), new T.MeshBasicMaterial({ color: 0x4a1d12 }));
      mouth.position.set(0, 0.24, 0.43); mouth.scale.set(1.2, 0.3, 0.4); head.add(mouth); P.mouth = mouth;
      // tricorn hat: triangular brim (corner forward), gold edge, crown, wheel badge
      const hat = at(new T.Group(), 0, 0.82, 0); head.add(hat); P.hat = hat;
      hat.add(K.mesh(K.cyl(0.88, 0.88, 0.05, 3), s.trim, { pos: [0, -0.01, 0], thick: 0.02 }));
      hat.add(K.mesh(K.cyl(0.84, 0.84, 0.1, 3), s.hat, { pos: [0, 0.04, 0] }));
      hat.add(K.mesh(K.cyl(0.33, 0.42, 0.42, 20), s.hat, { pos: [0, 0.27, -0.02] }));
      const badge = K.mesh(new T.TorusGeometry(0.1, 0.03, 6, 16), s.trim, { pos: [0, 0.27, 0.4], rot: [-0.25, 0, 0], thick: 0.012 });
      hat.add(badge);
      for (let i = 0; i < 4; i++) badge.add(K.mesh(K.box(0.2, 0.02, 0.02), s.trim, { rot: [0, 0, (i * Math.PI) / 4], outline: false }));
    }
    P.eyes = eyes;

    // item in right hand
    const item = new T.Group(); P.handR.add(item); P.item = item;
    const items = { cutlass: K.cutlass(), shovel: K.shovel() };
    items.cutlass.rotation.set(Math.PI / 2 + 0.2, 0, 0); items.cutlass.position.set(0, -0.02, 0.05);
    items.shovel.rotation.set(Math.PI / 2, 0, 0); items.shovel.position.set(0, 0, 0.05);
    function setItem(name) {
      while (item.children.length) item.remove(item.children[0]);
      if (items[name]) item.add(items[name]);
    }
    setItem("cutlass");

    // blob shadow
    const shadow = new T.Mesh(new T.CircleGeometry(0.75, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; root.add(shadow); P.shadow = shadow;

    return { root, P, setItem, skel, pose: (state, t, u) => pose(P, state, t, u || 0, skel) };
  };

  /* ---------- procedural animation ---------- */
  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function reset(P) {
    P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0);
    P.hips.position.y = 1.0; P.hips.rotation.set(0, 0, 0);
    P.torso.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);
    ["L", "R"].forEach((s) => {
      P["leg" + s].rotation.set(0, 0, 0); P["knee" + s].rotation.set(0, 0, 0);
      P["arm" + s].rotation.set(0, 0, s === "L" ? -0.12 : 0.12); P["elbow" + s].rotation.set(0, 0, 0);
    });
    if (P.mouth) P.mouth.scale.y = 0.3;
  }
  function blink(P, t) {
    const b = (t % 3.7) < 0.12 ? 0.12 : 1;
    P.eyes.forEach((e) => (e.scale.y = b));
  }
  function walkCycle(P, p, amp, lean) {
    P.legL.rotation.x = Math.sin(p) * amp; P.legR.rotation.x = -Math.sin(p) * amp;
    P.kneeL.rotation.x = Math.max(0, -Math.cos(p)) * amp * 1.1; P.kneeR.rotation.x = Math.max(0, Math.cos(p)) * amp * 1.1;
    P.armL.rotation.x = -Math.sin(p) * amp * 0.9; P.armR.rotation.x = Math.sin(p) * amp * 0.9;
    P.elbowL.rotation.x = P.elbowR.rotation.x = -0.35 - amp * 0.4;
    P.hips.position.y = 1.0 + Math.abs(Math.cos(p)) * 0.07 * amp * 1.6 - 0.03;
    P.torso.rotation.x = lean; P.torso.rotation.y = Math.sin(p) * 0.12;
    P.head.rotation.x = -lean * 0.6;
  }
  /** state: idle | walk | run | attack | hit | dig | dance | wave | talk | jump | victory | fall | sit */
  function pose(P, state, t, u, skel) {
    reset(P); blink(P, t);
    switch (state) {
      case "walk": walkCycle(P, t * 9, 0.62, 0.06); break;
      case "run": walkCycle(P, t * 14, 0.95, 0.28); P.armR.rotation.x -= 0.4; break;
      case "idle": {
        const b = Math.sin(t * 2.2);
        P.hips.position.y = 1.0 + b * 0.015; P.torso.rotation.x = 0.03 + b * 0.02;
        P.armL.rotation.z = -0.16 - b * 0.03; P.armR.rotation.z = 0.2 + b * 0.03;
        P.elbowR.rotation.x = -0.5; P.armR.rotation.x = -0.2;
        P.head.rotation.y = Math.sin(t * 0.7) * 0.25; P.head.rotation.z = Math.sin(t * 0.9) * 0.04;
        break;
      }
      case "talk": case "wave": {
        const b = Math.sin(t * 2.2);
        P.hips.position.y = 1.0 + b * 0.015;
        if (state === "wave") { P.armR.rotation.z = 2.55; P.elbowR.rotation.z = Math.sin(t * 11) * 0.45; P.armR.rotation.x = -0.2; }
        else { P.armR.rotation.x = -0.9 + Math.sin(t * 3.1) * 0.25; P.elbowR.rotation.x = -0.9; P.armR.rotation.z = 0.35; }
        P.armL.rotation.z = -0.5 - Math.sin(t * 2.7) * 0.12; P.elbowL.rotation.x = -0.6;
        P.head.rotation.x = Math.sin(t * 6) * 0.06; P.head.rotation.z = Math.sin(t * 1.7) * 0.06;
        if (P.mouth) P.mouth.scale.y = 0.3 + Math.abs(Math.sin(t * 14)) * 0.9;
        break;
      }
      case "attack": { // u: 0..1 one slash
        const wind = clamp01(u / 0.35), strike = clamp01((u - 0.35) / 0.25), back = clamp01((u - 0.7) / 0.3);
        const ax = -2.6 * ease(wind) + (2.6 + 0.9) * ease(strike) - 0.9 * ease(back);
        P.armR.rotation.x = ax; P.armR.rotation.z = 0.3 + 0.5 * wind - 0.5 * strike;
        P.elbowR.rotation.x = -0.9 * wind + 0.9 * strike;
        P.torso.rotation.y = -0.45 * wind + 0.8 * strike - 0.35 * back;
        P.torso.rotation.x = 0.25 * strike * (1 - back);
        P.body.position.z = 0.45 * strike * (1 - back);
        P.legL.rotation.x = -0.5 * strike * (1 - back); P.legR.rotation.x = 0.4 * strike * (1 - back);
        P.kneeR.rotation.x = 0.5 * strike * (1 - back);
        P.armL.rotation.z = -0.6; P.armL.rotation.x = 0.4;
        break;
      }
      case "guard": {
        P.armR.rotation.x = -1.3; P.armR.rotation.z = 0.8; P.elbowR.rotation.x = -0.8;
        P.torso.rotation.x = -0.1; P.legL.rotation.x = -0.25; P.legR.rotation.x = 0.25; P.kneeR.rotation.x = 0.3;
        P.hips.position.y = 0.95 + Math.sin(t * 6) * 0.02; P.armL.rotation.z = -0.7;
        break;
      }
      case "hit": {
        const k = Math.sin(Math.PI * clamp01(u));
        P.torso.rotation.x = -0.45 * k; P.head.rotation.x = -0.4 * k; P.body.position.z = -0.35 * k;
        P.armL.rotation.z = -1.0 * k; P.armR.rotation.z = 1.0 * k;
        break;
      }
      case "fall": {
        const k = ease(clamp01(u));
        P.body.rotation.x = -1.45 * k; P.body.position.y = 0.25 * Math.sin(Math.PI * k);
        P.armL.rotation.z = -1.4 * k; P.armR.rotation.z = 1.4 * k; P.kneeL.rotation.x = 0.6 * k;
        break;
      }
      case "dig": {
        const d = Math.sin(t * 7);
        P.torso.rotation.x = 0.55 + d * 0.22; P.hips.position.y = 0.88;
        P.kneeL.rotation.x = P.kneeR.rotation.x = 0.55; P.legL.rotation.x = P.legR.rotation.x = -0.35;
        P.armR.rotation.x = -0.9 + d * 0.5; P.armL.rotation.x = -1.0 + d * 0.5; P.armL.rotation.z = 0.25;
        P.elbowR.rotation.x = P.elbowL.rotation.x = -0.4;
        break;
      }
      case "dance": case "victory": {
        const j = Math.abs(Math.sin(t * 6));
        P.body.position.y = j * 0.35;
        P.kneeL.rotation.x = P.kneeR.rotation.x = (1 - j) * 0.7; P.legL.rotation.x = P.legR.rotation.x = -(1 - j) * 0.35;
        P.armR.rotation.z = 2.7 + Math.sin(t * 6) * 0.2; P.elbowR.rotation.x = -0.2;
        if (state === "dance") { P.armL.rotation.z = -2.7 - Math.sin(t * 6) * 0.2; P.body.rotation.y = Math.sin(t * 3) * 0.6; }
        else { P.armL.rotation.z = -0.6; P.armL.rotation.x = -0.3; }
        if (P.mouth) P.mouth.scale.y = 0.9;
        break;
      }
      case "jump": {
        const k = clamp01(u);
        const crouch = k < 0.18 ? k / 0.18 : 0;
        P.body.position.y = Math.sin(Math.PI * clamp01((k - 0.18) / 0.82)) * 1.6;
        P.kneeL.rotation.x = P.kneeR.rotation.x = 0.8 * crouch + (k > 0.18 ? 0.9 : 0);
        P.legL.rotation.x = P.legR.rotation.x = -0.4 * crouch - (k > 0.18 ? 0.5 : 0);
        P.armL.rotation.z = -1.6 * (k > 0.18 ? 1 : crouch); P.armR.rotation.z = 1.6 * (k > 0.18 ? 1 : crouch);
        P.hips.position.y = 1.0 - 0.18 * crouch;
        break;
      }
    }
  }

  window.KCToon = K;
})();
