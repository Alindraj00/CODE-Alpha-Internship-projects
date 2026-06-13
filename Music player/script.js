/* =====================================================
   AURA PLAYER — script.js
   Features: play/pause, prev/next, progress bar,
   volume control, shuffle, repeat, autoplay,
   playlist, file upload, canvas waveform visualizer
   ===================================================== */

// ── DOM refs ──────────────────────────────────────────
const audio          = document.getElementById('audioEl');
const playPauseBtn   = document.getElementById('playPauseBtn');
const iconPlay       = document.getElementById('iconPlay');
const iconPause      = document.getElementById('iconPause');
const prevBtn        = document.getElementById('prevBtn');
const nextBtn        = document.getElementById('nextBtn');
const progressSlider = document.getElementById('progressSlider');
const currentTimeEl  = document.getElementById('currentTime');
const totalTimeEl    = document.getElementById('totalTime');
const volumeSlider   = document.getElementById('volumeSlider');
const muteBtn        = document.getElementById('muteBtn');
const songTitleEl    = document.getElementById('songTitle');
const songArtistEl   = document.getElementById('songArtist');
const artWrapper     = document.getElementById('artWrapper');
const artImg         = document.getElementById('artImg');
const playlistEl     = document.getElementById('playlistEl');
const togglePlaylistBtn = document.getElementById('togglePlaylist');
const closePlaylistBtn  = document.getElementById('closePlaylist');
const playlistPanel  = document.getElementById('playlistPanel');
const toggleShuffleBtn  = document.getElementById('toggleShuffle');
const toggleRepeatBtn   = document.getElementById('toggleRepeat');
const autoplayCheck     = document.getElementById('autoplayCheck');
const uploadBtn         = document.getElementById('uploadBtn');
const fileInput         = document.getElementById('fileInput');
const waveCanvas        = document.getElementById('waveCanvas');
const ctx               = waveCanvas.getContext('2d');

// ── State ─────────────────────────────────────────────
let playlist      = [];   // { name, artist, url, duration }
let currentIndex  = 0;
let isPlaying     = false;
let isShuffle     = false;
let isRepeat      = false;   // 'none' | 'one' | 'all'
let repeatMode    = 'none';
let isMuted       = false;
let prevVolume    = 80;
let audioCtx, analyser, source, dataArray, animFrame;
let trackDurations = {};   // cache durations by url

// ── Demo / starter tracks (royalty-free samples) ──────
const defaultTracks = [
  { name: 'Chill Vibes',    artist: 'Aura Demo', url: '' },
  { name: 'Night Drive',    artist: 'Aura Demo', url: '' },
  { name: 'Electric Pulse', artist: 'Aura Demo', url: '' },
];

