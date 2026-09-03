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

// Ink-scroll: every headline tagged .ink-scroll brightens as it crosses into view
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
    el.style.setProperty('--fill', progress.toFixed(3));
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
  const message = form.message.value.trim();
  const subject = encodeURIComponent(`New enquiry from ${name}${brand ? ' (' + brand + ')' : ''}`);
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nBrand: ${brand}\n\n${message}`);
  window.location.href = `mailto:info@digitalduo.ae?subject=${subject}&body=${body}`;
  note.textContent = "Opening your email client…";
});
