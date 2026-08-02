/* Cyphernaut — Tokenomics page behaviour.
   Chapter numbers are kept because these chapters are a genuine sequence:
   design (01-05) -> model (06) -> audit (07). Not decoration. */
(() => {
  const root = document.querySelector('[data-page="tokenomics"]');
  if (!root) return;

  const q = (sel, ctx) => Array.prototype.slice.call((ctx || root).querySelectorAll(sel));

  /* Static fallback: reveal everything the animations would otherwise have
     staged, so the page is fully readable without GSAP or with reduced motion. */
  function unhide() {
    q('[data-w],[data-fade],[data-close],[data-audit-row],[data-cliff],[data-bar],[data-vdivider],[data-wide],[data-num]').forEach(el => {
      el.style.opacity = ''; el.style.transform = ''; el.style.clipPath = ''; el.style.visibility = '';
    });
    q('[data-trunk],[data-curve],[data-ring],[data-sinkflow],[data-filament] g path,[data-spokes] path,[data-nodes] > *,[data-sinkmap] text').forEach(p => {
      p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; p.style.opacity = ''; p.style.transform = '';
    });
    q('[data-count]').forEach(el => {
      const t = parseFloat(el.getAttribute('data-count'));
      const dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const suf = el.getAttribute('data-suffix') || '';
      el.textContent = (dec ? t.toFixed(dec) : Math.round(t).toLocaleString('en-US')) + suf;
    });
  }

  /* ---------- interactions that must work with or without GSAP ---------- */
  function wireStatic() {
    q('[data-index]').forEach(wrap => {
      const btn = wrap.querySelector('[data-index-toggle]');
      const body = wrap.querySelector('[data-index-body]');
      const mark = wrap.querySelector('[data-index-mark]');
      if (!btn || !body) return;
      let open = false;
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => {
        open = !open;
        btn.setAttribute('aria-expanded', String(open));
        const h = body.firstElementChild ? body.firstElementChild.scrollHeight : body.scrollHeight;
        if (window.gsap) {
          gsap.to(body, { height: open ? h : 0, duration: .5, ease: 'power3.inOut' });
          gsap.to(mark, { rotate: open ? 45 : 0, borderColor: open ? '#A6E635' : 'rgba(255,255,255,.2)', duration: .5, ease: 'power3.inOut' });
        } else {
          body.style.height = open ? h + 'px' : '0px';
        }
      });
    });

    const S = {
      bull: {
        curve: 'M0,352 C220,320 380,214 540,140 C700,70 850,44 1000,30',
        pressure: 'M0,90 C220,150 380,236 540,286 C700,318 850,336 1000,348',
        pressureVal: '0.8x', runway: '71 MO', staking: '62%', exhaust: 'M44',
        note: 'Bull case assumes sustained usage growth and fee revenue funding rewards before emissions do.'
      },
      base: {
        curve: 'M0,352 C220,336 380,282 540,232 C700,180 850,140 1000,116',
        pressure: 'M0,60 C220,110 380,190 540,232 C700,272 850,300 1000,316',
        pressureVal: '2.4x', runway: '38 MO', staking: '41%', exhaust: 'M31',
        note: 'Base case assumes moderate usage growth and no discretionary emission increase. All figures are scenario outputs, not forecasts.'
      },
      bear: {
        curve: 'M0,352 C220,344 380,326 540,318 C700,312 850,326 1000,346',
        pressure: 'M0,30 C220,54 380,96 540,130 C700,152 850,158 1000,160',
        pressureVal: '6.1x', runway: '14 MO', staking: '19%', exhaust: 'M17',
        note: 'Bear case holds emissions flat while usage stalls. Sell pressure exceeds organic demand from month nine.'
      }
    };
    const curve = root.querySelector('[data-scenario-curve]');
    const press = root.querySelector('[data-scenario-pressure]');
    const note = root.querySelector('[data-scenario-note]');
    const outs = {
      pressure: root.querySelector('[data-readout="pressure"]'),
      runway: root.querySelector('[data-readout="runway"]'),
      staking: root.querySelector('[data-readout="staking"]'),
      exhaust: root.querySelector('[data-readout="exhaust"]')
    };
    const btns = q('[data-scenario]');
    const set = key => {
      const d = S[key];
      if (!d) return;
      btns.forEach(b => {
        const on = b.getAttribute('data-scenario') === key;
        b.setAttribute('aria-selected', String(on));
        b.style.color = on ? '#F1F4EF' : '#676E66';
      });
      if (window.gsap) {
        gsap.to(curve, { attr: { d: d.curve }, duration: 1.1, ease: 'power4.out' });
        gsap.to(press, { attr: { d: d.pressure }, duration: 1.1, ease: 'power4.out' });
        ['pressure', 'runway', 'staking', 'exhaust'].forEach((k, i) => {
          const el = outs[k]; if (!el) return;
          gsap.timeline({ delay: i * 0.045 })
            .to(el, { yPercent: -32, opacity: 0, duration: .22, ease: 'power2.in' })
            .add(() => { el.textContent = d[k === 'pressure' ? 'pressureVal' : k]; })
            .fromTo(el, { yPercent: 32, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .55, ease: 'power4.out' });
        });
        if (note) gsap.fromTo(note, { opacity: 0 }, { opacity: 1, duration: .7, ease: 'power2.out', onStart: () => { note.textContent = d.note; } });
      } else {
        curve.setAttribute('d', d.curve); press.setAttribute('d', d.pressure);
        outs.pressure.textContent = d.pressureVal; outs.runway.textContent = d.runway;
        outs.staking.textContent = d.staking; outs.exhaust.textContent = d.exhaust;
        if (note) note.textContent = d.note;
      }
    };
    btns.forEach(b => b.addEventListener('click', () => set(b.getAttribute('data-scenario'))));
  }

  function initSmooth() {
    /* Lenis over Locomotive: Locomotive v5 is a wrapper around Lenis anyway, and
       this is already driven off the gsap ticker so ScrollTrigger stays in sync.
       Lower lerp = longer glide; touch is left native, where syncTouch tends to
       fight the OS and feel worse than it reads on paper. */
    const lenis = new Lenis({
      lerp: 0.085,          // 0.065 read as floaty/laggy; this keeps the glide but tracks the wheel
      wheelMultiplier: 1,
      smoothWheel: true,
      autoResize: true
    });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    q('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const t = document.querySelector(a.getAttribute('href'));
        if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -80, duration: 1.4 }); }
      });
    });
  }

  /* every section heading unfolds off a 3D hinge, one line after the other.
     The hero's two lines are excluded — they carry their own effects. */
  function initHeadings() {
    q('h2').forEach(el => {
      if (el.hasAttribute('data-crop')) return;   // ch-03 keeps its own width-crop reveal
      const lines = Array.prototype.filter.call(el.children, (c) => c.tagName === 'SPAN');
      const targets = lines.length ? lines : [el];
      /* These lines are full-width blocks. Hinging one at its edge and swinging it
         a full 90deg under perspective throws the near edge at the camera, so the
         type balloons across the page mid-flight. Rotate about the centre and stop
         short of edge-on: same unfold, stays inside its own box. */
      gsap.set(el, { perspective: 900 });
      gsap.from(targets, {
        rotationY: -62, rotationX: 26,
        opacity: 0, scale: 0.78,
        transformOrigin: '50% 50%',
        duration: 1.1, ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: el, start: 'top 84%', once: true,
          onEnter: () => el.style.willChange = 'transform',
          onLeave: () => el.style.willChange = 'auto'
        }
      });
    });
  }

  function initReveals() {
    q('[data-fade]').forEach(el => {
      gsap.fromTo(el, { y: 18, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1.1, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      });
    });
    const close = root.querySelector('[data-close]');
    if (close) gsap.fromTo(close, { opacity: 0 }, { opacity: 1, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: close, start: 'top 82%', once: true } });
  }

  /* hero: caps line zooms out into place, cursive line flickers on like a neon sign */
  function initHeroText() {
    const grav = root.querySelector('[data-gravity]');
    if (grav) {
      gsap.from(grav, { scale: 3, opacity: 0, duration: 1.2, ease: 'power4.out' });
    }

    if (!window.SplitText) return;
    gsap.registerPlugin(SplitText);
    const neon = root.querySelector('[data-neon]');
    if (neon) {
      /* chars stay display:inline so Dancing Script keeps its joins — we only
         animate opacity/text-shadow here, so no layout box is needed */
      const split = SplitText.create(neon, { type: 'words,chars' });
      gsap.set(split.chars, { display: 'inline', opacity: 0 });
      const tl = gsap.timeline({ delay: 0.5 });
      split.chars.forEach((ch, i) => {
        tl.to(ch, { opacity: 1, duration: 0.05 }, i * 0.15)
          .to(ch, { opacity: 0.3, duration: 0.03 }, i * 0.15 + 0.05)
          .to(ch, { opacity: 1, textShadow: '0 0 10px #A6E635', duration: 0.1 }, i * 0.15 + 0.08);
      });
    }
  }

  /* Every remaining static mono label resolves out of ASCII noise as its section
     arrives. Batched one trigger per section rather than one per label — there are
     ~90 of them, and that many ScrollTriggers is a real cost for no visual gain. */
  function initGlitchText() {
    if (!window.ScrambleTextPlugin) return;
    gsap.registerPlugin(ScrambleTextPlugin);
    const CHARS = '!<>-_\\/[]{}=+*^?#01';

    q('section').forEach(sec => {
      /* match on the inline font declaration rather than getComputedStyle — resolving
         styles for every element on the page stalled the first frame after load */
      const seen = new Set();
      q('[style*="JetBrains Mono"]', sec).forEach(host => {
        if (host.closest('h1, h2, p')) return;
        const kids = host.children.length ? host.querySelectorAll('*') : [host];
        kids.forEach(el => {
          if (el.children.length || !el.textContent.trim()) return;
          if (el.hasAttribute('data-count') || el.hasAttribute('data-readout')) return;
          seen.add(el);
        });
      });
      const labels = Array.from(seen);
      if (!labels.length) return;

      const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 78%', once: true } });
      labels.forEach((el, i) => {
        const text = el.textContent;
        tl.to(el, {
          duration: Math.min(1.1, 0.3 + text.length * 0.025),
          ease: 'none',
          scrambleText: { text: text, chars: CHARS, speed: 0.5, revealDelay: 0.08 }
        }, i * 0.035);
      });
    });
  }

  /* every paragraph types itself in when it scrolls into view */
  function initTypewriter() {
    if (!window.TextPlugin) return;
    gsap.registerPlugin(TextPlugin);
    q('p').forEach(p => {
      const full = p.textContent.trim();
      if (!full) return;
      /* lock the height first — clearing the text would otherwise reflow the
         page and shift every ScrollTrigger (and the astronaut's path mapping) */
      p.style.minHeight = p.getBoundingClientRect().height + 'px';
      p.textContent = '';
      gsap.to(p, {
        text: { value: full, delimiter: '' },
        duration: Math.max(1.1, Math.min(3.4, full.length / 30)),
        ease: 'none',
        scrollTrigger: { trigger: p, start: 'top 88%', once: true },
        onStart: () => p.classList.add('is-typing'),
        onComplete: () => p.classList.remove('is-typing')
      });
    });
  }

  /* the audit readout's lid hinges open as you scroll it into view */
  function initLaptop() {
    const lap = root.querySelector('.laptop');
    const lid = root.querySelector('.laptop-screen');
    if (!lap || !lid) return;
    gsap.fromTo(lid,
      { rotateX: -86 },
      {
        rotateX: 0, ease: 'none',
        scrollTrigger: {
          trigger: lap,
          start: 'top 88%',
          end: 'top 38%',
          scrub: 0.6            // tied to scroll so the open is seamless, not a one-shot
        }
      }
    );
  }

  /* the through-line: one filament, dashoffset scrubbed 1:1 with page scroll */
  function initFilament() {
    const trunk = root.querySelector('[data-trunk]');
    if (!trunk) return;
    const len = trunk.getTotalLength();
    gsap.set(trunk, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(trunk, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1 },
      /* `this` is the tween — its own progress is the drawn tip, so the
         astronaut stays glued to the line even while scrub is easing */
      onUpdate: function () { rideFilament(this.progress()); }
    });
    /* the branch strokes used to draw in alongside the trunk; the filament is hidden
       now, so those 10 scrubbed triggers were pure cost and are gone. The trunk tween
       above stays — its progress is what flies the coin. */
  }

  /* ---------- astronaut riding the filament ---------- */
  /* The filament svg is preserveAspectRatio="none", so its 1000x9000 viewBox maps
     linearly onto [data-filament]'s box. We sample the trunk path once into a
     lookup table (viewBox space, so it survives resizes) and read positions from
     that each frame instead of hitting getPointAtLength on every update. */
  const VB_W = 1000, VB_H = 9000, LUT_N = 240;
  let lut = null, astroStage = null, astroFil = null, lastRide = 0, astroTilt = 0;
  let heroSection = null, heroGeo = null, astroHalf = 70, astroBehind = null, astroVisible = true;

  /* The coin's flight path, as fractions of the viewport: scroll progress -> x.
     The filament it used to trace is hidden now, so the path is authored directly
     instead of being solved against the line. Waypoints are interpolated with a
     smoothstep, which has zero slope at both ends of every segment — so the curve
     has no corner where two segments meet, and the coin never changes direction
     abruptly. Detour bumps that snapped back to the line caused that jerk. */
  /* Where the coin stops flying for good. It eases off the flight path onto an
     element and then stays there — the weight never returns to 0, so there is no
     onward travel. Anchoring to the element rather than freezing a viewport
     position is what makes it stick to that spot in the page: the content it sits
     with keeps scrolling, and the coin goes with it. */
  const ANCHORS = [
    { from: 0.575, ramp: 0.07, sel: '#ch-04 [data-num]', dx: 25, dy: -125 }
  ];

  function anchorWeight(t, a) {
    if (t <= a.from) return 0;
    const u = Math.min(1, (t - a.from) / a.ramp);
    return u * u * (3 - 2 * u);            // smoothstep in, then hold at 1
  }

  /* p values are in flight-time (post-dwell) space, derived from the measured
     progress at which each section sits centred in the viewport. */
  /* x and y are both fractions of the viewport, so the whole trajectory is
     authored rather than x-authored over a fixed top-to-bottom glide. */
  const COIN_PATH = [
    { p: 0.000, x: 0.16, y: 0.62 },   // starts low-left, under the headline and clear of the copy
    { p: 0.124, x: 0.46, y: 0.42 },   // rises across the ch-01 panel
    { p: 0.382, x: 0.80, y: 0.30 },   // out right over the supply chart
    { p: 0.562, x: 0.66, y: 0.46 },   // eases through ch-03
    { p: 0.697, x: 0.22, y: 0.55 },   // hands over to the ch-04 anchor here
    { p: 1.000, x: 0.40, y: 0.60 }
  ];

  function coinAt(t, key) {
    if (t <= COIN_PATH[0].p) return COIN_PATH[0][key];
    for (let i = 1; i < COIN_PATH.length; i++) {
      const b = COIN_PATH[i];
      if (t <= b.p) {
        const a = COIN_PATH[i - 1];
        const u = (t - a.p) / (b.p - a.p);
        return a[key] + (b[key] - a[key]) * (u * u * (3 - 2 * u));   // smoothstep
      }
    }
    return COIN_PATH[COIN_PATH.length - 1][key];
  }

  /* Cached in document space and refreshed only on resize/refresh. Reading
     getBoundingClientRect() inside the scroll tween forced a layout every frame,
     right after ScrollTrigger had written transforms — classic thrash. */
  function measureAstro() {
    if (heroSection) {
      const h = heroSection.getBoundingClientRect();
      heroGeo = { docBottom: h.bottom + window.scrollY };
    }
    /* anchor targets in document space, so the per-frame path needs no layout read */
    ANCHORS.forEach(a => {
      const el = root.querySelector(a.sel);
      if (!el) { a.geo = null; return; }
      const r = el.getBoundingClientRect();
      a.geo = { x: r.left + r.width / 2 + (a.dx || 0), docY: r.top + window.scrollY + (a.dy || 0) };
    });
  }

  function rideFilament(progress) {
    if (!astroStage) return;
    lastRide = progress;
    const scrollY = window.scrollY;
    const vw = window.innerWidth, vh = window.innerHeight;
    const half = astroHalf;
    /* keep clear of the fixed nav at the top and stay fully visible at the bottom */
    const minY = half + 124, maxY = vh - half - 28;
    const t = Math.max(0, Math.min(1, progress));

    /* Drive by screen position, not by distance along the path: the astronaut
       glides evenly from the top of the viewport to the footer across the whole
       page, and we solve for the point of the filament sitting at that height so
       it is always ON the line. Following raw path-length instead made it pin to
       the top for half the page and then jump to the bottom. */
    let y = vh * coinAt(t, 'y');
    let x = vw * coinAt(t, 'x');

    /* park against a section: blend the free path toward the anchored point, hold
       there through the plateau, then blend back out — continuous at both ends */
    for (let i = 0; i < ANCHORS.length; i++) {
      const a = ANCHORS[i];
      if (!a.geo) continue;
      const w = anchorWeight(t, a);
      if (w <= 0) continue;
      x += (a.geo.x - x) * w;
      y += ((a.geo.docY - scrollY) - y) * w;
    }

    x = Math.max(half + 10, Math.min(vw - half - 10, x));
    astroStage.style.transform =
      'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%)';

    /* Once parked it rides that spot in the page, so it eventually scrolls out of
       view. Hide it there rather than leaving an off-screen layer composited. */
    const onScreen = y > -260 && y < vh + 260;
    if (onScreen !== astroVisible) {
      astroVisible = onScreen;
      astroStage.style.visibility = onScreen ? '' : 'hidden';
    }

    /* drop behind the hero headline while it's over that section, so the type stays
       legible. Guarded so a class write only happens on an actual change. */
    if (heroGeo) {
      const behind = heroGeo.docBottom - scrollY > y;
      if (behind !== astroBehind) { astroBehind = behind; astroStage.classList.toggle('is-behind', behind); }
    }

    /* bank from the path's own slope, then damp */
    const dx = (coinAt(Math.min(1, t + 0.012), 'x') - coinAt(Math.max(0, t - 0.012), 'x')) * vw;
    const dy = Math.max(1, (coinAt(Math.min(1, t + 0.012), 'y') - coinAt(Math.max(0, t - 0.012), 'y')) * vh);
    astroTilt += (Math.atan2(dx, dy || 1) - astroTilt) * 0.12;
    if (window.__astro) window.__astro.setPose(t, astroTilt);
  }

  function initAstronaut() {
    astroStage = root.querySelector('[data-astro-stage]');
    heroSection = root.querySelector('[data-screen-label="00 Hero"]');
    if (!astroStage) return;
    astroHalf = (astroStage.offsetWidth || 140) / 2;
    measureAstro();
    rideFilament(0);
    /* re-measure whenever the page geometry actually changes, not per frame */
    ScrollTrigger.addEventListener('refresh', () => {
      astroHalf = (astroStage.offsetWidth || 140) / 2;
      measureAstro();
      rideFilament(lastRide);
    });
    window.addEventListener('resize', () => {
      astroHalf = (astroStage.offsetWidth || 140) / 2;
      measureAstro();
      rideFilament(lastRide);
    });
  }

  function initParallax() {
    const mob = window.innerWidth < 768 ? 0.5 : 1;
    const atmos = root.querySelector('[data-atmos]');
    const fil = root.querySelector('[data-filament]');
    /* No atmospheric parallax. Translating the full-height container inflated the
       document by ~1200px (a transform still contributes to scrollable overflow),
       and moving it to the children put GSAP in a fight with their `drift` CSS
       keyframes over the same transform — CSS animations outrank inline styles, so
       the tween computed every scroll frame and was thrown away. The drift keyframes
       already supply the motion. */
    /* the filament is invisible now (the coin replaced it), so its parallax bought
       nothing and its downward translate was inflating the page height */
    q('[data-num]').forEach(n => {
      gsap.to(n, { yPercent: -4 * mob, ease: 'none', scrollTrigger: { trigger: n, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    });
    q('[data-vdivider]').forEach(d => {
      gsap.fromTo(d, { scaleY: 0 }, { scaleY: 1, transformOrigin: 'center', duration: 1.4, ease: 'power4.out', scrollTrigger: { trigger: d, start: 'top 85%', once: true } });
    });
    /* signature 2: chapter 01 sink map draws itself */
    const map = root.querySelector('[data-sinkmap]');
    if (map) {
      const tl = gsap.timeline({ scrollTrigger: { trigger: map, start: 'top 80%', once: true } });
      q('[data-ring]', map).forEach((r, i) => {
        const l = r.getTotalLength();
        gsap.set(r, { strokeDasharray: l, strokeDashoffset: l });
        tl.to(r, { strokeDashoffset: 0, duration: 1.4, ease: 'power4.out' }, i * 0.12);
      });
      tl.fromTo(q('[data-spokes] path', map), { opacity: 0 }, { opacity: 1, duration: .6, stagger: .04, ease: 'power2.out' }, .3);
      q('[data-sinkflow]', map).forEach((p, i) => {
        const l = p.getTotalLength();
        gsap.set(p, { strokeDasharray: l, strokeDashoffset: l });
        tl.to(p, { strokeDashoffset: 0, duration: 1.2, ease: 'power3.out' }, .5 + i * 0.1);
      });
      tl.fromTo(q('[data-nodes] > *', map), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, stagger: .05, ease: 'power4.out', transformOrigin: 'center' }, .7);
      tl.fromTo(q('text', map), { opacity: 0 }, { opacity: 1, duration: .5, stagger: .04 }, 1);
    }
  }

  /* the sink-map star stays put — only its own axis turns, scrubbed 1:1 with scroll through ch-01, like a compass needle */
  function initStarCompass() {
    const dial = root.querySelector('[data-star-compass]');
    const sec = document.getElementById('ch-01');
    if (!dial || !sec) return;
    /* base pose: rotated 45deg, the star's 8 points land at 0/45/90/135/180/225/270/315.
       against the sink map's 8 spokes (0 FEES, 60 STAKE, 90 REWARD, 120 ACCESS, 180
       SETTLE, 240 GOVERN, 270 DATA, 300 COLLAT) that's a dead-on hit for FEES/REWARD/
       SETTLE/DATA and 15deg off STAKE/ACCESS/GOVERN/COLLAT — no point is ever left
       pointing at empty space. */
    gsap.fromTo(dial, { rotate: 45 }, {
      rotate: 405, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  }

  function initCounters() {
    q('[data-count]').forEach(el => {
      const target = parseFloat(el.getAttribute('data-count'));
      const dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const suffix = el.getAttribute('data-suffix') || '';
      const obj = { v: 0 };
      const fmt = v => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + suffix;
      el.textContent = fmt(0);
      ScrollTrigger.create({
        trigger: el, start: 'top 84%', once: true,
        onEnter: () => gsap.to(obj, {
          v: target, duration: 1.6, ease: 'power2.out',
          snap: dec ? { v: 1 / Math.pow(10, dec) } : { v: 1 },
          onUpdate: () => { el.textContent = fmt(obj.v); }
        })
      });
    });
  }

  /* signature 3: the one pin on the page — supply curve scrubs, bars crop open */
  function initSupply() {
    if (window.innerWidth < 768) return;
    const wrap = root.querySelector('[data-pin-wrap]');
    const pin = root.querySelector('[data-pin]');
    if (!wrap || !pin) return;
    const em = root.querySelector('[data-curve="emission"]');
    const inf = root.querySelector('[data-curve="inflation"]');
    const cliff = root.querySelector('[data-cliff]');
    const bars = q('[data-bar]', pin);
    [em, inf].forEach(p => { if (!p) return; const l = p.getTotalLength(); gsap.set(p, { strokeDasharray: l, strokeDashoffset: l }); });
    if (cliff) gsap.set(cliff, { opacity: 0, scaleY: .6, transformOrigin: 'center' });
    gsap.set(bars, { scaleX: 0 });
    gsap.timeline({
      /* refreshPriority: the pin adds spacing to the page, so it has to measure
         before the root-triggered scrubs (filament, parallax, astronaut) — otherwise
         they size themselves to a shorter page and finish well above the footer */
      scrollTrigger: { trigger: wrap, start: 'top top', end: '+=180%', pin: pin, pinSpacing: true, scrub: true, anticipatePin: 1, refreshPriority: 1 }
    })
      .to(em, { strokeDashoffset: 0, ease: 'none', duration: 1 })
      .to(inf, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0.1)
      .to(cliff, { opacity: 1, scaleY: 1, duration: .3 }, 0.5)
      .to(bars, { scaleX: 1, duration: .5, stagger: .07, ease: 'power3.out' }, 0.55);
  }

  function initIncentives() {
    const h = root.querySelector('[data-crop]');
    if (h) {
      const lines = q('[data-wide]', h);
      gsap.set(lines, { clipPath: 'inset(0 100% 0 0)' });
      gsap.timeline({ scrollTrigger: { trigger: h, start: 'top 80%', once: true } })
        .to(lines, { clipPath: 'inset(0 0% 0 0)', duration: 1.3, stagger: .12, ease: 'power4.out' })
        .fromTo(lines, { fontVariationSettings: "'wght' 300, 'wdth' 78" }, { fontVariationSettings: "'wght' 300, 'wdth' 100", duration: 1.6, ease: 'expo.out' }, 0)
        .fromTo(lines[1], { fontVariationSettings: "'wght' 700, 'wdth' 78" }, { fontVariationSettings: "'wght' 700, 'wdth' 100", duration: 1.6, ease: 'expo.out' }, 0.12);
    }
    const decay = root.querySelector('[data-curve="decay"]');
    if (decay) {
      const l = decay.getTotalLength();
      gsap.set(decay, { strokeDasharray: l, strokeDashoffset: l });
      gsap.to(decay, { strokeDashoffset: 0, duration: 1.6, ease: 'power3.inOut', scrollTrigger: { trigger: decay, start: 'top 84%', once: true } });
    }
  }

  function initAccrual() {
    const sec = document.getElementById('ch-04');
    if (!sec) return;
    const bars = q('[data-bar]', sec);
    gsap.set(bars, { scaleX: 0 });
    gsap.to(bars, { scaleX: 1, duration: 1.2, ease: 'power4.out', scrollTrigger: { trigger: sec, start: 'top 70%', once: true } });
  }

  function initAudit() {
    const inv = root.querySelector('[data-invert]');
    if (!inv) return;
    const rows = q('[data-audit-row]', inv);
    const bars = q('[data-bar]', inv);
    gsap.set(rows, { opacity: 0, x: -12 });
    gsap.set(bars, { scaleX: 0 });
    gsap.timeline({ scrollTrigger: { trigger: inv, start: 'top 72%', once: true } })
      .to(rows, { opacity: 1, x: 0, duration: .8, stagger: .06, ease: 'power4.out' })
      /* severity meters draw after their row lands, so the ranking reads as a result */
      .to(bars, { scaleX: 1, duration: .9, stagger: .06, ease: 'power3.out' }, 0.28);
  }

  function initNav() {
    const nav = root.querySelector('[data-nav]');
    if (!nav) return;
    q('[data-panel-section], [data-invert]').forEach(sec => {
      ScrollTrigger.create({
        trigger: sec, start: 'top 90px', end: 'bottom 90px',
        onToggle: self => gsap.to(nav, { opacity: self.isActive ? .4 : 1, duration: .5, ease: 'power3.out' })
      });
    });
  }

  function initMagnets() {
    q('[data-magnet]').forEach(el => {
      const x = gsap.quickTo(el, 'x', { duration: .4, ease: 'power3' });
      const y = gsap.quickTo(el, 'y', { duration: .4, ease: 'power3' });
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        x(gsap.utils.clamp(-6, 6, (e.clientX - (r.left + r.width / 2)) * .3));
        y(gsap.utils.clamp(-6, 6, (e.clientY - (r.top + r.height / 2)) * .3));
      });
      el.addEventListener('mouseleave', () => { x(0); y(0); });
    });
    const cta = root.querySelector('[data-cta]');
    if (cta) {
      cta.addEventListener('mouseenter', () => gsap.to(cta, { borderColor: '#A6E635', duration: .4, ease: 'power3' }));
      cta.addEventListener('mouseleave', () => gsap.to(cta, { borderColor: 'rgba(255,255,255,.2)', duration: .4, ease: 'power3' }));
    }
  }

  wireStatic();

  if (!window.gsap || !window.ScrollTrigger || !window.Lenis) { unhide(); return; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { unhide(); return; }

  gsap.registerPlugin(ScrollTrigger);

  const run = (name, fn) => { try { fn(); } catch (e) { console.error('[tokenomics] init failed:', name, e); } };
  run('smooth', initSmooth);
  run('headings', initHeadings);
  run('reveals', initReveals);
  run('heroText', initHeroText);
  run('typewriter', initTypewriter);
  run('glitchText', initGlitchText);
  run('astronaut', initAstronaut);
  run('filament', initFilament);
  run('parallax', initParallax);
  run('starCompass', initStarCompass);
  run('counters', initCounters);
  run('supply', initSupply);
  run('incentives', initIncentives);
  run('accrual', initAccrual);
  run('audit', initAudit);
  run('laptop', initLaptop);
  run('nav', initNav);
  run('magnets', initMagnets);

  ScrollTrigger.config({ ignoreMobileResize: true });
  ScrollTrigger.refresh();
})();
