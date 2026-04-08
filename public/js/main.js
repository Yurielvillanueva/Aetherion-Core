function stripAnsiSafe(value) {
  return String(value || '').replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

function setupClipboardButton() {
  const ipBox = document.getElementById('ip-box');
  const copyFeedback = document.getElementById('copy-feedback');
  if (!ipBox || !copyFeedback) return;

  ipBox.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('PLAY.AETHERION.COM');
      copyFeedback.classList.add('show');
      setTimeout(() => copyFeedback.classList.remove('show'), 1600);
    } catch (error) {
      console.error('Clipboard error', error);
    }
  });
}

async function loadServerStatus() {
  const playerCountEl = document.getElementById('hero-player-count');
  const proofOnlineEl = document.getElementById('proof-online');
  const statusBadge = document.getElementById('server-status-badge');
  const tpsEl = document.getElementById('server-tps');
  if (!playerCountEl || !proofOnlineEl || !statusBadge || !tpsEl) return;

  try {
    const [status, players] = await Promise.all([
      fetch('/api/server/status', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/server/players', { credentials: 'same-origin' }).then(r => r.json())
    ]);

    const playerCount = status.online ? (players.players || []).length : 0;
    animateCounter(playerCountEl, playerCount, 700);
    animateCounter(proofOnlineEl, playerCount, 700);

    statusBadge.textContent = status.online ? 'Online' : 'Offline';
    statusBadge.classList.toggle('online', Boolean(status.online));
    statusBadge.classList.toggle('offline', !status.online);

    tpsEl.textContent = status.online ? '20.0' : '--';
  } catch (error) {
    statusBadge.textContent = 'Offline';
    statusBadge.classList.remove('online');
    statusBadge.classList.add('offline');
    tpsEl.textContent = '--';
  }
}

async function loadSocialProof() {
  const proofJoinsEl = document.getElementById('proof-joins');
  const heroJoinsEl = document.getElementById('hero-total-joins');
  const proofStaffEl = document.getElementById('proof-staff');
  if (!proofJoinsEl || !heroJoinsEl || !proofStaffEl) return;

  const baselineJoins = 14250;
  const storedBump = Number.parseInt(localStorage.getItem('aetherion_joins_bump') || '0', 10);
  const nextBump = (Number.isNaN(storedBump) ? 0 : storedBump) + 3;
  localStorage.setItem('aetherion_joins_bump', String(nextBump));
  const totalJoins = baselineJoins + nextBump;

  animateCounter(proofJoinsEl, totalJoins, 1100);
  animateCounter(heroJoinsEl, totalJoins, 1100);

  try {
    const landingRes = await fetch('/api/public/landing').then(r => r.json());
    const apiJoins = landingRes?.metrics?.totalJoins;
    const apiStaff = landingRes?.metrics?.staffCount;
    if (typeof apiJoins === 'number') {
      animateCounter(proofJoinsEl, apiJoins, 1100);
      animateCounter(heroJoinsEl, apiJoins, 1100);
    } else {
      animateCounter(proofJoinsEl, totalJoins, 1100);
      animateCounter(heroJoinsEl, totalJoins, 1100);
    }
    if (typeof apiStaff === 'number') {
      animateCounter(proofStaffEl, apiStaff, 600);
      return;
    }
  } catch (error) {
    animateCounter(proofJoinsEl, totalJoins, 1100);
    animateCounter(heroJoinsEl, totalJoins, 1100);
  }

  try {
    const staffRes = await fetch('/api/staff').then(r => r.json());
    const staffCount = (staffRes.staff || []).length;
    animateCounter(proofStaffEl, staffCount, 600);
  } catch (error) {
    proofStaffEl.textContent = '0';
  }
}

function animateCounter(el, target, durationMs) {
  const finalValue = Number(target) || 0;
  const start = performance.now();
  const from = 0;

  function tick(now) {
    const ratio = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - ratio, 3);
    const current = Math.round(from + (finalValue - from) * eased);
    el.textContent = current.toLocaleString();
    if (ratio < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function setupTestimonialsSlider() {
  const slider = document.getElementById('testimonial-slider');
  if (!slider) return;
  const items = Array.from(slider.querySelectorAll('.testimonial'));
  if (items.length < 2) return;

  let index = 0;
  setInterval(() => {
    items[index].classList.remove('active');
    index = (index + 1) % items.length;
    items[index].classList.add('active');
  }, 4200);
}

function setupGameplayPreview() {
  const tabsRoot = document.getElementById('preview-tabs');
  const slider = document.getElementById('preview-slider');
  if (!tabsRoot || !slider) return;

  const tabs = Array.from(tabsRoot.querySelectorAll('[data-preview]'));
  const slides = Array.from(slider.querySelectorAll('[data-preview-slide]'));
  if (!tabs.length || !slides.length) return;

  function activate(key) {
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.preview === key));
    slides.forEach(slide => slide.classList.toggle('active', slide.dataset.previewSlide === key));
  }

  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab.dataset.preview)));

  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % tabs.length;
    activate(tabs[idx].dataset.preview);
  }, 5000);
}

