/* three.js stages for the page's 3D props.
   - the coin rides the emission filament; main.js drives it via window.__astro.setPose
   - the astronaut sits in ch-05 and follows the pointer
   Both render on demand — nothing runs while the page is idle and off-screen. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COIN_GREEN = 0x8fe424;   // sampled from the reference swatch
const SPINS = 3;
const BASE_X = -0.42;

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let loader = null;
const getLoader = () => (loader ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));

/* The compressed GLB merged every part into a single material, so the exhaust
   plume can't be restyled on its own — it renders as a pale plastic lump. Instead
   we bury it under a real thrust: an additive cone (no depth write, so it reads as
   emission rather than geometry) plus a point light that throws green onto the hull. */
/* Flame texture, drawn once into a canvas. This is the standard additive-sprite
   fire technique; doing it procedurally avoids shipping a third-party sprite sheet
   of unclear licence and keeps the page dependency-free.
   The hot core sits off-centre toward the nozzle so the plume tapers away from it. */
/* A tapering jet with turbulent filaments, drawn into a canvas. Nozzle is at the
   right edge; the plume thins and frays toward the left. Procedural rather than a
   downloaded sprite sheet — no third-party asset of unclear licence in the repo. */
function flameTexture() {
  const W = 512, H = 160;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';

  // tapering body: bright and narrow at the nozzle, wide and faint at the tail
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;                        // 0 = nozzle, 1 = tail
    const x = W * (1 - t);
    const half = H * 0.5 * (0.14 + 0.62 * Math.sin(Math.PI * Math.min(1, t * 1.1)));
    const a = Math.pow(1 - t, 2.1) * 0.62;
    const g = ctx.createLinearGradient(0, H / 2 - half, 0, H / 2 + half);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,' + a.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 7, H / 2 - half, 12, half * 2);
  }

  // turbulent filaments streaming off the core
  for (let s = 0; s < 30; s++) {
    const phase = s * 1.7, spread = (s % 2 ? 1 : -1) * (0.05 + (s % 5) * 0.05);
    ctx.beginPath();
    for (let x = W; x > 0; x -= 6) {
      const t = 1 - x / W;
      const y = H / 2 + Math.sin(x * 0.045 + phase) * H * 0.30 * t * t + spread * H * t;
      if (x === W) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.05 + Math.random() * 0.06).toFixed(3) + ')';
    ctx.lineWidth = 1 + Math.random() * 1.6;
    ctx.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function addThrust(pivot, fit) {
  const tex = flameTexture();
  const group = new THREE.Group();
  const puffs = [];

  /* Billboard sprites rather than a cone: geometry gives fire a hard silhouette,
     which is exactly what read as a flat triangle. depthTest:false also lets the
     plume paint over the GLB's plastic exhaust lump, which can't be restyled on
     its own because the compressed model merged every part into one material.
     Sprites are stretched along x so the plume trails instead of reading as a ball. */
  /* -x is toward the nozzle on this model, so the plume trails that way.
     The first entry is a round bloom sitting ON the thruster so the glow wraps it;
     the rest taper. Aspect ratios stay near-square deliberately — the previous wide,
     flat ellipse read as a floor reflection rather than exhaust. */
  /* One long jet, not a stack of blobs — the round bloom read as a glow smear.
     Layered twice at different lengths so the filaments cross and shimmer. */
  [
    { w: 1.02, h: 0.30, o: 0.80, c: 0xd8ff5e, x: -0.44 },
    { w: 0.74, h: 0.18, o: 0.95, c: 0xf6ffd0, x: -0.30 }
  ].forEach((d) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: d.c, transparent: true, opacity: d.o,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    sp.scale.set(fit * d.w, fit * d.h, 1);
    sp.position.x = fit * d.x;
    group.add(sp);
    puffs.push({ sp, w: fit * d.w, h: fit * d.h, baseOpacity: d.o });
  });

  /* embers: a few small sprites drifting back down the plume */
  const sparks = [];
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: 0xd4fa7c, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    const s = fit * (0.05 + (i % 3) * 0.018);
    sp.scale.set(s, s, 1);
    group.add(sp);
    sparks.push({ sp, seed: i * 1.37, size: s });
  }

  const light = new THREE.PointLight(0xa6e635, 6, fit * 1.8, 2);
  light.position.x = -fit * 0.10;
  group.add(light);

  group.position.set(-fit * 0.12, -fit * 0.13, 0);   // jet starts at the nozzle mouth
  group.renderOrder = 999;
  pivot.add(group);
  return { group, puffs, sparks, light, fit };
}

