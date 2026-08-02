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

  const api = { pivot, schedule, render, setLooping: (v) => { looping = v; } };

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

    /* The exhaust plume is part of the single merged material, so it can't be given
       its own emissive. Lighting it instead gets there: a short-range green point
       light sitting inside the plume makes that pale mesh read as lit from within,
       and spills a little onto the nozzle. */
    if (opts.plumeLight) {
      const glow = new THREE.PointLight(0x8fe424, opts.plumeLight, opts.fit * 0.8, 2);
      glow.position.set(-opts.fit * 0.46, -opts.fit * 0.17, 0);
      pivot.add(glow);
    }

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
  const build = () => {
    if (built) return;
    built = true;
    warm.disconnect();
    buildAstronaut(sceneEl);
  };
  /* Building costs a WebGL context, a PMREM bake and a GLB decode — about two
     seconds. Doing it at load stalled the first paint; doing it purely on approach
     just moved the stall into the scroll. Build on the first idle slot instead, so
     it lands while the reader is still on the hero, with the observer as a
     fallback for anyone who scrolls down faster than that. */
  const warm = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) build();
  }, { rootMargin: '900px' });
  warm.observe(sceneEl);

  if ('requestIdleCallback' in window) requestIdleCallback(build, { timeout: 2500 });
  else setTimeout(build, 1200);
}

function buildAstronaut(sceneEl) {
  const REST_Y = 0;   // model's own hero angle: visor to camera, nose and coin to the right
  const stage = buildStage(sceneEl, {
    model: sceneEl.dataset.model || 'astronaut.glb',
    fit: 2.0, baseX: -0.06, baseY: REST_Y, exposure: 0.98, maxDpr: 1.5, plumeLight: 18,
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
      stage.render();
      requestAnimationFrame(loop);
    }

    window.__astroScene = {
      pivot: stage.pivot,
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