function setupMapFullscreen() {
  const mapButton = document.getElementById('map-fullscreen');
  const mapFrame = document.getElementById('map-frame');
  if (!mapButton || !mapFrame) return;

  mapButton.addEventListener('click', async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await mapFrame.requestFullscreen();
  });
}

function startCountdown(targetDate, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  function render() {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = '00:00:00';
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    el.textContent = `${hours}:${minutes}:${seconds}`;
  }

  render();
  setInterval(render, 1000);
}

function startRestartScheduleCountdown() {
  const restartEl = document.getElementById('restart-countdown');
  const maintenanceEl = document.getElementById('maintenance-countdown');
  if (!restartEl || !maintenanceEl) return;

  const cycleHours = 6;
  function render() {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    const rounded = Math.ceil(now.getHours() / cycleHours) * cycleHours;
    next.setHours(rounded);
    if (next <= now) next.setHours(next.getHours() + cycleHours);

    const diff = Math.max(0, next.getTime() - now.getTime());
    const totalSeconds = Math.floor(diff / 1000);
    const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    const value = `${hh}:${mm}:${ss}`;

    restartEl.textContent = value;
    maintenanceEl.textContent = value;
  }

  render();
  setInterval(render, 1000);
}

function setupScrollReveal() {
  const revealItems = document.querySelectorAll('[data-reveal]');
  if (!revealItems.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  revealItems.forEach(item => observer.observe(item));
}

function setupThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  const stored = localStorage.getItem('aetherion_theme');
  if (stored === 'light') document.body.classList.add('theme-light');

  toggle.addEventListener('click', () => {
    document.body.classList.toggle('theme-light');
    localStorage.setItem('aetherion_theme', document.body.classList.contains('theme-light') ? 'light' : 'dark');
  });
}

function setupMusicToggle() {
  const toggle = document.getElementById('music-toggle');
  const audio = document.getElementById('bg-music');
  if (!toggle || !audio) return;

  toggle.addEventListener('click', async () => {
    try {
      if (audio.paused) {
        await audio.play();
        toggle.textContent = 'Music On';
      } else {
        audio.pause();
        toggle.textContent = 'Music';
      }
    } catch (error) {
      toggle.textContent = 'No Track';
    }
  });
}

function setupLanguageSelector() {
  const selector = document.getElementById('language-selector');
  if (!selector) return;

  selector.addEventListener('change', () => {
    const lang = selector.value;
    const title = document.querySelector('.hero-title');
    if (!title) return;
    title.textContent = lang === 'id' ? 'NAIK KE AETHERION CORE' : 'ASCEND TO AETHERION CORE';
  });
}

function setupParticles() {
  const layer = document.getElementById('particle-layer');
  if (!layer) return;

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 28; i++) {
    const dot = document.createElement('span');
    dot.className = 'particle';
    dot.style.left = `${Math.random() * 100}%`;
    dot.style.animationDelay = `${Math.random() * 8}s`;
    dot.style.animationDuration = `${7 + Math.random() * 8}s`;
    fragment.appendChild(dot);
  }
  layer.appendChild(fragment);
}

