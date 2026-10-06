/* Kaalchakra 2.0 — Captain Kaal, the roaming 3D pirate who lives along the bottom of every page.
   He wanders, duels skeleton raiders, digs up treasure, comments on what you're reading and
   answers when you click him. Also runs the HUD (doubloons + hidden-flag hunt).
   Requires three.js r128 + toon.js. */
(function () {
  "use strict";
  const T = window.THREE, K = window.KCToon;
  const KC = window.KC || {};
  const L = KC.captain || {};
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ================= HUD + hidden flags (works even without WebGL) ================= */
  const TOTAL_FLAGS = KC.totalFlags || 8;
  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <span class="hud-item" title="Doubloons collected"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffc83d" stroke="#7a4b00" stroke-width="2"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 010 3.6h-3a1.8 1.8 0 000 3.6h4" fill="none" stroke="#7a4b00" stroke-width="1.6" stroke-linecap="round"/></svg><b id="hud-coins">0</b><span class="visually-hidden"> doubloons</span></span>
    <span class="hud-item" title="Hidden flags found on this site"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3" stroke="#3b2414" stroke-width="2.4" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="#d7263d" stroke="#3b2414" stroke-width="1.6" stroke-linejoin="round"/></svg><b id="hud-flags">0/${TOTAL_FLAGS}</b><span class="visually-hidden"> hidden flags found</span></span>
    <button class="hud-btn" type="button" id="hud-toggle" aria-pressed="false">Hide captain</button>`;
  document.body.appendChild(hud);
  const live = document.createElement("p"); live.className = "visually-hidden"; live.setAttribute("aria-live", "polite"); document.body.appendChild(live);
  let coins = store.get("kc-coins", 0);
  let found = store.get("kc-flags", []);
  const coinsEl = hud.querySelector("#hud-coins"), flagsEl = hud.querySelector("#hud-flags");
  const renderHud = () => { coinsEl.textContent = coins; flagsEl.textContent = `${found.length}/${TOTAL_FLAGS}`; };
  renderHud();
  function addCoins(n) { coins += n; store.set("kc-coins", coins); renderHud(); hud.classList.remove("bump"); void hud.offsetWidth; hud.classList.add("bump"); }

  document.querySelectorAll(".flag-egg").forEach((btn) => {
    const id = btn.dataset.flag;
    if (found.includes(id)) btn.hidden = true;
    btn.addEventListener("click", () => {
      if (found.includes(id)) return;
      found.push(id); store.set("kc-flags", found); renderHud();
      btn.classList.add("got"); setTimeout(() => (btn.hidden = true), 700);
      addCoins(25);
      const n = found.length;
      const msg = n >= TOTAL_FLAGS ? (L.allFlags || "All flags found!") : (L.flag || "Flag {n} of {t}!").replace("{n}", n).replace("{t}", TOTAL_FLAGS);
      live.textContent = msg;
      if (api) api.react(n >= TOTAL_FLAGS ? "allflags" : "flag", msg);
    });
  });

  let api = null; // set once the 3D captain is running
  window.KCCaptain = { say: (t) => { live.textContent = t; if (api) api.say(t, true); }, play: (a) => { if (api) api.play(a); } };

  /* ================= 3D captain ================= */
  if (!T || !K) return hud.querySelector("#hud-toggle").remove();
  const layer = document.createElement("div"); layer.className = "cap-layer"; layer.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas"); layer.appendChild(canvas);
  const bubble = document.createElement("div"); bubble.className = "cap-bubble"; bubble.setAttribute("aria-hidden", "true");
  const hit = document.createElement("button"); hit.className = "cap-hit"; hit.type = "button"; hit.setAttribute("aria-label", "Talk to Captain Kaal");
  document.body.append(layer, bubble, hit);

  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { layer.remove(); hit.remove(); return; }
  if (!renderer.getContext()) { layer.remove(); hit.remove(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new T.Scene();
  const cam = new T.OrthographicCamera(0, 1, 1, 0, -2000, 2000);
  cam.position.z = 500;
  scene.add(new T.HemisphereLight(0xfff1d6, 0x3a4a63, 0.78));
  const sun = new T.DirectionalLight(0xfff0d8, 0.85); sun.position.set(-0.5, 1, 1.2); scene.add(sun);

  let W = 0, H = 0, S = 36, GROUND = 12;
  function resize() {
    W = window.innerWidth; const small = W < 720;
    H = small ? 210 : 290; S = small ? 25 : 36; GROUND = small ? 8 : 12;
    renderer.setSize(W, H, false); canvas.style.height = H + "px";
    cam.left = 0; cam.right = W; cam.top = H; cam.bottom = 0; cam.updateProjectionMatrix();
    [cap, foe].forEach((a) => { a.c.root.scale.setScalar(S); a.c.root.position.y = GROUND; });
    chest.scale.setScalar(S * 0.9); xmark.scale.setScalar(S);
    cap.x = Math.min(Math.max(cap.x || W * 0.82, 60), W - 60);
  }

  /* actors */
  function actor(style) {
    const c = K.makeCharacter(style);
    c.root.rotation.x = 0.16; scene.add(c.root);
    return { c, x: 0, face: 1, ry: 1, mode: "idle", u: 0, target: null, speed: 0, onArrive: null, jump: -1, look: 0 };
  }
  const cap = actor({});
  const foe = actor({ kind: "skeleton" }); foe.c.root.visible = false;
  const chest = K.chest(); chest.visible = false; chest.rotation.x = 0.16; scene.add(chest);
  const xmark = new T.Group(); xmark.visible = false; scene.add(xmark);
  [0.75, -0.75].forEach((r) => { const b = K.mesh(K.box(1.5, 0.05, 0.28), 0xd7263d, { thick: 0.02 }); b.rotation.y = r; xmark.add(b); });
  xmark.rotation.x = 0.16;

  /* particles + floating text */
  const parts = [];
  const sparkMat = new T.MeshBasicMaterial({ color: 0xfff1a8 });
  const dirtMat = K.mat(0x9a6a3a);
  function spawn(kind, x, y, n) {
    for (let i = 0; i < n; i++) {
      let m, life = 1.4;
      if (kind === "coin") { m = new T.Mesh(K.coinGeo, K.coinMat); m.scale.setScalar(S); }
      else if (kind === "spark") { m = new T.Mesh(K.box(0.12, 0.12, 0.12), sparkMat); m.scale.setScalar(S); life = 0.35; }
      else if (kind === "dirt") { m = new T.Mesh(K.box(0.18, 0.18, 0.18), dirtMat); m.scale.setScalar(S); life = 0.8; }
      else { m = new T.Mesh(K.sphere(0.4, 10, 8), new T.MeshBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.9 })); m.scale.setScalar(S * rand(0.6, 1.1)); life = 0.7; }
      m.position.set(x + rand(-10, 10), y + rand(0, 14), 60);
      const p = { m, kind, life, max: life,
        vx: kind === "smoke" ? rand(-60, 60) : rand(-170, 170), vy: kind === "smoke" ? rand(30, 90) : rand(220, kind === "coin" ? 480 : 300),
        spin: rand(-12, 12) };
      scene.add(m); parts.push(p);
    }
  }
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.kind !== "smoke") p.vy -= 1100 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt;
      if (p.kind !== "smoke" && p.m.position.y < GROUND + 4) { p.m.position.y = GROUND + 4; p.vy *= -0.35; p.vx *= 0.6; }
      p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * 0.7 * dt;
      if (p.kind === "smoke") { p.m.scale.multiplyScalar(1 + dt * 1.6); p.m.material.opacity = Math.max(0, p.life / p.max) * 0.9; }
      if (p.life <= 0) { scene.remove(p.m); if (p.kind === "smoke") p.m.material.dispose(); parts.splice(i, 1); }
    }
  }
  function pop(text, x, yFromBottom) {
    const d = document.createElement("div"); d.className = "cap-pop"; d.textContent = text;
    d.style.left = x + "px"; d.style.bottom = yFromBottom + "px";
    document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
  }

  /* speech bubble with typewriter */
  let bubbleTimer = 0, typeTimer = 0;
  function say(text, user) {
    clearTimeout(bubbleTimer); clearInterval(typeTimer);
    bubble.classList.add("show");
    if (reduce) bubble.textContent = text;
    else {
      let i = 0; bubble.textContent = "";
      typeTimer = setInterval(() => { i += 2; bubble.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeTimer); }, 28);
    }
    const ms = Math.min(9000, 2200 + text.length * 48);
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), ms);
    if (user) live.textContent = text;
    return ms;
  }

  /* time + async helpers driven by the render loop (so everything pauses together) */
  let now = 0;
  const waits = [];
  const sleep = (ms) => new Promise((res) => waits.push({ t: now + ms / 1000, res }));
  function walkTo(a, x, run, fast) {
    a.target = a === foe ? x : Math.min(Math.max(x, 40), W - 40);
    a.mode = run ? "run" : "walk"; a.speed = (fast || (run ? 5.2 : 2.6)) * S;
    return new Promise((res) => (a.onArrive = res));
  }
  async function anim(a, mode, ms) { a.mode = mode; a.u = 0; a.dur = ms / 1000; await sleep(ms); }

  /* ----- acts ----- */
  let busy = false, pendingLine = null, pendingAct = null, lastSection = 0;
  async function actTalk(line, wave) {
    cap.face = 0; await anim(cap, wave ? "wave" : "talk", say(line) * 0.8); cap.mode = "idle";
  }
  async function actWander() {
    const tx = rand(70, W - 70);
    await walkTo(cap, tx, Math.abs(tx - cap.x) > W * 0.45);
    cap.mode = "idle";
  }
  async function actFight() {
    busy = true;
    const side = cap.x > W / 2 ? 1 : -1; // enemy jumps in from the nearest edge
    foe.x = side > 0 ? W + 80 : -80; foe.c.root.visible = true; foe.c.root.rotation.z = 0;
    say(pick(L.fightStart || ["Raiders!"]));
    cap.face = side; cap.mode = "guard";
    if (Math.abs(foe.x - cap.x) < S * 4) await walkTo(cap, cap.x - side * S * 3, false);
    cap.face = side; cap.mode = "guard";
    await walkTo(foe, cap.x + side * S * 2.3, true, 8); foe.face = -side; foe.mode = "guard";
    await sleep(250);
    const rounds = 2 + Math.floor(Math.random() * 2);
    for (let r = 0; r < rounds; r++) {
      const capTurn = r % 2 === 0;
      const atk = capTurn ? cap : foe, def = capTurn ? foe : cap;
      atk.mode = "attack"; atk.u = 0; atk.dur = 0.55;
      await sleep(260);
      spawn("spark", (cap.x + foe.x) / 2, GROUND + S * 2.2, 10);
      def.mode = "hit"; def.u = 0; def.dur = 0.35;
      await sleep(330); atk.mode = "guard"; def.mode = "guard"; await sleep(220);
    }
    cap.mode = "attack"; cap.u = 0; cap.dur = 0.55; await sleep(260);
    spawn("spark", (cap.x + foe.x) / 2, GROUND + S * 2.2, 14);
    foe.mode = "fall"; foe.u = 0; foe.dur = 0.6; await sleep(650);
    spawn("smoke", foe.x, GROUND + S * 0.8, 9); spawn("coin", foe.x, GROUND + S, 6);
    foe.c.root.visible = false; foe.mode = "idle";
    addCoins(5); pop("+5", foe.x, GROUND + S * 2.5);
    cap.face = 0; cap.mode = "victory"; say(pick(L.fightWin || ["Victory!"]));
    await sleep(1600); cap.mode = "idle"; busy = false;
  }
  async function actTreasure() {
    busy = true;
    let tx = rand(90, W - 90);
    if (Math.abs(tx - cap.x) < W * 0.2) tx = cap.x > W / 2 ? rand(90, W * 0.4) : rand(W * 0.6, W - 90);
    xmark.position.set(tx, GROUND + 2, -20); xmark.visible = true; xmark.scale.setScalar(0.01);
    say(pick(L.treasureStart || ["X marks the spot!"]));
    const dir = tx > cap.x ? 1 : -1;
    await walkTo(cap, tx - dir * S * 1.3, Math.abs(tx - cap.x) > W * 0.4);
    cap.face = dir; cap.c.setItem("shovel"); cap.mode = "dig";
    for (let i = 0; i < 7; i++) { spawn("dirt", tx, GROUND + 6, 3); await sleep(300); }
    chest.position.set(tx, GROUND - S * 0.9, -10); chest.visible = true; chest.userData.lid.rotation.x = 0;
    xmark.visible = false;
    for (let k = 0; k <= 10; k++) { chest.position.y = GROUND - S * 0.9 * (1 - k / 10); await sleep(40); }
    for (let k = 0; k <= 8; k++) { chest.userData.lid.rotation.x = -1.25 * (k / 8); await sleep(30); }
    spawn("coin", tx, GROUND + S * 0.9, 14); addCoins(10); pop("+10", tx, GROUND + S * 2.4);
    cap.c.setItem("cutlass"); cap.face = 0; cap.mode = "dance";
    say(pick(L.treasureFound || ["Treasure!"]));
    await sleep(2200);
    for (let k = 10; k >= 0; k--) { chest.scale.setScalar(S * 0.9 * (k / 10) + 0.001); await sleep(35); }
    chest.visible = false; chest.scale.setScalar(S * 0.9);
    cap.mode = "idle"; busy = false;
  }
  async function brain() {
    await sleep(900);
    await actTalk(pick(L.greet || ["Ahoy!"]), true);
    let last = "";
    for (;;) {
      await sleep(rand(1600, 3600));
      if (off) { await sleep(600); continue; }
      if (pendingAct) { const a = pendingAct; pendingAct = null; if (a === "fight") await actFight(); else if (a === "treasure") await actTreasure(); continue; }
      if (pendingLine) { const l = pendingLine; pendingLine = null; await actTalk(l); continue; }
      const r = Math.random();
      let act = r < 0.38 ? "wander" : r < 0.56 ? "fight" : r < 0.74 ? "treasure" : r < 0.9 ? "chatter" : "dance";
      if (act === last && act !== "wander") act = "wander";
      last = act;
      if (act === "wander") await actWander();
      else if (act === "fight") await actFight();
      else if (act === "treasure") await actTreasure();
      else if (act === "chatter") await actTalk(pick(L.idle || ["Arr."]));
      else { cap.face = 0; await anim(cap, "dance", 1600); cap.mode = "idle"; }
    }
  }

  /* ----- interaction ----- */
  let pokes = 0;
  hit.addEventListener("click", () => {
    pokes++;
    const line = pokes > 4 && pokes % 3 === 0 ? pick(L.pokeMany || L.poke || ["Arr!"]) : pick(L.poke || ["Ahoy!"]);
    if (!busy) { cap.jump = 0; cap.face = 0; }
    say(line, true);
  });
  let mouseX = -1;
  window.addEventListener("pointermove", (e) => { mouseX = e.clientX; }, { passive: true });

  // comments on sections as they scroll into view
  if ("IntersectionObserver" in window) {
    const seen = new Set();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting || seen.has(e.target)) return;
      seen.add(e.target);
      if (now - lastSection > 6) { pendingLine = e.target.dataset.captain; lastSection = now; }
    }), { threshold: 0.45 });
    document.querySelectorAll("[data-captain]").forEach((el) => io.observe(el));
  }

  api = {
    play: (a) => { pendingAct = a; },
    say: (text, user) => { if (!busy) { cap.face = 0; cap.mode = "talk"; setTimeout(() => { if (cap.mode === "talk") cap.mode = "idle"; }, Math.min(6000, 1500 + text.length * 40)); } say(text, user); },
    react: (kind, text) => {
      say(text, true);
      if (!busy) { cap.face = 0; cap.mode = kind === "allflags" ? "dance" : "victory"; setTimeout(() => { if (!busy) cap.mode = "idle"; }, kind === "allflags" ? 4000 : 1500); }
      spawn("coin", cap.x, GROUND + S * 2, kind === "allflags" ? 24 : 8);
    }
  };

  /* ----- hide / show ----- */
  const toggle = hud.querySelector("#hud-toggle");
  let off = store.get("kc-cap-off", false);
  function applyOff() {
    layer.hidden = off; hit.hidden = off; bubble.hidden = off;
    toggle.textContent = off ? "Show captain" : "Hide captain"; toggle.setAttribute("aria-pressed", String(off));
    setRunning(!off);
  }
  toggle.addEventListener("click", () => { off = !off; store.set("kc-cap-off", off); applyOff(); });

  /* ----- loop ----- */
  const clock = new T.Clock();
  let running = false, raf = 0;
  function step(a, dt) {
    if (a.target != null) {
      const dx = a.target - a.x;
      if (Math.abs(dx) <= a.speed * dt + 1) { a.x = a.target; a.target = null; a.mode = "idle"; const f = a.onArrive; a.onArrive = null; f && f(); }
      else { a.x += Math.sign(dx) * a.speed * dt; a.face = Math.sign(dx); }
    }
    if (a.dur) a.u = Math.min(1, a.u + dt / a.dur);
    const want = a.face === 0 ? 0.15 : a.face * 1.05;
    a.ry += (want - a.ry) * Math.min(1, dt * 10);
    const r = a.c.root;
    r.position.x = a.x; r.rotation.y = a.ry;
    let st = a.mode;
    if (a.jump >= 0) { a.jump += dt / 0.6; st = "jump"; if (a.jump >= 1) a.jump = -1; }
    a.c.pose(st, now, st === "jump" ? Math.max(0, a.jump) : a.u);
    if (a === cap && (st === "idle" || st === "talk") && mouseX >= 0) {
      cap.c.P.head.rotation.y = Math.max(-0.7, Math.min(0.7, (mouseX - a.x) / (W * 0.5))) - a.ry * 0.5;
    }
  }
  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    now += dt;
    for (let i = waits.length - 1; i >= 0; i--) if (now >= waits[i].t) waits.splice(i, 1)[0].res();
    step(cap, dt); if (foe.c.root.visible || foe.target != null) step(foe, dt);
    if (xmark.visible && xmark.scale.x < S) xmark.scale.setScalar(Math.min(S, xmark.scale.x + S * dt * 4));
    updateParts(dt);
    renderer.render(scene, cam);
    // bubble + hit box follow the captain
    const top = GROUND + S * (3.7 + (cap.mode === "dance" || cap.mode === "victory" ? 0.4 : 0));
    const bw = bubble.offsetWidth || 220;
    const bx = Math.max(8 + bw / 2, Math.min(W - 8 - bw / 2, cap.x));
    bubble.style.transform = `translate(${bx - bw / 2}px, 0)`; bubble.style.bottom = top + "px";
    bubble.style.setProperty("--tail", Math.max(16, Math.min(bw - 16, cap.x - (bx - bw / 2))) + "px");
    hit.style.transform = `translate(${cap.x - S * 0.9}px, 0)`; hit.style.width = S * 1.8 + "px"; hit.style.height = S * 3.6 + "px"; hit.style.bottom = GROUND + "px";
    raf = requestAnimationFrame(frame);
  }
  function setRunning(on) {
    on = on && !document.hidden && !off && !reduce;
    if (on === running) return;
    running = on;
    if (on) { clock.getDelta(); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  }
  document.addEventListener("visibilitychange", () => setRunning(true));
  window.addEventListener("resize", resize);

  resize();
  cap.x = W * (W < 720 ? 0.78 : 0.86); cap.ry = -1; cap.face = -1;
  if (reduce) {
    // no roaming: he stands by the edge and only speaks when spoken to
    cap.mode = "idle";
    const render1 = () => { step(cap, 0); renderer.render(scene, cam); };
    hit.addEventListener("click", () => { cap.face = 0; render1(); });
    running = false; render1();
    hit.style.transform = `translate(${cap.x - S * 0.9}px, 0)`; hit.style.width = S * 1.8 + "px"; hit.style.height = S * 3.6 + "px"; hit.style.bottom = GROUND + "px";
    bubble.style.transform = `translate(${Math.max(8, Math.min(W - 248, cap.x - 120))}px, 0)`; bubble.style.bottom = GROUND + S * 3.7 + "px";
    window.addEventListener("resize", render1);
    toggle.addEventListener("click", render1);
    layer.hidden = off; hit.hidden = off; bubble.hidden = off;
    toggle.textContent = off ? "Show captain" : "Hide captain";
    return;
  }
  applyOff();
  brain();
})();
