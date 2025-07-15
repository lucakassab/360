// core.js
import mediaList from './media/media.js';

const container     = document.getElementById('xr-container');
const select        = document.getElementById('media-select');
const prevBtn       = document.getElementById('prev-btn');
const nextBtn       = document.getElementById('next-btn');
const enterVrBtn    = document.getElementById('enter-vr-btn');

let currentIndex    = 0;
let platformHandler = null;
let currentMode     = '';
let renderer        = null;

function populateUI() {
  select.innerHTML = '';
  mediaList.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = m.name;
    select.appendChild(opt);
  });
}

function updateIndex(idx) {
  currentIndex = (idx + mediaList.length) % mediaList.length;
  select.value = currentIndex;
  platformHandler.load(mediaList[currentIndex]);
}

async function enterVR() {
  if (currentMode === 'vr') return;

  console.log('Solicitando sessão XR (immersive-vr)...');
  const session = await navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking']
  });

  console.log('Sessão XR concedida');
  session.addEventListener('end', async () => {
    console.log('Sessão VR encerrada — transferindo logs e reconstruindo cena...');
    if (platformHandler.renderer) {
      platformHandler.renderer.setAnimationLoop(null);
    }
    let vrLogs = [];
    try {
      const vrDbg = await import('./platforms/vr/vr_dbg_widget.js');
      vrLogs = vrDbg.getLogs();
    } catch (e) {
      console.error('Não foi possível obter logs VR:', e);
    }
    container.innerHTML = '';
    currentMode = '';
    await init();
    if (platformHandler.appendLogs) {
      platformHandler.appendLogs(vrLogs);
    }
  });

  const { init: vrInit, load: vrLoad } = await import('./platforms/vr.js');
  platformHandler = { init: vrInit, load: vrLoad };
  currentMode = 'vr';

  await platformHandler.init({ container, xrSession: session });
  renderer = platformHandler.renderer;
  platformHandler.load(mediaList[currentIndex]);
}

async function init() {
  populateUI();

  container.innerHTML = '';

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const mode     = isMobile ? 'mobile' : 'desktop';
  currentMode    = mode;
  console.log('Inicializando em', mode);

  const mod = await import(`./platforms/${mode}.js`);
  platformHandler = mod;
  await platformHandler.init({ container });
  renderer = platformHandler.renderer;
  platformHandler.load(mediaList[currentIndex]);

  let hasVR = false;
  if (navigator.xr) {
    hasVR = await navigator.xr.isSessionSupported('immersive-vr');
  }
  if (hasVR) {
    enterVrBtn.style.display = '';
    enterVrBtn.onclick = enterVR;
  } else {
    enterVrBtn.style.display = 'none';
  }

  prevBtn.onclick = () => updateIndex(currentIndex - 1);
  nextBtn.onclick = () => updateIndex(currentIndex + 1);
  select.onchange = e => updateIndex(Number(e.target.value));
}

init();