// ── Utilities ─────────────────────────────────────────
function fmtTime(s) {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${sec}`;
}

function pickColor(alpha = 1) {
  return `rgba(167,139,250,${alpha})`;
}

// ── Canvas waveform ───────────────────────────────────
function resizeCanvas() {
  const rect = waveCanvas.parentElement.getBoundingClientRect();
  waveCanvas.width  = Math.round(rect.width  * devicePixelRatio);
  waveCanvas.height = Math.round(waveCanvas.offsetHeight * devicePixelRatio);
  ctx.scale(devicePixelRatio, devicePixelRatio);
}
window.addEventListener('resize', () => { resizeCanvas(); if (!isPlaying) drawIdleWave(); });

function initAudioCtx() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function drawWave() {
  const W = waveCanvas.offsetWidth;
  const H = waveCanvas.offsetHeight;
  analyser.getByteFrequencyData(dataArray);
  ctx.clearRect(0, 0, W, H);

  const bars  = dataArray.length;
  const gap   = 2;
  const bw    = (W - gap * (bars - 1)) / bars;
  const progress = parseFloat(progressSlider.value) / 100;
  const splitX = W * progress;

  for (let i = 0; i < bars; i++) {
    const x  = i * (bw + gap);
    const pct = dataArray[i] / 255;
    const h  = Math.max(3, pct * H * 0.9);
    const y  = (H - h) / 2;
    const cx = x + bw / 2;

    ctx.fillStyle = cx < splitX
      ? `rgba(167,139,250,${0.6 + pct * 0.4})`
      : `rgba(255,255,255,0.12)`;

    ctx.beginPath();
    ctx.roundRect(x, y, bw, h, 2);
    ctx.fill();
  }

  animFrame = requestAnimationFrame(drawWave);
}

function drawIdleWave() {
  const W = waveCanvas.offsetWidth;
  const H = waveCanvas.offsetHeight;
  ctx.clearRect(0, 0, W, H);
  const bars = 64;
  const gap  = 2;
  const bw   = (W - gap * (bars - 1)) / bars;
  const progress = parseFloat(progressSlider.value) / 100;
  const splitX = W * progress;

  for (let i = 0; i < bars; i++) {
    const x  = i * (bw + gap);
    const h  = Math.max(2, 3 + Math.sin(i * 0.4) * 5 + Math.random() * 2);
    const y  = (H - h) / 2;
    const cx = x + bw / 2;
    ctx.fillStyle = cx < splitX ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, h, 2);
    ctx.fill();
  }
}

// ── Volume slider fill ─────────────────────────────────
function updateVolumeSliderFill() {
  volumeSlider.style.setProperty('--val', volumeSlider.value + '%');
}

// ── Playlist render ───────────────────────────────────
function renderPlaylist() {
  playlistEl.innerHTML = '';
  if (playlist.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'color:var(--text-3);font-size:13px;padding:16px 20px;';
    li.textContent = 'No songs yet. Upload some!';
    playlistEl.appendChild(li);
    return;
  }
  playlist.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = i === currentIndex ? 'active' : '';
    if (i === currentIndex && isPlaying) li.classList.add('playing');
    li.innerHTML = `
      <span class="pl-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="pl-info">
        <div class="pl-name">${track.name}</div>
        <div class="pl-dur">${track.artist}</div>
      </div>
      <div class="pl-eq"><span></span><span></span><span></span></div>
    `;
    li.addEventListener('click', () => loadTrack(i, true));
    playlistEl.appendChild(li);
  });
}

// ── Load and play a track ─────────────────────────────
function loadTrack(index, autoPlay = false) {
  if (!playlist.length) return;
  currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
  const track = playlist[currentIndex];

  // Reset UI
  progressSlider.value = 0;
  currentTimeEl.textContent = '0:00';
  totalTimeEl.textContent   = '0:00';
  songTitleEl.textContent   = track.name;
  songArtistEl.textContent  = track.artist;

  if (track.url) {
    audio.src = track.url;
    audio.load();
    if (autoPlay) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      setPlaying(false);
    }
  } else {
    songArtistEl.textContent = '— Demo track, no audio file —';
  }

  renderPlaylist();
  updateActiveArt();
}

function updateActiveArt() {
  // Placeholder gradient art per track index
  const gradients = [
    'linear-gradient(135deg,#7C3AED,#EC4899)',
    'linear-gradient(135deg,#2563EB,#7C3AED)',
    'linear-gradient(135deg,#EC4899,#F59E0B)',
    'linear-gradient(135deg,#10B981,#2563EB)',
    'linear-gradient(135deg,#F59E0B,#EC4899)',
  ];
  artImg.style.background = gradients[currentIndex % gradients.length];
  artImg.innerHTML = `<svg class="music-note-svg" viewBox="0 0 100 100"><text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-size="52" opacity="0.6">♪</text></svg>`;
}

// ── Play / Pause state ────────────────────────────────
function setPlaying(state) {
  isPlaying = state;
  if (state) {
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
    artWrapper.classList.add('playing');
    if (!audioCtx) initAudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    cancelAnimationFrame(animFrame);
    drawWave();
    updatePlayingRow();
  } else {
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    artWrapper.classList.remove('playing');
    cancelAnimationFrame(animFrame);
    drawIdleWave();
    updatePlayingRow();
  }
}

function updatePlayingRow() {
  document.querySelectorAll('.playlist li').forEach((li, i) => {
    li.classList.toggle('playing', i === currentIndex && isPlaying);
  });
}

// ── Controls ──────────────────────────────────────────
playPauseBtn.addEventListener('click', () => {
  if (!playlist.length) { uploadBtn.click(); return; }
  if (!audio.src || audio.src === window.location.href) {
    loadTrack(currentIndex, true);
    return;
  }
  if (isPlaying) {
    audio.pause();
    setPlaying(false);
  } else {
    audio.play().then(() => setPlaying(true)).catch(console.warn);
  }
});

prevBtn.addEventListener('click', () => {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
  } else {
    let idx = isShuffle ? randomIndex() : currentIndex - 1;
    loadTrack(idx, isPlaying);
  }
});

nextBtn.addEventListener('click', () => {
  let idx = isShuffle ? randomIndex() : currentIndex + 1;
  loadTrack(idx, isPlaying);
});

function randomIndex() {
  if (playlist.length <= 1) return 0;
  let idx;
  do { idx = Math.floor(Math.random() * playlist.length); } while (idx === currentIndex);
  return idx;
}

// ── Audio events ──────────────────────────────────────
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  progressSlider.value = pct;
  currentTimeEl.textContent = fmtTime(audio.currentTime);
  if (isPlaying) drawIdleWave(); // refresh idle for progress colour while playing from waveform
});

audio.addEventListener('loadedmetadata', () => {
  totalTimeEl.textContent = fmtTime(audio.duration);
});

audio.addEventListener('play',  () => setPlaying(true));
audio.addEventListener('pause', () => setPlaying(false));

audio.addEventListener('ended', () => {
  setPlaying(false);
  if (repeatMode === 'one') {
    audio.currentTime = 0;
    audio.play().then(() => setPlaying(true));
  } else if (autoplayCheck.checked || repeatMode === 'all') {
    const next = isShuffle ? randomIndex() : currentIndex + 1;
    if (next >= playlist.length && repeatMode !== 'all') {
      loadTrack(0, false); // stop at end without repeat
    } else {
      loadTrack(next, true);
    }
  }
});

// ── Seek ──────────────────────────────────────────────
progressSlider.addEventListener('input', () => {
  if (audio.duration) {
    audio.currentTime = (progressSlider.value / 100) * audio.duration;
  }
  drawIdleWave();
});

// ── Volume ────────────────────────────────────────────
audio.volume = 0.8;
volumeSlider.addEventListener('input', () => {
  const v = volumeSlider.value / 100;
  audio.volume = v;
  isMuted = v === 0;
  updateVolumeSliderFill();
  updateVolIcon();
});

muteBtn.addEventListener('click', () => {
  if (isMuted) {
    audio.volume = prevVolume / 100;
    volumeSlider.value = prevVolume;
    isMuted = false;
  } else {
    prevVolume = volumeSlider.value;
    audio.volume = 0;
    volumeSlider.value = 0;
    isMuted = true;
  }
  updateVolumeSliderFill();
  updateVolIcon();
});

function updateVolIcon() {
  const v = audio.volume;
  let d;
  if (v === 0 || isMuted) {
    d = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
  } else if (v < 0.5) {
    d = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  } else {
    d = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
  }
  document.getElementById('volIcon').innerHTML = d;
}

// ── Shuffle ───────────────────────────────────────────
toggleShuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  toggleShuffleBtn.classList.toggle('active', isShuffle);
});

// ── Repeat ────────────────────────────────────────────
const repeatModes = ['none', 'all', 'one'];
const repeatLabels = {
  none: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  all:  '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  one:  '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="11" y="13.5" font-size="7" fill="currentColor" font-family="sans-serif" font-weight="bold">1</text>',
};

toggleRepeatBtn.addEventListener('click', () => {
  const i = repeatModes.indexOf(repeatMode);
  repeatMode = repeatModes[(i + 1) % repeatModes.length];
  toggleRepeatBtn.classList.toggle('active', repeatMode !== 'none');
  document.getElementById('repeatIcon').innerHTML = repeatLabels[repeatMode];
});

// ── Playlist toggle ───────────────────────────────────
togglePlaylistBtn.addEventListener('click', () => {
  playlistPanel.classList.toggle('open');
});
closePlaylistBtn.addEventListener('click', () => {
  playlistPanel.classList.remove('open');
});

// ── File upload ───────────────────────────────────────
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const firstNewIdx = playlist.length;

  files.forEach(file => {
    const url    = URL.createObjectURL(file);
    const rawName = file.name.replace(/\.[^.]+$/, '');
    // Try to extract "Artist - Title" pattern
    const parts = rawName.split(/\s*[-–—]\s*/);
    const name   = parts.length >= 2 ? parts.slice(1).join(' - ') : rawName;
    const artist = parts.length >= 2 ? parts[0] : 'Unknown Artist';

    playlist.push({ name, artist, url, duration: 0 });
  });

  renderPlaylist();
  loadTrack(firstNewIdx, true);
  playlistPanel.classList.add('open');

  // Reset input so same file can be re-uploaded
  fileInput.value = '';
});

// ── Keyboard shortcuts ────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Don't hijack typing
  if (e.target.tagName === 'INPUT') return;
  switch (e.code) {
    case 'Space':       e.preventDefault(); playPauseBtn.click(); break;
    case 'ArrowRight':  if (audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); break;
    case 'ArrowLeft':   if (audio.duration) audio.currentTime = Math.max(audio.currentTime - 5, 0); break;
    case 'ArrowUp':     e.preventDefault(); volumeSlider.value = Math.min(+volumeSlider.value + 5, 100); volumeSlider.dispatchEvent(new Event('input')); break;
    case 'ArrowDown':   e.preventDefault(); volumeSlider.value = Math.max(+volumeSlider.value - 5, 0);  volumeSlider.dispatchEvent(new Event('input')); break;
    case 'KeyN':        nextBtn.click(); break;
    case 'KeyP':        prevBtn.click(); break;
    case 'KeyM':        muteBtn.click(); break;
  }
});

// ── Init ──────────────────────────────────────────────
(function init() {
  resizeCanvas();
  updateVolumeSliderFill();
  drawIdleWave();
  renderPlaylist(); // shows "no songs yet"
})();