function buildStage(el, opts) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) {
    return null; // no WebGL — the stage just stays invisible
  }

  const size = () => ({ w: el.clientWidth || 160, h: el.clientHeight || el.clientWidth || 160 });
  const s0 = size();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2));
  renderer.setSize(s0.w, s0.h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, s0.w / s0.h, 0.1, 100);
  camera.position.set(0, 0, 6);

  /* studio environment drives the reflections; the lights add directional shape on top */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, opts.keyIntensity);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(COIN_GREEN, opts.rimIntensity); // brand rim, matches the filament
  rim.position.set(-3, 1, -2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xbfd8ff, opts.fillIntensity);
  fill.position.set(-2, -1.5, 2);
  scene.add(fill);
  const glint = new THREE.PointLight(0xffffff, opts.glintIntensity, 16, 2);
  glint.position.set(-1.4, 1.8, 3.2);
  scene.add(glint);
  scene.add(new THREE.AmbientLight(0xffffff, opts.ambient));

  const pivot = new THREE.Group();
  scene.add(pivot);

  const api = { pivot, thrust: null, schedule, render, setLooping: (v) => { looping = v; } };

  let dirty = true, raf = null, looping = false;
  function render() { dirty = false; renderer.render(scene, camera); }
  function schedule() {
    dirty = true;
    if (raf === null && !looping) raf = requestAnimationFrame(() => { raf = null; if (dirty) render(); });
  }

  getLoader().load(opts.model, (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const extent = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(extent);
    box.getCenter(center);
    model.position.sub(center);                 // centre on the pivot so it turns in place
    model.scale.setScalar(opts.fit / Math.max(extent.x, extent.y, extent.z));
    /* Mirror to face the other way: the model's visor is only readable from one
       side, so yaw alone can't give both "nose right" and "face visible".
       three.js flips winding for a negative determinant, so lighting stays correct. */
    if (opts.mirror) model.scale.x *= -1;

    model.traverse((o) => {
      const mats = o.isMesh ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => {
        if (!m || !m.isMeshStandardMaterial) return;
        /* the GLBs ship matte roughness, which swallows the studio env and reads flat.
           Scene.environmentIntensity doesn't exist in r160, so this is per-material. */
        m.envMapIntensity = opts.envIntensity;
        m.roughness = Math.min(m.roughness, opts.maxRoughness);
        if (opts.minMetalness != null) m.metalness = Math.max(m.metalness, opts.minMetalness);
        if (opts.tint != null) m.color.lerp(new THREE.Color(opts.tint), opts.tintAmount);
        m.needsUpdate = true;
      });
    });

    pivot.add(model);
    if (opts.thrust) api.thrust = addThrust(pivot, opts.fit);
    pivot.rotation.set(opts.baseX, opts.baseY, 0);
    el.classList.add('is-ready');
    opts.onLoad && opts.onLoad();
    schedule();
  }, undefined, () => { el.style.display = 'none'; });

  new ResizeObserver(() => {
    const s = size();
    camera.aspect = s.w / Math.max(1, s.h);
    camera.updateProjectionMatrix();
    renderer.setSize(s.w, s.h, false);
    schedule();
  }).observe(el);

  return api;
}

/* ---------- the coin, riding the filament ---------- */
const riderEl = document.querySelector('[data-astro-stage]');
if (riderEl && !reduce) {
  const stage = buildStage(riderEl, {
    model: riderEl.dataset.model || 'coin.glb',
    fit: 2.4, baseX: BASE_X, baseY: 0, exposure: 1.1,
    keyIntensity: 2.4, rimIntensity: 2.8, fillIntensity: 0.5, glintIntensity: 14, ambient: 0.4,
    envIntensity: 2.2, maxRoughness: 0.32, minMetalness: 0.85,
    tint: COIN_GREEN, tintAmount: 0.55
  });
  if (stage) {
    window.__astro = {
      /* progress 0-1 along the filament, tilt in radians (0 = travelling straight down) */
      setPose(progress, tilt) {
        stage.pivot.rotation.y = progress * Math.PI * 2 * SPINS;
        stage.pivot.rotation.z = clamp(-tilt * 0.35, -0.16, 0.16);
        stage.schedule();
      }
    };
  }
}

/* ---------- the astronaut in ch-05 ---------- */
/* Built lazily. Eagerly creating it cost a second WebGL context, a PMREM env bake
   and a 1.2MB GLB decode during page load — for a prop that lives ~6800px down the
   page. That was the ~2s hitch on refresh. It now builds as it comes into range. */
const sceneEl = document.querySelector('[data-astro-scene]');
if (sceneEl && !reduce) {
  let built = false;
  const warm = new IntersectionObserver((entries) => {
    if (built || !entries[0].isIntersecting) return;
    built = true;
    warm.disconnect();
    buildAstronaut(sceneEl);
  }, { rootMargin: '900px' });
  warm.observe(sceneEl);
}

