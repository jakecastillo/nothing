(() => {
  "use strict";

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) {
    return;
  }

  const TAU = Math.PI * 2;
  const hardwareThreads = navigator.hardwareConcurrency || 0;
  const deviceMemory = navigator.deviceMemory || 0;
  const isLowPower =
    (hardwareThreads > 0 && hardwareThreads <= 4) ||
    (deviceMemory > 0 && deviceMemory <= 4);
  const frameInterval = isLowPower ? 1000 / 20 : 1000 / 30;
  const gradientInterval = isLowPower ? 400 : 240;
  const dprCap = isLowPower ? 1.5 : 2;

  let dpr = 1;
  let width = 0;
  let height = 0;
  let centerX = 0;
  let centerY = 0;
  let minDim = 0;

  let gradient = null;
  let lastGradientUpdate = 0;
  let lastFrame = 0;

  const baseA = [15, 19, 24];
  const baseB = [24, 29, 33];
  const baseC = [18, 22, 27];
  const baseD = [26, 30, 35];

  const isMac = /Mac/.test(navigator.platform);

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function resize() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, dprCap);
    dpr = nextDpr;
    width = Math.max(1, Math.floor(window.innerWidth * dpr));
    height = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    centerX = width / 2;
    centerY = height / 2;
    minDim = Math.min(width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function updateGradient(timeMs) {
    const t = timeMs / 1000;
    const driftX = 0.12 * Math.sin(t * 0.021);
    const driftY = 0.12 * Math.cos(t * 0.017);
    const x0 = width * clamp(0.15 + driftX, 0.05, 0.35);
    const y0 = height * clamp(0.15 + driftY, 0.05, 0.35);
    const x1 = width * clamp(0.85 - driftX, 0.65, 0.95);
    const y1 = height * clamp(0.85 - driftY, 0.65, 0.95);

    const blend = 0.5 + 0.5 * Math.sin(t * 0.02);
    const r1 = Math.round(mix(baseA[0], baseB[0], blend));
    const g1 = Math.round(mix(baseA[1], baseB[1], blend));
    const b1 = Math.round(mix(baseA[2], baseB[2], blend));
    const r2 = Math.round(mix(baseC[0], baseD[0], 1 - blend));
    const g2 = Math.round(mix(baseC[1], baseD[1], 1 - blend));
    const b2 = Math.round(mix(baseC[2], baseD[2], 1 - blend));

    const nextGradient = ctx.createLinearGradient(x0, y0, x1, y1);
    nextGradient.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
    nextGradient.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);
    gradient = nextGradient;
    lastGradientUpdate = timeMs;
  }

  function draw(timeMs) {
    if (timeMs - lastFrame < frameInterval) {
      window.requestAnimationFrame(draw);
      return;
    }

    lastFrame = timeMs;

    if (!gradient || timeMs - lastGradientUpdate > gradientInterval) {
      updateGradient(timeMs);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const t = timeMs / 1000;
    const pulse = 1 + 0.035 * Math.sin(t * 0.12);
    const radius = minDim * 0.2 * pulse;

    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.06, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, TAU);
    ctx.fill();

    window.requestAnimationFrame(draw);
  }

  let audioContext = null;
  let masterGain = null;
  let fadeTimeout = 0;
  let audioEnabled = false;

  function createNoise(context) {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function ensureAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    audioContext = new AudioContextClass();
    const noise = createNoise(audioContext);
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.4;

    masterGain = audioContext.createGain();
    masterGain.gain.value = 0;

    noise.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(audioContext.destination);
    noise.start(0);
  }

  function toggleAudio() {
    audioEnabled = !audioEnabled;
    if (!audioContext) {
      ensureAudio();
    }
    if (!audioContext || !masterGain) {
      return;
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;
    const target = audioEnabled ? 0.03 : 0;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(target, now + 2.5);

    if (!audioEnabled) {
      if (fadeTimeout) {
        window.clearTimeout(fadeTimeout);
      }
      fadeTimeout = window.setTimeout(() => {
        if (audioContext && audioContext.state === "running") {
          audioContext.suspend();
        }
      }, 3000);
    }
  }

  function requestClose() {
    const tauri = window.__TAURI__;
    if (tauri && tauri.window) {
      if (typeof tauri.window.getCurrent === "function") {
        tauri.window.getCurrent().close();
        return;
      }
      if (typeof tauri.window.getCurrentWindow === "function") {
        tauri.window.getCurrentWindow().close();
        return;
      }
      if (tauri.window.appWindow && typeof tauri.window.appWindow.close === "function") {
        tauri.window.appWindow.close();
        return;
      }
    }
    window.close();
  }

  window.addEventListener("resize", resize, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }
    const key = event.key ? event.key.toLowerCase() : "";
    if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "m") {
      toggleAudio();
      return;
    }
    if (isMac && event.metaKey && key === "w") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (!isMac && event.ctrlKey && key === "w") {
      event.preventDefault();
      requestClose();
    }
  });

  resize();
  window.requestAnimationFrame(draw);
})();
