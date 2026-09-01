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

// Custom cursor
const cursor = document.getElementById('cursorDot');
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  window.addEventListener('mousemove', (e) => {
    cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
    cursor.classList.add('active');
  });
  document.querySelectorAll('a, button, .service-card').forEach(el => {
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
