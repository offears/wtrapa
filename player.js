/* Музыка + визуализации. Подключается на всех страницах: <script src="player.js" defer></script> */
(() => {
  // === Настройки ===
  const TRACK = 'song.mp3';      // файл песни рядом с index.html
  const TITLE = 'моя песня';     // подпись на плеере
  const KEY = 'site-music';

  // === Стили ===
  const style = document.createElement('style');
  style.textContent = `
    .viz { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
    .trail { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 5; pointer-events: none; }
    .music {
      position: fixed; right: 16px; bottom: 16px; z-index: 15;
      display: flex; align-items: center; gap: 10px;
      padding: 8px 16px 8px 8px; color: #fff;
      font: 300 0.85rem "Onest", "Segoe UI", sans-serif;
      background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.5);
      border-radius: 999px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      text-shadow: 0 1px 6px rgba(0,0,0,0.35);
    }
    .m-btn {
      width: 34px; height: 34px; display: grid; place-items: center; cursor: pointer;
      color: #fff; background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.7); border-radius: 50%; transition: background 0.3s ease;
    }
    .m-btn:hover, .m-btn:focus-visible { background: rgba(255,255,255,0.45); }
    .m-vol { width: 70px; accent-color: #fff; }
    @media (max-width: 600px) { .m-vol { display: none; } }
    /* Свечение столбов и панелей в такт басу */
    .column, .panel {
      box-shadow: 0 0 calc(var(--bass, 0) * 40px) rgba(255,255,255,calc(var(--bass, 0) * 0.55));
    }
  `;
  document.head.appendChild(style);

  // === Элементы ===
  const viz = document.createElement('canvas'); viz.className = 'viz';
  const trail = document.createElement('canvas'); trail.className = 'trail';
  document.body.append(viz, trail);

  const ui = document.createElement('div');
  ui.className = 'music';
  ui.innerHTML =
    '<button type="button" class="m-btn" aria-label="Играть / пауза">' +
    '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M8 5v14l11-7z"/></svg></button>' +
    '<span class="m-title"></span>' +
    '<input class="m-vol" type="range" min="0" max="1" step="0.01" aria-label="Громкость">';
  document.body.appendChild(ui);

  const btn = ui.querySelector('.m-btn');
  const icon = ui.querySelector('path');
  const title = ui.querySelector('.m-title');
  const vol = ui.querySelector('.m-vol');
  title.textContent = TITLE;

  // === Сохранённое состояние (чтобы песня не начиналась заново на новой странице) ===
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  let wantPlay = !!saved.playing;

  const audio = new Audio(TRACK);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = typeof saved.vol === 'number' ? saved.vol : 0.6;
  vol.value = audio.volume;

  audio.addEventListener('loadedmetadata', () => {
    if (saved.t && audio.duration) audio.currentTime = saved.t % audio.duration;
  }, { once: true });
  audio.addEventListener('error', () => { title.textContent = 'нет файла ' + TRACK; });

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ t: audio.currentTime, playing: wantPlay, vol: audio.volume }));
    } catch (e) {}
  }
  audio.addEventListener('timeupdate', save);
  addEventListener('pagehide', save);

  function setIcon() {
    icon.setAttribute('d', audio.paused ? 'M8 5v14l11-7z' : 'M6 5h4v14H6zM14 5h4v14h-4z');
  }
  audio.addEventListener('play', setIcon);
  audio.addEventListener('pause', setIcon);

  // === Аудио-анализатор (создаётся только после действия пользователя) ===
  let ctx, analyser, data;
  function ensureCtx() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    ctx.createMediaElementSource(audio).connect(analyser);
    analyser.connect(ctx.destination);
    data = new Uint8Array(analyser.frequencyBinCount);
  }

  btn.addEventListener('click', async () => {
    ensureCtx();
    if (audio.paused) {
      try { await audio.play(); wantPlay = true; } catch (e) {}
    } else {
      audio.pause(); wantPlay = false;
    }
    save();
  });

  vol.addEventListener('input', () => { audio.volume = vol.value; save(); });

  // Возобновление на новой странице: если браузер не дал включить сам, включаем по первому клику
  if (wantPlay) audio.play().catch(() => {});
  function arm(e) {
    ensureCtx();
    if (ui.contains(e.target)) return;
    if (wantPlay && audio.paused) audio.play().catch(() => {});
    removeEventListener('pointerdown', arm);
    removeEventListener('keydown', arm);
  }
  addEventListener('pointerdown', arm);
  addEventListener('keydown', arm);
  setIcon();

  // === Визуализации ===
  const vctx = viz.getContext('2d');
  const tctx = trail.getContext('2d');
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [viz, trail]) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
  }
  resize();
  addEventListener('resize', resize);

  // След за курсором
  const fancy = !matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(pointer: fine)').matches;
  const parts = [];
  if (fancy) {
    addEventListener('pointermove', e => {
      for (let k = 0; k < 2; k++) {
        parts.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2 - 0.3, life: 1 });
      }
      if (parts.length > 140) parts.splice(0, parts.length - 140);
    });
  }

  const N = 48;
  const lv = new Array(N).fill(0);
  let bass = 0, t = 0;

  function frame() {
    t += 0.016;
    const playing = !audio.paused;
    const live = analyser && playing;
    if (live) analyser.getByteFrequencyData(data);

    // Столбики эквалайзера за стеклянными колонками
    const W = viz.width, H = viz.height, bw = W / N;
    vctx.clearRect(0, 0, W, H);
    vctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < N; i++) {
      const target = live
        ? data[Math.floor(Math.pow(i / N, 1.6) * data.length * 0.75)] / 255
        : 0.04 + 0.03 * Math.sin(t * 1.5 + i * 0.4);
      lv[i] += (target - lv[i]) * 0.25;
      const h = lv[i] * H * 0.5;
      vctx.fillRect(i * bw + bw * 0.15, H - h, bw * 0.7, h);
    }

    // Бас -> переменная для свечения
    let tb = 0;
    if (live) {
      let s = 0;
      for (let i = 0; i < 6; i++) s += data[i];
      tb = Math.max(0, (s / 6 / 255 - 0.45) / 0.55);
    }
    bass += (tb - bass) * 0.3;
    document.documentElement.style.setProperty('--bass', bass.toFixed(3));

    // Частицы за курсором
    if (fancy) {
      tctx.clearRect(0, 0, trail.width, trail.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.025;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        tctx.fillStyle = 'rgba(255,255,255,' + (p.life * 0.8).toFixed(2) + ')';
        tctx.beginPath();
        tctx.arc(p.x * dpr, p.y * dpr, (1 + 3 * p.life) * dpr, 0, Math.PI * 2);
        tctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  frame();
})();
