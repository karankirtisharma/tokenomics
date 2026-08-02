/* Mouse-following ribbon trails, rendered behind the page content.
   Ported from a makio-meshline / WebGPU-TSL sketch onto this project's stack:
   three r160 on WebGL with no bundler, so `makio-meshline`, `three/tsl` and
   `three/webgpu` aren't available. Line2 from the three addons is the closest
   equivalent to MeshLine — it gives real pixel line width, which plain
   THREE.Line cannot. The spring/friction chain, per-line angular offset and
   speed-driven width are the same behaviour as the original.

   Palette is the page's own green family rather than the sketch's, to keep the
   background on-brand. */
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const NUM_POINTS = 20;
const NUM_LINES = 4;
const GREENS = [0xa6e635, 0x8fe424, 0xc6ff78, 0x5f9c17];

const host = document.querySelector('[data-trails]');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(hover: none)').matches;   // no pointer to follow

if (host && !reduce && !coarse) init(host);

function init(host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  /* 1 world unit = 1 css pixel, so pointer coords map straight through */
  let camera = makeCamera();
  function makeCamera() {
    const w = window.innerWidth, h = window.innerHeight;
    return new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -100, 100);
  }

  const target = new THREE.Vector3();
  const force = new THREE.Vector3();
  const targetOffset = new THREE.Vector3();
  const lines = [];

  for (let i = 0; i < NUM_LINES; i++) {
    const angle = (i / NUM_LINES) * Math.PI * 2;
    const radius = 26 + (Math.random() * 2 - 1) * 12;
    const offset = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const points = Array.from({ length: NUM_POINTS }, () => offset.clone());
    const positions = new Float32Array(NUM_POINTS * 3);

    const geometry = new LineGeometry();
    geometry.setPositions(Array.from(positions));

    /* brightness ramps down along the tail — on a near-black page that reads as
       the taper the original got from its per-vertex widthCallback */
    const base = new THREE.Color(GREENS[i % GREENS.length]);
    const colors = [];
    for (let p = 0; p < NUM_POINTS; p++) {
      const k = Math.pow(1 - p / (NUM_POINTS - 1), 1.6);
      colors.push(base.r * k, base.g * k, base.b * k);
    }
    geometry.setColors(colors);

    const material = new LineMaterial({
      linewidth: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      dashed: false
    });
    material.resolution.set(window.innerWidth, window.innerHeight);

    const mesh = new Line2(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    lines.push({
      points, positions, offset, mesh, material,
      velocity: new THREE.Vector3(),
      spring: 0.06 + (Math.random() * 2 - 1) * 0.02,
      friction: 0.85 + (Math.random() * 2 - 1) * 0.05
    });
  }

  let speed = 0, lastX = 0, lastY = 0, hasPointer = false;
  window.addEventListener('pointermove', (e) => {
    target.set(e.clientX - window.innerWidth / 2, -(e.clientY - window.innerHeight / 2), 0);
    if (hasPointer) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      speed = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 0.06);
    }
    lastX = e.clientX; lastY = e.clientY;
    hasPointer = true;
    wake();
  }, { passive: true });

  window.addEventListener('resize', () => {
    camera = makeCamera();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    lines.forEach(l => l.material.resolution.set(window.innerWidth, window.innerHeight));
    wake();
  });

  /* Render on demand. The trail only needs frames while the pointer is moving or
     the chain is still settling — a permanent rAF loop behind a scrolling page is
     exactly the kind of always-on cost worth avoiding. */
  let raf = null, idle = 0;
  function wake() { idle = 0; if (raf === null) raf = requestAnimationFrame(frame); }

  function frame() {
    raf = null;
    let motion = 0;

    lines.forEach((line) => {
      for (let i = NUM_POINTS - 1; i >= 0; i--) {
        if (i === 0) {
          targetOffset.copy(target).add(line.offset);
          force.copy(targetOffset).sub(line.points[0]).multiplyScalar(line.spring);
          line.velocity.add(force).multiplyScalar(line.friction);
          line.points[0].add(line.velocity);
          motion = Math.max(motion, line.velocity.lengthSq());
        } else {
          line.points[i].lerp(line.points[i - 1], 0.9);
        }
      }
      const flat = [];
      for (let i = 0; i < NUM_POINTS; i++) {
        const p = line.points[i];
        flat.push(p.x, p.y, p.z);
      }
      line.mesh.geometry.setPositions(flat);
    });

    speed *= 0.92;
    const w = 1.2 + speed * 5.5;
    lines.forEach(l => { l.material.linewidth += (w - l.material.linewidth) * 0.15; });

    renderer.render(scene, camera);

    /* keep going while anything is still moving, then stop cleanly */
    idle = motion < 0.02 && speed < 0.01 ? idle + 1 : 0;
    if (idle < 40) raf = requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  wake();
}
