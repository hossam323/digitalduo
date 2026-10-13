// Year
document.getElementById('year').textContent = new Date().getFullYear();

// Header scroll state
const header = document.getElementById('siteHeader');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile nav toggle
const burger = document.getElementById('burger');
const mainNav = document.getElementById('mainNav');
burger.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
});
mainNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mainNav.classList.remove('open');
  burger.classList.remove('open');
}));

const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Hero glow orb follows the pointer
const glowOrb = document.getElementById('glowOrb');
const heroSplit = document.getElementById('heroSplit');
if (hasFinePointer && heroSplit && glowOrb) {
  heroSplit.addEventListener('mousemove', (e) => {
    const rect = heroSplit.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    glowOrb.style.setProperty('--gx', `${x}%`);
    glowOrb.style.setProperty('--gy', `${y}%`);
  });
}

// Hero mark drifts with scroll (parallax), independent of its own float animation
const heroDuo = document.getElementById('heroDuo');
const onHeroParallax = () => {
  if (!heroDuo || !heroSplit) return;
  const rect = heroSplit.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)));
  heroDuo.style.transform = `translateY(${progress * -70}px)`;
};

// Custom cursor — eased "duo" trail rather than a 1:1 snap
const cursor = document.getElementById('cursorDot');
if (hasFinePointer && cursor) {
  let targetX = window.innerWidth / 2, targetY = window.innerHeight / 2;
  let curX = targetX, curY = targetY;
  window.addEventListener('mousemove', (e) => {
    targetX = e.clientX; targetY = e.clientY;
    cursor.classList.add('active');
  });
  const tick = () => {
    curX += (targetX - curX) * 0.22;
    curY += (targetY - curY) * 0.22;
    cursor.style.transform = `translate(${curX}px, ${curY}px) translate(-50%,-50%)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.querySelectorAll('a, button, .service-card, .portfolio-card').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('grow'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('grow'));
  });
}

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

// Animated counters
const counters = document.querySelectorAll('.stat-num');
const animateCount = (el) => {
  const target = parseInt(el.dataset.count, 10);
  const duration = 1200;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const counterIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      counterIO.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
counters.forEach(el => counterIO.observe(el));

// Ink-scroll: every headline tagged .ink-scroll brightens as it crosses into view.
// The bright copy is revealed via clip-path (not a gradient text-clip driven by
// a CSS custom property, which some WebKit builds don't reliably repaint).
const inkEls = document.querySelectorAll('.ink-scroll');
const quoteBlock = document.getElementById('quoteBlock');
const quoteAlways = document.querySelector('.quote-always');
const updateInk = () => {
  if (!inkEls.length) return;
  const vh = window.innerHeight;
  inkEls.forEach(el => {
    // The mission quote paces its fade off the whole section (including its
    // large padding), exactly like the original version, so it builds up
    // slowly; every other heading paces off its own (smaller) box.
    const useEl = (el.id === 'inkText' && quoteBlock) ? quoteBlock : el;
    const rect = useEl.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height * 0.6)));
    const bright = el.querySelector('.ink-bright');
    if (bright) bright.style.clipPath = `inset(0 ${((1 - progress) * 100).toFixed(2)}% 0 0)`;
    if (el.id === 'inkText' && progress > 0.85) quoteAlways.classList.add('in');
  });
};

// Scroll progress bar
const scrollProgress = document.getElementById('scrollProgress');
const updateScrollProgress = () => {
  const h = document.documentElement;
  const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
  scrollProgress.style.transform = `scaleX(${scrolled})`;
};

// Drive all scroll-position-linked visuals from a single rAF loop instead of
// the 'scroll' event: Safari fires far fewer scroll events than Chrome during
// trackpad/momentum scrolling, which makes event-driven effects look like
// they jump straight to their end state instead of animating smoothly.
let lastScrollY = -1;
const renderScrollEffects = () => {
  if (window.scrollY !== lastScrollY) {
    lastScrollY = window.scrollY;
    updateScrollProgress();
    updateInk();
    onHeroParallax();
  }
  requestAnimationFrame(renderScrollEffects);
};
requestAnimationFrame(renderScrollEffects);

// AI automation demo: scattered tools with "you" as the glue, versus one
// orchestrated system with AI at the core. Auto-plays until the visitor clicks.
const autoDemo = document.getElementById('autoDemo');
const autoMap = document.getElementById('autoMap');
if (autoDemo && autoMap) {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.appendChild(n);
    return n;
  };
  const CX = 200, CY = 150;
  const tools = [
    { label: 'Socials', before: [182, 50], after: [200, 45] },
    { label: 'WhatsApp', before: [304, 38], after: [306, 76] },
    { label: 'Email', before: [352, 132], after: [350, 150] },
    { label: 'Ads', before: [320, 252], after: [306, 224] },
    { label: 'Website', before: [190, 268], after: [200, 255] },
    { label: 'Sheets', before: [62, 236], after: [94, 224] },
    { label: 'Calendar', before: [44, 140], after: [50, 150] },
    { label: 'CRM', before: [74, 48], after: [94, 76] },
  ];
  const broken = [[7, 0], [1, 2], [5, 4]];

  make('ellipse', { class: 'map-ring', cx: CX, cy: CY, rx: 150, ry: 105 }, autoMap);
  const spokes = make('g', {}, autoMap);
  const flows = make('g', {}, autoMap);
  tools.forEach((t, i) => {
    const line = { x1: CX, y1: CY, x2: t.after[0], y2: t.after[1], pathLength: 1 };
    make('line', { ...line, class: 'map-spoke', style: `transition-delay:${0.45 + i * 0.06}s` }, spokes);
    make('line', { ...line, class: 'map-flow', style: `animation-delay:${-i * 0.23}s` }, flows);
  });
  const brokenG = make('g', {}, autoMap);
  broken.forEach(([a, b]) => {
    const [x1, y1] = tools[a].before;
    const [x2, y2] = tools[b].before;
    make('line', { class: 'map-broken', x1, y1, x2, y2 }, brokenG);
    const mark = make('text', { class: 'map-break', x: (x1 + x2) / 2, y: (y1 + y2) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, brokenG);
    mark.textContent = '×';
  });

  const core = make('g', { class: 'map-core' }, autoMap);
  make('circle', { class: 'map-core-glow', cx: CX, cy: CY, r: 30 }, core);
  make('circle', { class: 'map-core-you', cx: CX, cy: CY, r: 30 }, core);
  make('circle', { class: 'map-core-ai', cx: CX, cy: CY, r: 30 }, core);
  make('text', { class: 't-you', x: CX, y: CY }, core).textContent = 'You';
  make('text', { class: 't-ai', x: CX, y: CY + 1 }, core).textContent = 'AI';

  const nodeEls = tools.map((t, i) => {
    const g = make('g', { class: 'map-node', style: `transition-delay:${i * 0.045}s` }, autoMap);
    const inner = make('g', { class: 'map-node-inner', style: `animation-delay:${-i * 0.37}s` }, g);
    const w = Math.round(t.label.length * 6.4 + 24);
    make('rect', { x: -w / 2, y: -12, width: w, height: 24, rx: 12 }, inner);
    make('text', { x: 0, y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, inner).textContent = t.label;
    return g;
  });

  const tabs = autoDemo.querySelectorAll('[data-set]');
  const setState = (state) => {
    autoDemo.dataset.state = state;
    tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.set === state)));
    nodeEls.forEach((g, i) => {
      const [x, y] = tools[i][state];
      g.style.transform = `translate(${x}px, ${y}px)`;
    });
  };
  setState('before');

  let userTook = false;
  let cycleTimer = null;
  const scheduleNext = () => {
    cycleTimer = setTimeout(() => {
      if (userTook) return;
      setState(autoDemo.dataset.state === 'after' ? 'before' : 'after');
      scheduleNext();
    }, autoDemo.dataset.state === 'after' ? 5600 : 2600);
  };
  tabs.forEach(b => b.addEventListener('click', () => {
    userTook = true;
    clearTimeout(cycleTimer);
    setState(b.dataset.set);
  }));
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!userTook && !cycleTimer) scheduleNext();
    } else {
      clearTimeout(cycleTimer);
      cycleTimer = null;
    }
  }, { threshold: 0.35 }).observe(autoDemo);
}

// Service cards: a red spotlight that follows the cursor
if (hasFinePointer) {
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// Portfolio gallery — prev/next buttons + drag-to-scroll + tap-to-reveal duotone
const portfolioTrack = document.getElementById('portfolioTrack');
if (portfolioTrack) {
  const cardWidth = () => portfolioTrack.querySelector('.portfolio-card')?.getBoundingClientRect().width + 24 || 320;
  document.getElementById('portPrev')?.addEventListener('click', () => {
    portfolioTrack.scrollBy({ left: -cardWidth(), behavior: 'smooth' });
  });
  document.getElementById('portNext')?.addEventListener('click', () => {
    portfolioTrack.scrollBy({ left: cardWidth(), behavior: 'smooth' });
  });

  let isDown = false, startX = 0, startScroll = 0, dragged = false;
  portfolioTrack.addEventListener('pointerdown', (e) => {
    isDown = true; dragged = false;
    startX = e.clientX; startScroll = portfolioTrack.scrollLeft;
    portfolioTrack.classList.add('dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) dragged = true;
    portfolioTrack.scrollLeft = startScroll - dx;
  });
  window.addEventListener('pointerup', () => {
    isDown = false;
    portfolioTrack.classList.remove('dragging');
  });

  // Touch devices: tap toggles the duotone reveal instead of relying on hover
  portfolioTrack.querySelectorAll('.portfolio-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (dragged) { e.preventDefault(); return; }
      if (!hasFinePointer) card.classList.toggle('revealed');
    });
  });
}

// Contact form (front-end only — wire to a backend or Formspree endpoint before launch)
const form = document.getElementById('contactForm');
const note = document.getElementById('formNote');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const brand = form.brand.value.trim();
  const interest = form.interest.value;
  const message = form.message.value.trim();
  const subject = encodeURIComponent(`New enquiry from ${name}${brand ? ' (' + brand + ')' : ''}: ${interest}`);
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nBrand: ${brand}\nInterested in: ${interest}\n\n${message}`);
  window.location.href = `mailto:info@digitalduo.ae?subject=${subject}&body=${body}`;
  note.textContent = "Opening your email client…";
});