function buildAstronaut(sceneEl) {
  const REST_Y = 0;   // model's own hero angle: visor to camera, nose and coin to the right
  const stage = buildStage(sceneEl, {
    model: sceneEl.dataset.model || 'astronaut.glb',
    fit: 2.0, baseX: -0.06, baseY: REST_Y, exposure: 0.98, maxDpr: 1.5, thrust: true,
    /* a white suit blows out fast — keep the key modest, the green rim as a hint
       rather than an outline, and let the environment do the reflection work */
    keyIntensity: 1.7, rimIntensity: 0.9, fillIntensity: 0.45, glintIntensity: 4, ambient: 0.34,
    envIntensity: 1.15, maxRoughness: 0.7
  });

  if (stage) {
    const REST_X = -0.06;
    let targetYaw = REST_Y, targetPitch = REST_X;
    let yaw = REST_Y, pitch = REST_X, t = 0, visible = false, last = 0;

    /* drag to turn it: the pointer has to be pressed, and where you leave it is
       where it stays — no snap back to a rest pose */
    let dragging = false, lastX = 0, lastY = 0;
    sceneEl.style.touchAction = 'none';

    sceneEl.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      sceneEl.classList.add('is-dragging');
      try { sceneEl.setPointerCapture(e.pointerId); } catch (err) {}
    });
    sceneEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      targetYaw += (e.clientX - lastX) * 0.009;
      targetPitch = clamp(targetPitch + (e.clientY - lastY) * 0.006, -0.55, 0.55);
      lastX = e.clientX; lastY = e.clientY;
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      sceneEl.classList.remove('is-dragging');
      try { sceneEl.releasePointerCapture(e.pointerId); } catch (err) {}
    };
    sceneEl.addEventListener('pointerup', endDrag);
    sceneEl.addEventListener('pointercancel', endDrag);

    let frame = 0;
    function loop(now) {
      if (!visible) return;
      /* the drift is slow and this canvas is large — rendering it every frame is
         wasted GPU that shows up as scroll jitter. Half rate is indistinguishable. */
      if ((frame++ & 1) === 0) { requestAnimationFrame(loop); return; }
      /* time-based damping: a fixed per-frame step stutters whenever the browser
         drops or doubles frames, which is what made the drift look glitchy */
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      t += dt;
      const k = 1 - Math.pow(0.0015, dt);
      yaw += (targetYaw - yaw) * k;
      pitch += (targetPitch - pitch) * k;
      stage.pivot.rotation.y = yaw + Math.sin(t * 0.45) * 0.035;
      stage.pivot.rotation.x = pitch;
      stage.pivot.position.y = Math.sin(t * 0.9) * 0.05;   // idle drift

      /* flame flicker: two out-of-phase sines per puff so it never pulses in unison */
      if (stage.thrust) {
        stage.thrust.puffs.forEach((p, i) => {
          const f = 1 + Math.sin(t * (7 + i * 2.3) + i) * 0.12 + Math.sin(t * (13 + i * 3.1)) * 0.06;
          p.sp.scale.set(p.w * f, p.h * (2 - f), 1);   // stretches long as it narrows
          p.sp.material.opacity = p.baseOpacity * (0.8 + 0.2 * f);
        });
        /* embers ride back along the plume and fade, then recycle */
        var F = stage.thrust.fit;
        stage.thrust.sparks.forEach(function (s) {
          var life = ((t * 0.55 + s.seed) % 1);
          s.sp.position.x = -F * (0.05 + life * 0.72);
          s.sp.position.y = Math.sin(s.seed * 5 + t * 2.2) * F * 0.045 * life;
          s.sp.material.opacity = 0.55 * (1 - life) * (1 - life);
          var sc = s.size * (1 + life * 0.7);
          s.sp.scale.set(sc, sc, 1);
        });
        stage.thrust.light.intensity = 6 * (0.85 + 0.15 * Math.sin(t * 11));
      }

      stage.render();
      requestAnimationFrame(loop);
    }

    window.__astroScene = {
      pivot: stage.pivot,
      thrustAt(x, y) { if (stage.thrust) { stage.thrust.group.position.set(x, y, 0); stage.render(); } },
      setYaw(v) { targetYaw = v; yaw = v; },
      setPitch(v) { targetPitch = v; pitch = v; }
    };

    /* only animate while it's actually on screen */
    new IntersectionObserver((entries) => {
      const next = entries[0].isIntersecting;
      if (next === visible) return;
      visible = next;
      stage.setLooping(visible);
      last = 0;                       // don't carry a stale timestamp across a pause
      if (visible) requestAnimationFrame(loop);
    }, { rootMargin: '120px' }).observe(sceneEl);
  }
}
