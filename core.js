// core.js

import { setupVRInputs } from './platforms/vr_inputs.js';

const loadingEl = document.getElementById('loading');
const dropdown  = document.getElementById('mediaSelect');
const btnPrev   = document.getElementById('prevBtn');
const btnNext   = document.getElementById('nextBtn');

let mediaList = [];
let currentIndex = 0;
let currentModule;
let platformMod;
let isLoading = false;

main();

async function main() {
  mediaList = await (await fetch('./media/media.json')).json();
  mediaList.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = m.name;
    dropdown.appendChild(opt);
  });

  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    platformMod = await import('./platforms/mobile.js');
  } else {
    platformMod = await import('./platforms/desktop.js');
  }

  await platformMod.init();
  currentModule = platformMod;

  dropdown.onchange = () => {
    currentIndex = +dropdown.value;
    loadMedia(currentIndex);
  };
  btnPrev.onclick = async () => {
    if (isLoading) return;
    currentIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
    dropdown.value = currentIndex;
    await loadMedia(currentIndex);
  };
  btnNext.onclick = async () => {
    if (isLoading) return;
    currentIndex = (currentIndex + 1) % mediaList.length;
    dropdown.value = currentIndex;
    await loadMedia(currentIndex);
  };

  await loadMedia(currentIndex);

  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
    const renderer = platformMod.renderer;
    renderer.xr.enabled = true;
    const { VRButton } = await import('./libs/VRButton.js');
    document.body.appendChild(VRButton.createButton(renderer));
    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend',   onSessionEnd);
  }
}

async function onSessionStart() {
  console.log('🌐 VR session started');
  const vrMod = await import('./platforms/vr.js');
  await vrMod.initXR(platformMod.renderer);
  currentModule = vrMod;
  await loadMedia(currentIndex);

  setupVRInputs(vrMod.renderer, {
    onNext: async () => {
      if (isLoading) return;
      currentIndex = (currentIndex + 1) % mediaList.length;
      dropdown.value = currentIndex;
      await loadMedia(currentIndex);
    },
    onPrev: async () => {
      if (isLoading) return;
      currentIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
      dropdown.value = currentIndex;
      await loadMedia(currentIndex);
    },
    onToggleHUD: () => {
      // Usa função interna do vrMod pra ativar HUD
      if (typeof vrMod._toggleDebug === 'function') {
        vrMod._toggleDebug();
      } else {
        console.warn('⚠️ vrMod._toggleDebug() não está disponível');
      }
    },
    onSnap: (hand, dir) => {
      console.log(`Snap ${hand} -> ${dir > 0 ? '➡️' : '⬅️'}`);
    },
    onDebugLog: (hand, idx) => {
      console.log(`[${hand}] button[${idx}]`);
    }
  });
}

async function onSessionEnd() {
  console.log('🌐 VR session ended');
  platformMod.renderer.xr.enabled = false;
  await platformMod.init();
  currentModule = platformMod;
  await loadMedia(currentIndex);
}

async function loadMedia(idx) {
  if (isLoading) return;
  isLoading = true;
  loadingEl.style.display = 'block';
  try {
    await currentModule.load(mediaList[idx]);
  } catch (err) {
    console.error('erro loadMedia:', err);
  }
  loadingEl.style.display = 'none';
  isLoading = false;
}