async function loadShopPreview() {
  const container = document.getElementById('featured-shop-items');
  if (!container) return;

  try {
    const response = await fetch('/api/shop');
    const json = await response.json();
    const items = (json.items || []).slice(0, 3);
    if (!items.length) {
      container.innerHTML = '<article class="card"><h3>No featured items yet.</h3></article>';
      return;
    }

    container.innerHTML = items.map(item => `
      <article class="card">
        <h3>${stripAnsiSafe(item.name)}</h3>
        <p class="small">${stripAnsiSafe(item.category)}</p>
        <p>${stripAnsiSafe(item.description)}</p>
        <div class="status-row"><span>Price</span><strong>${Number(item.price).toLocaleString()} coins</strong></div>
      </article>
    `).join('');
  } catch (error) {
    container.innerHTML = '<article class="card"><h3>Unable to load shop preview.</h3></article>';
  }
}

async function loadSettings() {
  const mapIframe = document.getElementById('map-iframe');
  const discordWidget = document.getElementById('discord-widget');
  const discordJoinLink = document.getElementById('discord-join-link');
  if (!mapIframe || !discordWidget || !discordJoinLink) return;

  try {
    const response = await fetch('/api/public/settings');
    const json = await response.json();
    if (!json.success) return;
    const settings = json.settings || {};
    if (settings.mapEmbedUrl) mapIframe.src = settings.mapEmbedUrl;
    if (settings.discordWidgetUrl) discordWidget.src = settings.discordWidgetUrl;
    if (settings.discordInviteUrl) discordJoinLink.href = settings.discordInviteUrl;
  } catch (error) {
    console.error('Unable to load landing settings', error);
  }
}

async function loadEvents() {
  const grid = document.getElementById('events-grid');
  const countdownEl = document.getElementById('event-countdown');
  if (!grid || !countdownEl) return;

  try {
    const response = await fetch('/api/public/events');
    const json = await response.json();
    const events = json.events || [];
    if (!events.length) {
      grid.innerHTML = '<article class=\"card\"><h3>No events scheduled yet.</h3></article>';
      return;
    }

    grid.innerHTML = events.slice(0, 3).map(item => `\n      <article class=\"card\">\n        <h3>${stripAnsiSafe(item.title)}</h3>\n        <p>${stripAnsiSafe(item.description)}</p>\n        <p class=\"small\">Starts: ${new Date(item.startsAt).toLocaleString()}</p>\n        <button class=\"button button-secondary\" type=\"button\">Register</button>\n      </article>\n    `).join('');

    const nextStart = new Date(events[0].startsAt);
    if (!Number.isNaN(nextStart.getTime())) startCountdown(nextStart, 'event-countdown');
  } catch (error) {
    grid.innerHTML = '<article class=\"card\"><h3>Unable to load events.</h3></article>';
  }
}

function setDiscordOnlineFallback() {
  const el = document.getElementById('discord-online');
  if (!el) return;
  fetch('/api/public/landing')
    .then(r => r.json())
    .then(json => {
      const members = json?.metrics?.discordOnlineMembers;
      el.textContent = `Members online: ${typeof members === 'number' ? members : 142}`;
    })
    .catch(() => {
      el.textContent = 'Members online: 142';
    });
}

window.addEventListener('DOMContentLoaded', () => {
  setupClipboardButton();
  setupTestimonialsSlider();
  setupGameplayPreview();
  setupMapFullscreen();
  setupScrollReveal();
  setupThemeToggle();
  setupMusicToggle();
  setupLanguageSelector();
  setupParticles();

  loadServerStatus();
  loadSocialProof();
  loadSettings();
  loadEvents();
  loadShopPreview();
  setDiscordOnlineFallback();

  startRestartScheduleCountdown();
  startCountdown(new Date(Date.now() + (1000 * 60 * 53)), 'event-countdown');
});
