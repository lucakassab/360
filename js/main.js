// js/main.js
const spinner = document.getElementById('spinner');
const select  = document.getElementById('sceneSelect');
const scene   = document.querySelector('a-scene');
const assets  = document.querySelector('a-assets');
let cameraObj;
let MEDIA = [];  // vai receber a lista dinâmica

function isMono(url) {
  const result = /_Mono(\.[a-z0-9]+)$/i.test(url);
  console.debug(`[isMono] ${url} → ${result}`);
  return result;
}

function showSpinner() {
  console.debug('[UI] showSpinner');
  spinner.style.display = 'block';
}

function hideSpinner() {
  console.debug('[UI] hideSpinner');
  spinner.style.display = 'none';
}

async function fetchMediaList() {
  console.debug('[Init] Buscando lista de mídias via GitHub API...');
  const resp = await fetch('https://api.github.com/repos/lucakassab/360/contents/media');
  const json = await resp.json();
  const list = json
    .filter(entry => entry.type === 'file')
    .map(entry => ({ name: entry.name, url: `media/${entry.name}` }));
  console.debug('[Init] Mídias encontradas:', list);
  return list;
}

async function loadMedia(item) {
  console.debug('[loadMedia] Carregando:', item);
  showSpinner();
  const mono = isMono(item.url);

  // remove mídia antiga
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (/\.(mp4|webm)$/i.test(item.url)) {
    console.debug('[loadMedia] Tipo: vídeo');
    const vid = document.createElement('video');
    vid.id = 'vid';
    vid.src = item.url;
    vid.crossOrigin = 'anonymous';
    vid.loop = true;
    vid.setAttribute('playsinline', '');
    await vid.play();
    assets.appendChild(vid);

    const vs = document.createElement('a-videosphere');
    vs.classList.add('dyn-media');
    vs.setAttribute('src', '#vid');
    vs.setAttribute('look-controls', 'enabled: false');
    if (!mono) {
      vs.setAttribute('material', 'shader: flat; side: back; src: #vid; repeat: 1 0.5; offset: 0 0.5');
    }
    scene.appendChild(vs);
    hideSpinner();

  } else {
    console.debug('[loadMedia] Tipo: imagem');
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls', 'enabled: false');
    if (mono) {
      sky.setAttribute('src', item.url);
    } else {
      sky.setAttribute('material', `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
    }
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', () => {
      console.debug('[loadMedia] Imagem carregada');
      hideSpinner();
    }, { once: true });
  }
}

function enableDragOrbit() {
  scene.addEventListener('loaded', () => {
    const camEl = scene.querySelector('[camera]');
    cameraObj = camEl.object3D;
    console.debug('[Camera] Orbit drag ativado');
    let isDown = false, lastX = 0, lastY = 0;
    let yaw = 0, pitch = 0;
    const canvas = scene.canvas;
    const sensitivity = 0.005;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => {
      isDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
      console.debug('[Pointer] down', e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup',   () => { isDown = false; });
    canvas.addEventListener('pointerleave',() => { isDown = false; });

    canvas.addEventListener('pointermove', e => {
      if (!isDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      yaw   -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      cameraObj.rotation.set(pitch, yaw, 0);
      lastX = e.clientX;
      lastY = e.clientY;
      console.debug('[Pointer] rotate pitch:', pitch.toFixed(2), 'yaw:', yaw.toFixed(2));
    });
  });
}

async function init() {
  console.debug('[Init] Inicializando aplicação');
  MEDIA = await fetchMediaList();

  // popula dropdown
  MEDIA.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text  = m.name;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    console.debug('[UI] Dropdown mudou:', MEDIA[select.value]);
    loadMedia(MEDIA[select.value]);
  });

  // carrega a primeira mídia
  loadMedia(MEDIA[0]);

  // evento VR
  window.addEventListener('enter-vr', async () => {
    const item = MEDIA[select.value];
    console.debug('[VR] Entrando em modo VR:', item);
    if (!isMono(item.url)) {
      await import('../libs/aframe-stereo-component.js');
      // remove vista mono/top-crop
      document.querySelectorAll('.dyn-media').forEach(el => el.remove());
      // cria sky para olho esquerdo
      const skyL = document.createElement('a-sky');
      skyL.classList.add('dyn-media');
      skyL.setAttribute('src', item.url);
      skyL.setAttribute('stereo', 'eye:left; split:vertical');
      scene.appendChild(skyL);
      // sky para olho direito (clone)
      const skyR = skyL.cloneNode();
      skyR.setAttribute('stereo', 'eye:right; split:vertical');
      scene.appendChild(skyR);
      console.debug('[VR] Stereo plugin aplicado corretamente');
    }
  });

  enableDragOrbit();
}

init();
