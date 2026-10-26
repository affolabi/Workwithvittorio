/**
 * Vittorio's Portfolio — Hero Section Interactive Engine
 * Powers tactile dock click audio, dynamic "Hey 👋" speech pill rotation,
 * active non-overlapping macOS dock physics, draggable corner stickers,
 * theme toggle, and lo-fi ambient synthesizer.
 */

function initPortfolioHero() {
  if (window.__vittorioHeroInitialized) return;
  window.__vittorioHeroInitialized = true;

  /* ==========================================================================
     0. Tactile Dock Click Sound Engine (Pre-synthesized WAV + Web Audio API)
     Triggered strictly when clicking the dock logos
     ========================================================================== */
  function createClickWavDataUri(pitchScale = 1) {
    const sampleRate = 44100;
    const duration = 0.065;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let phase1 = 0;
    let phase2 = 0;
    let phase3 = 0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;

      // 1. Crisp switch transient snap
      const freq1 = (680 + 1720 * Math.exp(-t * 260)) * pitchScale;
      phase1 += (2 * Math.PI * freq1) / sampleRate;
      const snap = Math.sin(phase1) * Math.exp(-t * 240) * 0.65;

      // 2. Warm mechanical pop body
      const freq2 = (175 + 365 * Math.exp(-t * 95)) * pitchScale;
      phase2 += (2 * Math.PI * freq2) / sampleRate;
      const body = Math.sin(phase2) * Math.exp(-t * 85) * 0.85;

      // 3. Subtle tactile keycap reflection at 8ms
      let reflection = 0;
      if (t > 0.008) {
        const tr = t - 0.008;
        const freq3 = 1350 * pitchScale;
        phase3 += (2 * Math.PI * freq3) / sampleRate;
        reflection = Math.sin(phase3) * Math.exp(-tr * 360) * 0.35;
      }

      const raw = snap + body + reflection;
      const sample = Math.tanh(raw * 1.35);
      const intSample = Math.max(-1, Math.min(1, sample)) * 32767;
      view.setInt16(44 + i * 2, intSample, true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  const clickAudioPool = [];
  for (let i = 0; i < 10; i++) {
    const pitch = 0.95 + i * 0.018;
    const uri = createClickWavDataUri(pitch);
    const audio = new Audio(uri);
    audio.preload = 'auto';
    audio.volume = 0.85;
    clickAudioPool.push(audio);
  }

  // Silently unlock browser audio on first user gesture anywhere on page if needed
  let audioUnlocked = false;
  function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      const silent = clickAudioPool[0].cloneNode();
      silent.volume = 0.001;
      const p = silent.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          silent.pause();
          silent.currentTime = 0;
        }).catch(() => {
          audioUnlocked = false;
        });
      }
    } catch (e) {}
  }
  window.addEventListener('pointerdown', unlockAudioOnce, { passive: true });
  window.addEventListener('keydown', unlockAudioOnce, { passive: true });

  let lastSoundTime = 0;
  function playDockHoverSound(index = 4) {
    const now = performance.now();
    if (now - lastSoundTime < 28) return; // prevent double-firing on same frame
    lastSoundTime = now;

    try {
      const poolIdx = Math.max(0, Math.min(clickAudioPool.length - 1, index % clickAudioPool.length));
      const baseAudio = clickAudioPool[poolIdx];
      const sound = baseAudio.cloneNode();
      sound.volume = 0.78;
      const playPromise = sound.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (e) {}
  }

  /* ==========================================================================
     1. Dynamic "Hey 👋" Speech Pill Rotator
     Short, clean phrases with no emojis on the changing texts
     ========================================================================== */
  const speechPill = document.getElementById('speech-pill');
  const heroPhrases = [
    "Hey 👋",
    "Let's ship",
    "Let's build",
    "Design + Code",
    "Say hello"
  ];
  let currentPhraseIndex = 0;
  let phraseInterval = null;

  function setSpeechPillText(newText) {
    if (!speechPill) return;
    const span = speechPill.querySelector('span') || speechPill;
    if (span.textContent === newText) return;

    speechPill.classList.add('switching');
    clearTimeout(speechPill._switchTimeout);
    speechPill._switchTimeout = setTimeout(() => {
      span.textContent = newText;
      speechPill.classList.remove('switching');
    }, 140);
  }

  function cycleNextPhrase() {
    currentPhraseIndex = (currentPhraseIndex + 1) % heroPhrases.length;
    setSpeechPillText(heroPhrases[currentPhraseIndex]);
  }

  function startPhraseRotation() {
    clearInterval(phraseInterval);
    phraseInterval = setInterval(cycleNextPhrase, 2500);
  }

  setTimeout(() => {
    cycleNextPhrase();
    startPhraseRotation();
  }, 2600);

  if (speechPill) {
    speechPill.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleNextPhrase();
      startPhraseRotation();
    });
  }

  /* ==========================================================================
     2. Active, Non-Overlapping macOS Dock Physics & Hover Sound
     ========================================================================== */
  const dock = document.getElementById('mac-dock');
  const dockItems = dock ? Array.from(dock.querySelectorAll('.dock-item')) : [];

  if (dock && dockItems.length > 0) {
    const maxScale = 1.26;
    const baseScale = 1.0;
    const effectRange = 125;
    let lastHoveredDockIndex = -1;

    // Cache each item's rest offset from the dock's horizontal center
    // so margin expansions never cause feedback wobble or overlapping
    let restOffsets = [];
    function measureRestOffsets() {
      const dockWidth = dock.offsetWidth;
      const dockCenter = dockWidth / 2;
      restOffsets = dockItems.map((item) => {
        return (item.offsetLeft + item.offsetWidth / 2) - dockCenter;
      });
    }

    measureRestOffsets();
    setTimeout(measureRestOffsets, 1850);
    window.addEventListener('resize', measureRestOffsets);

    dock.addEventListener('mousemove', (e) => {
      const dockRect = dock.getBoundingClientRect();
      const dockCenterX = dockRect.left + dockRect.width / 2;
      const mouseX = e.clientX;

      dockItems.forEach((item, idx) => {
        const icon = item.querySelector('.dock-icon');
        const tooltip = item.querySelector('.dock-tooltip');
        const itemRestCenterX = dockCenterX + (restOffsets[idx] || 0);
        const dist = Math.abs(mouseX - itemRestCenterX);

        if (dist < effectRange) {
          const progress = Math.cos((dist / effectRange) * (Math.PI / 2));
          const scale = baseScale + (maxScale - baseScale) * progress;
          const translateY = -8 * progress;
          // 58px * 0.26 / 2 = 7.54px growth per side; 9.5px margin keeps a crisp gap with zero overlap
          const sideMargin = progress * 9.5;

          item.style.margin = `0 ${sideMargin.toFixed(1)}px`;
          if (icon) {
            icon.style.transform = `translateY(${translateY.toFixed(1)}px) scale(${scale.toFixed(3)})`;
          }
          if (tooltip) {
            tooltip.style.transform = `translateX(-50%) translateY(${(-14 * progress).toFixed(1)}px)`;
          }
        } else {
          item.style.margin = '0';
          if (icon) {
            icon.style.transform = 'translateY(0) scale(1)';
          }
          if (tooltip) {
            tooltip.style.transform = 'translateX(-50%) translateY(0)';
          }
        }
      });
    });

    dock.addEventListener('mouseleave', () => {
      lastHoveredDockIndex = -1;
      dockItems.forEach((item) => {
        const icon = item.querySelector('.dock-icon');
        const tooltip = item.querySelector('.dock-tooltip');
        item.style.margin = '0';
        if (icon) {
          icon.style.transform = 'translateY(0) scale(1)';
        }
        if (tooltip) {
          tooltip.style.transform = 'translateX(-50%) translateY(0)';
        }
      });
    });

    dockItems.forEach((item, index) => {
      // Play tactile sound when hovering / overlaying each dock logo
      item.addEventListener('mouseenter', () => {
        if (lastHoveredDockIndex !== index) {
          lastHoveredDockIndex = index;
          playDockHoverSound(index);
        }
      });

      item.addEventListener('click', () => {
        item.classList.remove('clicked');
        void item.offsetWidth;
        item.classList.add('clicked');
        setTimeout(() => item.classList.remove('clicked'), 400);

        const app = item.getAttribute('data-app');
        if (app === 'telegram') {
          window.open('https://t.me', '_blank');
        } else if (app === 'email') {
          window.location.href = 'mailto:workwithvittorio@gmail.com';
        }
      });
    });
  }

  /* ==========================================================================
     3. Draggable Stickers Physics (Heart & Flame Badges)
     ========================================================================== */
  const draggableStickers = [
    document.getElementById('sticker-flame'),
    document.getElementById('sticker-heart')
  ].filter(Boolean);

  draggableStickers.forEach(makeDraggable);

  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
      isDragging = true;
      el.style.zIndex = '100';

      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      startX = clientX;
      startY = clientY;

      const rect = el.getBoundingClientRect();
      const parentRect = el.offsetParent ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
      initialLeft = rect.left - parentRect.left;
      initialTop = rect.top - parentRect.top;

      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.left = `${initialLeft}px`;
      el.style.top = `${initialTop}px`;

      window.addEventListener('mousemove', onDrag);
      window.addEventListener('touchmove', onDrag, { passive: false });
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchend', stopDrag);
    }

    function onDrag(e) {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();

      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      el.style.left = `${initialLeft + deltaX}px`;
      el.style.top = `${initialTop + deltaY}px`;
      el.style.transform = `scale(1.18) rotate(${deltaX * 0.08}deg)`;
    }

    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;
      el.style.zIndex = '5';
      el.style.transform = '';

      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('touchmove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchend', stopDrag);
    }
  }

  /* ==========================================================================
     4. Theme Toggle (Light / Dark Mode) + Mechanical Switch Sound
     ========================================================================== */
  function createThemeSwitchWavDataUri(toDark = true) {
    const sampleRate = 44100;
    const duration = 0.085;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    const pitchA = toDark ? 1.05 : 0.88;
    const pitchB = toDark ? 0.82 : 1.16;
    let p1 = 0;
    let p2 = 0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;

      // Stage 1: Initial switch lever release transient (t = 0)
      const f1 = (540 + 1650 * Math.exp(-t * 280)) * pitchA;
      p1 += (2 * Math.PI * f1) / sampleRate;
      const click1 = Math.sin(p1) * Math.exp(-t * 170) * 0.62;

      // Stage 2: Tactile switch latch snap (t = 19ms)
      let click2 = 0;
      if (t >= 0.019) {
        const t2 = t - 0.019;
        const f2 = (380 + 1850 * Math.exp(-t2 * 250)) * pitchB;
        p2 += (2 * Math.PI * f2) / sampleRate;
        click2 = Math.sin(p2) * Math.exp(-t2 * 130) * 0.92;
      }

      const sample = Math.tanh((click1 + click2) * 1.4);
      const intSample = Math.max(-1, Math.min(1, sample)) * 32767;
      view.setInt16(44 + i * 2, intSample, true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  const switchToDarkAudio = new Audio(createThemeSwitchWavDataUri(true));
  const switchToLightAudio = new Audio(createThemeSwitchWavDataUri(false));
  switchToDarkAudio.preload = 'auto';
  switchToLightAudio.preload = 'auto';

  function playThemeSwitchSound(isDark) {
    try {
      const base = isDark ? switchToDarkAudio : switchToLightAudio;
      const sfx = base.cloneNode();
      sfx.volume = 0.88;
      const p = sfx.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
  }

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const meThemeToggleBtn = document.getElementById('me-theme-toggle-btn');
  const savedTheme = localStorage.getItem('vittorio_theme') || 'light';

  document.body.setAttribute('data-theme', savedTheme);

  function toggleSiteTheme() {
    const current = document.body.getAttribute('data-theme');
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    playThemeSwitchSound(nextTheme === 'dark');
    document.body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('vittorio_theme', nextTheme);
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleSiteTheme);
  }
  if (meThemeToggleBtn) {
    meThemeToggleBtn.addEventListener('click', toggleSiteTheme);
  }

  /* ==========================================================================
     5. Lo-Fi Ambient Audio Synthesizer
     ========================================================================== */
  const audioBtn = document.getElementById('audio-toggle-btn');
  const meAudioBtn = document.getElementById('me-audio-toggle-btn');
  let audioCtx = null;
  let isPlaying = false;
  let synthInterval = null;

  function syncAudioButtonsUI() {
    [audioBtn, meAudioBtn].forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle('playing', isPlaying);
      const playIcon = btn.querySelector('.play-icon');
      const pauseIcon = btn.querySelector('.pause-icon');
      if (playIcon) playIcon.style.display = isPlaying ? 'none' : 'block';
      if (pauseIcon) pauseIcon.style.display = isPlaying ? 'block' : 'none';
    });
  }

  function toggleAmbientAudio() {
    if (!isPlaying) {
      startAmbientSynth();
    } else {
      stopAmbientSynth();
    }
  }

  if (audioBtn) {
    audioBtn.addEventListener('click', toggleAmbientAudio);
  }
  if (meAudioBtn) {
    meAudioBtn.addEventListener('click', toggleAmbientAudio);
  }

  function startAmbientSynth() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isPlaying = true;
    syncAudioButtonsUI();

    const chordProgression = [
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [164.81, 196.00, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.00, 261.63], // Dm7
      [130.81, 164.81, 196.00, 246.94]  // Cmaj7
    ];

    let chordIndex = 0;
    playChord(chordProgression[chordIndex]);

    synthInterval = setInterval(() => {
      chordIndex = (chordIndex + 1) % chordProgression.length;
      playChord(chordProgression[chordIndex]);
    }, 4000);
  }

  function playChord(frequencies) {
    if (!audioCtx || !isPlaying) return;

    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.035, audioCtx.currentTime + 1.2);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3.9);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, audioCtx.currentTime);

    masterGain.connect(filter);
    filter.connect(audioCtx.destination);

    frequencies.forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.connect(masterGain);
      osc.start();
      osc.stop(audioCtx.currentTime + 4.0);
    });
  }

  function stopAmbientSynth() {
    isPlaying = false;
    clearInterval(synthInterval);
    syncAudioButtonsUI();
  }

  /* ==========================================================================
     6. /me Section Navigation & Reading-Paced Typing Animation
     ========================================================================== */
  const meViewSection = document.getElementById('me-view');
  const meTypingContainer = document.getElementById('me-typing-container');
  const meConnectLinks = document.getElementById('me-connect-links');
  const meGallerySection = document.getElementById('me-gallery-section');
  const meArchiveSection = document.getElementById('me-archive-section');
  const meGhGrid = document.getElementById('me-gh-grid');
  const meLiveClock = document.getElementById('me-live-clock');
  const meListeningStatus = document.getElementById('me-listening-status');
  const meVinylDisc = document.getElementById('me-vinyl-disc');
  const navMeLink = document.querySelector('.nav-item[data-nav="me"]');
  const navHomeLink = document.querySelector('.nav-item[data-nav="home"]');
  const allNavLinks = document.querySelectorAll('.site-header .nav-item');

  // Populate GitHub 45x7 Contribution Heatmap matching reference visual distribution
  if (meGhGrid && meGhGrid.children.length === 0) {
    const totalCols = 45;
    const totalRows = 7;
    const frag = document.createDocumentFragment();

    for (let col = 0; col < totalCols; col++) {
      for (let row = 0; row < totalRows; row++) {
        const cell = document.createElement('span');
        // Deterministic pseudo-random activity pattern with dense clusters in Jul-Oct (cols 27..42)
        const seed = Math.sin((col + 1) * 19.7 + (row + 1) * 7.3) * 10000;
        const rand = seed - Math.floor(seed);
        let level = 0;

        if (col >= 29 && col <= 41) {
          // High-activity summer/autumn sprint matching reference screenshot
          if (rand > 0.76) level = 4;
          else if (rand > 0.54) level = 3;
          else if (rand > 0.30) level = 2;
          else if (rand > 0.12) level = 1;
        } else if (col >= 18 && col <= 28) {
          if (rand > 0.88) level = 3;
          else if (rand > 0.62) level = 2;
          else if (rand > 0.25) level = 1;
        } else {
          if (rand > 0.85) level = 2;
          else if (rand > 0.38) level = 1;
        }

        cell.className = `me-gh-cell level-${level}`;
        frag.appendChild(cell);
      }
    }
    meGhGrid.appendChild(frag);
  }

  // Live WAT (GMT+1) Clock in /me Footer
  function updateMeClock() {
    if (!meLiveClock) return;
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const watDate = new Date(utcMs + 3600000); // GMT+1
    const hrs = String(watDate.getHours()).padStart(2, '0');
    const mins = String(watDate.getMinutes()).padStart(2, '0');
    meLiveClock.textContent = `${hrs}:${mins} (WAT, GMT+1)`;
  }
  updateMeClock();
  setInterval(updateMeClock, 15000);

  // Sync /me Footer "Listening to" status with navbar audio button
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      setTimeout(() => {
        const playing = audioBtn.classList.contains('playing');
        if (meListeningStatus) {
          meListeningStatus.textContent = playing ? 'Ambient Synth' : 'Not Playing';
        }
        if (meVinylDisc) {
          meVinylDisc.classList.toggle('spinning', playing);
        }
      }, 20);
    });
  }

  const meParagraphsData = [
    [
      { text: 'Hi there 👋 </>' }
    ],
    [
      { text: 'I’m a brand, product designer, and ' },
      { text: 'design engineer', underline: true },
      { text: ' with years of experience shaping identities, interfaces, and digital products across agencies, startups (ex ' },
      { text: 'Partyverse', underline: true },
      { text: ' / ' },
      { text: 'Payday', underline: true },
      { text: '), and Web3 ecosystems (ex ' },
      { text: 'Peer', underline: true },
      { text: ' / ' },
      { text: 'Betboro', underline: true },
      { text: ').' }
    ],
    [
      { text: 'Over the past years, I’ve worked across brand strategy, product design, and design engineering, handling projects for 30+ teams across fintech, consumer apps, gaming, DeFi, and interactive web.' }
    ],
    [
      { text: 'My contributions and products focus on making complicated ideas feel simple — designing and engineering interfaces, motion, and visual systems that people genuinely love to interact with.' }
    ],
    [
      { text: 'Now I partner directly with ' },
      { text: 'founders', underline: true },
      { text: ' and advise early-stage startups on brand, product & engineering, working as a design partner on-demand for ambitious teams and studios.' }
    ],
    [
      { text: 'I craft brand identities & design systems, product strategies, help launch new digital products, shape pitch narratives, and engineer high-craft interactive experiences.' }
    ],
    [
      { text: 'Bridging design and ' },
      { text: 'code', underline: true },
      { text: ', experimenting with AI, and exploring just how much one person can design and build.' }
    ],
    [
      { text: "Let's connect" }
    ]
  ];

  let typingTimer = null;
  let typingRunId = 0;

  function stopMeTyping() {
    typingRunId++;
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  function startMeReadingTypewriter() {
    if (!meTypingContainer) return;
    stopMeTyping();
    const currentRun = typingRunId;

    meTypingContainer.innerHTML = '';
    if (meConnectLinks) {
      meConnectLinks.classList.remove('visible');
    }
    if (meGallerySection) {
      meGallerySection.classList.remove('visible');
      meGallerySection.setAttribute('aria-hidden', 'true');
    }
    if (meArchiveSection) {
      meArchiveSection.classList.remove('visible');
      meArchiveSection.setAttribute('aria-hidden', 'true');
    }

    const cursorEl = document.createElement('span');
    cursorEl.className = 'me-typing-cursor';

    let pIdx = 0;
    let segIdx = 0;
    let charIdx = 0;
    let currentP = null;
    let currentNode = null;

    function step() {
      if (currentRun !== typingRunId) return;

      if (pIdx >= meParagraphsData.length) {
        if (cursorEl.parentNode) {
          cursorEl.parentNode.removeChild(cursorEl);
        }
        if (meConnectLinks) {
          meConnectLinks.classList.add('visible');
        }
        // As soon as the /me texts finish, intro the full-screen moving slideshow and the archive section below it
        if (meGallerySection) {
          setTimeout(() => {
            if (currentRun !== typingRunId) return;
            meGallerySection.classList.add('visible');
            meGallerySection.setAttribute('aria-hidden', 'false');
            startGallerySlideshow();
            if (meArchiveSection) {
              meArchiveSection.classList.add('visible');
              meArchiveSection.setAttribute('aria-hidden', 'false');
            }
          }, 220);
        }
        return;
      }

      const paragraphSegments = meParagraphsData[pIdx];

      if (!currentP) {
        currentP = document.createElement('p');
        currentP.className = 'me-paragraph';
        meTypingContainer.appendChild(currentP);
        currentP.appendChild(cursorEl);
        segIdx = 0;
        charIdx = 0;
        currentNode = null;
      }

      if (segIdx >= paragraphSegments.length) {
        pIdx++;
        currentP = null;
        currentNode = null;
        typingTimer = setTimeout(step, 260);
        return;
      }

      const seg = paragraphSegments[segIdx];
      const chars = Array.from(seg.text);

      if (!currentNode) {
        if (seg.underline) {
          const span = document.createElement('span');
          span.className = 'me-underline';
          currentP.insertBefore(span, cursorEl);
          currentNode = document.createTextNode('');
          span.appendChild(currentNode);
        } else {
          currentNode = document.createTextNode('');
          currentP.insertBefore(currentNode, cursorEl);
        }
      }

      if (charIdx < chars.length) {
        const ch = chars[charIdx];
        currentNode.nodeValue += ch;
        charIdx++;

        // Reading-paced delay: natural cadence with brief pauses on punctuation
        let delay = 26;
        if (ch === ',' || ch === '—' || ch === ';') {
          delay = 135;
        } else if (ch === '.' || ch === '?' || ch === '!') {
          delay = 240;
        } else if (ch === ' ') {
          delay = 32;
        }

        typingTimer = setTimeout(step, delay);
      } else {
        segIdx++;
        charIdx = 0;
        currentNode = null;
        typingTimer = setTimeout(step, 20);
      }
    }

    typingTimer = setTimeout(step, 220);
  }

  const meSlideshowTrack = document.getElementById('me-slideshow-track');
  const meCollageStage = document.getElementById('me-collage-stage');

  // Clone the 11-card collage stage once to create a seamless infinite horizontal slideshow loop
  if (meSlideshowTrack && meCollageStage && meSlideshowTrack.children.length === 1) {
    const cloneStage = meCollageStage.cloneNode(true);
    cloneStage.removeAttribute('id');
    cloneStage.setAttribute('aria-hidden', 'true');
    meSlideshowTrack.appendChild(cloneStage);
  }

  const collageCards = document.querySelectorAll('.me-collage-card');

  // 3 Curated Reel Sets for the 11-Card Collage Slideshow (.jpeg filenames on hover only)
  const galleryReels = [
    [
      { src: 'assets/gallery/card_1.png', caption: 'IMG_0104.jpeg' },
      { src: 'assets/gallery/card_2.png', caption: 'IMG_0118.jpeg' },
      { src: 'assets/gallery/card_3.png', caption: 'IMG_0142.jpeg' },
      { src: 'assets/gallery/card_4.png', caption: 'IMG_0189.jpeg' },
      { src: 'assets/gallery/card_5.png', caption: 'IMG_0215.jpeg' },
      { src: 'assets/gallery/card_6.png', caption: 'IMG_0241.jpeg' },
      { src: 'assets/gallery/card_7.png', caption: 'IMG_0276.jpeg' },
      { src: 'assets/gallery/card_8.png', caption: 'IMG_0310.jpeg' },
      { src: 'assets/gallery/card_9.png', caption: 'IMG_0348.jpeg' },
      { src: 'assets/gallery/card_10.png', caption: 'IMG_0374.jpeg' },
      { src: 'assets/gallery/card_11.png', caption: 'IMG_0392.jpeg' }
    ],
    [
      { src: 'assets/avatar.png', caption: 'IMG_0412.jpeg' },
      { src: 'assets/gallery/card_6.png', caption: 'IMG_0438.jpeg' },
      { src: 'assets/dp.png', caption: 'IMG_0465.jpeg' },
      { src: 'assets/gallery/card_9.png', caption: 'IMG_0501.jpeg' },
      { src: 'assets/avatar_square.png', caption: 'IMG_0529.jpeg' },
      { src: 'assets/gallery/card_11.png', caption: 'IMG_0564.jpeg' },
      { src: 'assets/gallery/card_1.png', caption: 'IMG_0590.jpeg' },
      { src: 'assets/gallery/card_3.png', caption: 'IMG_0618.jpeg' },
      { src: 'assets/avatar.png', caption: 'IMG_0647.jpeg' },
      { src: 'assets/gallery/card_8.png', caption: 'IMG_0683.jpeg' },
      { src: 'assets/gallery/card_4.png', caption: 'IMG_0715.jpeg' }
    ],
    [
      { src: 'assets/dp.png', caption: 'IMG_0742.jpeg' },
      { src: 'assets/gallery/card_10.png', caption: 'IMG_0779.jpeg' },
      { src: 'assets/avatar_square.png', caption: 'IMG_0804.jpeg' },
      { src: 'assets/gallery/card_3.png', caption: 'IMG_0831.jpeg' },
      { src: 'assets/gallery/card_8.png', caption: 'IMG_0866.jpeg' },
      { src: 'assets/gallery/card_2.png', caption: 'IMG_0892.jpeg' },
      { src: 'assets/gallery/card_5.png', caption: 'IMG_0918.jpeg' },
      { src: 'assets/avatar.png', caption: 'IMG_0945.jpeg' },
      { src: 'assets/gallery/card_4.png', caption: 'IMG_0973.jpeg' },
      { src: 'assets/gallery/card_7.png', caption: 'IMG_1008.jpeg' },
      { src: 'assets/gallery/card_6.png', caption: 'IMG_1034.jpeg' }
    ]
  ];

  let currentReelIdx = 0;
  let slideshowInterval = null;

  // Bidirectional Swipe / Drag + Continuous Auto-Glide State
  let trackOffsetX = 0;
  let dragVelocityX = 0;
  let isDraggingGallery = false;
  let isHoveringCard = false;
  let dragStartX = 0;
  let dragLastX = 0;
  let galleryRafId = null;
  const BASE_AUTO_SPEED = -0.65; // smooth continuous leftward slideshow speed

  function getSingleStageSpan() {
    if (!meCollageStage) return 1200;
    const style = window.getComputedStyle(meCollageStage);
    const marginRight = parseFloat(style.marginRight) || 0;
    return meCollageStage.offsetWidth + marginRight;
  }

  function wrapTrackOffset(offset) {
    const span = getSingleStageSpan();
    if (span <= 0) return 0;
    let wrapped = offset % span;
    if (wrapped > 0) wrapped -= span;
    return wrapped;
  }

  function renderGalleryTrack() {
    if (!meSlideshowTrack) return;
    if (!isDraggingGallery) {
      // Apply user swipe inertia + smooth auto-glide
      if (Math.abs(dragVelocityX) > 0.05) {
        trackOffsetX += dragVelocityX;
        dragVelocityX *= 0.93;
      } else {
        dragVelocityX = 0;
      }
      if (!isHoveringCard) {
        trackOffsetX += BASE_AUTO_SPEED;
      }
    }
    trackOffsetX = wrapTrackOffset(trackOffsetX);
    meSlideshowTrack.style.transform = `translate3d(${trackOffsetX.toFixed(2)}px, 0, 0)`;
    galleryRafId = requestAnimationFrame(renderGalleryTrack);
  }

  if (meGallerySection && meSlideshowTrack) {
    collageCards.forEach((card) => {
      card.addEventListener('mouseenter', () => {
        isHoveringCard = true;
      });
      card.addEventListener('mouseleave', () => {
        isHoveringCard = false;
      });
    });

    // Mouse drag left & right
    meGallerySection.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDraggingGallery = true;
      dragStartX = e.clientX;
      dragLastX = e.clientX;
      dragVelocityX = 0;
      meGallerySection.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingGallery) return;
      const dx = e.clientX - dragLastX;
      dragLastX = e.clientX;
      trackOffsetX = wrapTrackOffset(trackOffsetX + dx);
      dragVelocityX = dx * 0.85;
    });

    window.addEventListener('mouseup', () => {
      if (!isDraggingGallery) return;
      isDraggingGallery = false;
      meGallerySection.classList.remove('is-dragging');
    });

    // Touch swipe left & right
    meGallerySection.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length === 0) return;
      isDraggingGallery = true;
      dragStartX = e.touches[0].clientX;
      dragLastX = e.touches[0].clientX;
      dragVelocityX = 0;
    }, { passive: true });

    meGallerySection.addEventListener('touchmove', (e) => {
      if (!isDraggingGallery || !e.touches || e.touches.length === 0) return;
      const currentX = e.touches[0].clientX;
      const dx = currentX - dragLastX;
      dragLastX = currentX;
      trackOffsetX = wrapTrackOffset(trackOffsetX + dx);
      dragVelocityX = dx * 0.9;
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (!isDraggingGallery) return;
      isDraggingGallery = false;
    });

    // Two-finger trackpad horizontal swipe left & right
    meGallerySection.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault();
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        trackOffsetX = wrapTrackOffset(trackOffsetX - delta);
        dragVelocityX = -delta * 0.25;
      }
    }, { passive: false });
  }

  function applyGalleryReel(reelIndex) {
    currentReelIdx = (reelIndex + galleryReels.length) % galleryReels.length;
    const reelData = galleryReels[currentReelIdx];

    collageCards.forEach((card) => {
      const slotIdx = parseInt(card.getAttribute('data-slot') || '0', 10);
      const item = reelData[slotIdx];
      if (!item) return;
      const imgs = card.querySelectorAll('.me-card-img');
      const captionEl = card.querySelector('.me-card-caption');

      // Staggered crossfade across the 11 cards
      setTimeout(() => {
        if (imgs.length >= 2) {
          const activeImg = card.querySelector('.me-card-img.active-slide') || imgs[0];
          const nextImg = activeImg === imgs[0] ? imgs[1] : imgs[0];
          nextImg.src = item.src;
          nextImg.alt = item.caption;
          activeImg.classList.remove('active-slide');
          nextImg.classList.add('active-slide');
        }
        if (captionEl) {
          captionEl.textContent = item.caption;
        }
      }, slotIdx * 45);
    });
  }

  function startGallerySlideshow() {
    stopGallerySlideshow();
    if (!galleryRafId) {
      galleryRafId = requestAnimationFrame(renderGalleryTrack);
    }
    slideshowInterval = setInterval(() => {
      applyGalleryReel(currentReelIdx + 1);
    }, 5200);
  }

  function stopGallerySlideshow() {
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
    }
    if (galleryRafId) {
      cancelAnimationFrame(galleryRafId);
      galleryRafId = null;
    }
  }

  function openMeView() {
    document.body.classList.add('me-view-active');
    if (meViewSection) meViewSection.setAttribute('aria-hidden', 'false');
    allNavLinks.forEach((link) => link.classList.remove('active'));
    if (navMeLink) navMeLink.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
    startMeReadingTypewriter();
  }

  function closeMeView() {
    stopMeTyping();
    stopGallerySlideshow();
    if (meGallerySection) {
      meGallerySection.classList.remove('visible', 'is-dragging');
      meGallerySection.setAttribute('aria-hidden', 'true');
    }
    if (meArchiveSection) {
      meArchiveSection.classList.remove('visible');
      meArchiveSection.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('me-view-active');
    if (meViewSection) meViewSection.setAttribute('aria-hidden', 'true');
    allNavLinks.forEach((link) => link.classList.remove('active'));
    if (navHomeLink) navHomeLink.classList.add('active');
  }

  // Support opening /me view from header and footer links
  document.querySelectorAll('[data-nav="me"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openMeView();
    });
  });

  // Support smooth scrolling from footer links
  document.querySelectorAll('.home-footer-link[data-nav="home"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (document.body.classList.contains('me-view-active')) {
        closeMeView();
      }
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.replaceState(null, '', '#home');
    });
  });

  document.querySelectorAll('.home-footer-link[data-nav="works"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (document.body.classList.contains('me-view-active')) {
        closeMeView();
      }
      const worksSection = document.getElementById('works');
      if (worksSection) {
        e.preventDefault();
        worksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#works');
      }
    });
  });

  allNavLinks.forEach((link) => {
    const targetNav = link.getAttribute('data-nav');
    if (targetNav && targetNav !== 'me' && targetNav !== 'contact' && targetNav !== 'resume') {
      link.addEventListener('click', (e) => {
        if (document.body.classList.contains('me-view-active')) {
          closeMeView();
          if (targetNav === 'home') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'instant' });
          }
        }

        if (targetNav === 'mosaic') {
          const mosaicSection = document.getElementById('mosaic');
          if (mosaicSection) {
            e.preventDefault();
            allNavLinks.forEach((l) => l.classList.remove('active'));
            link.classList.add('active');
            requestAnimationFrame(() => {
              mosaicSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            history.replaceState(null, '', '#mosaic');
          }
        }
      });
    }
  });

  if (window.location.hash === '#me') {
    openMeView();
  } else if (window.location.hash === '#mosaic') {
    const mosaicSection = document.getElementById('mosaic');
    const navMosaicLink = document.querySelector('.nav-item[data-nav="mosaic"]');
    if (mosaicSection) {
      allNavLinks.forEach((l) => l.classList.remove('active'));
      if (navMosaicLink) navMosaicLink.classList.add('active');
      setTimeout(() => mosaicSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }



  /* ==========================================================================
     7. Home Project Cards — Staggered Scroll Reveal & Interactive 3D Motion
     ========================================================================== */
  const homeRevealCards = document.querySelectorAll(
    '.featured-item, .grid-project-card, .video-section-header, .video-project-card'
  );

  homeRevealCards.forEach((el, index) => {
    el.classList.add('card-scroll-reveal');
    const colDelay = (index % 3) * 85;
    el.style.setProperty('--reveal-delay', `${colDelay}ms`);
  });

  if ('IntersectionObserver' in window) {
    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    homeRevealCards.forEach((el) => cardObserver.observe(el));
  } else {
    homeRevealCards.forEach((el) => el.classList.add('is-revealed'));
  }

  /* ==========================================================================
     8. Footer Display Email Pixel-Perfect Right-Edge Alignment
     ========================================================================== */
  function alignFooterEmail() {
    const line1 = document.querySelector('.home-footer-line-1');
    const line2 = document.querySelector('.home-footer-line-2');
    if (!line1 || !line2) return;

    line2.style.fontSize = '';
    const r1 = line1.getBoundingClientRect();
    const r2 = line2.getBoundingClientRect();
    if (r1.width > 0 && r2.width > 0) {
      const computed = parseFloat(window.getComputedStyle(line2).fontSize);
      const ratio = r1.width / r2.width;
      line2.style.fontSize = `${(computed * ratio).toFixed(2)}px`;
    }
  }

  alignFooterEmail();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(alignFooterEmail);
  }
  window.addEventListener('resize', alignFooterEmail);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPortfolioHero);
} else {
  initPortfolioHero();
}
