// js/main.js
const spinner = document.getElementById('spinner');
const select  = document.getElementById('sceneSelect');
const scene   = document.querySelector('a-scene');
const assets  = document.querySelector('a-assets');

function isMono(url) { return /_Mono(\.[a-z0-9]+)$/i.test(url); }
function showSpinner(){ spinner.style.display = 'block'; }
function hideSpinner(){ spinner.style.display = 'none'; }

async function fetchMediaList() {
  const resp = await fetch('https://api.github.com/repos/lucakassab/360/contents/media');
  const json = await resp.json();
  return json
    .filter(f => f.type === 'file')
    .map(f => ({ name: f.name, url: `media/${f.name}` }));
}

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (item.url.match(/\.(mp4|webm)$/i)) {
    // Vídeo
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
    vs.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true; gyroscopeEnabled:false');
    vs.setAttribute('src', '#vid');
    if (!mono) {
      // Crop top half fora do VR
      vs.setAttribute('material', 'shader: flat; side: back; src: #vid; repeat: 1 0.5; offset: 0 0.5');
    }
    scene.appendChild(vs);
    hideSpinner();

  } else {
    // Imagem
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true; gyroscopeEnabled:false');
    if (mono) {
      sky.setAttribute('src', item.url);
    } else {
      // Crop top half fora do VR
      sky.setAttribute('material', `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
    }
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', hideSpinner, { once: true });
  }
}

async function init() {
  const MEDIA = await fetchMediaList();
  MEDIA.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text = m.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => loadMedia(MEDIA[select.value]));
  loadMedia(MEDIA[0]);

  window.addEventListener('enter-vr', async () => {
    const item = MEDIA[select.value];
    if (!isMono(item.url)) {
      // Importa plugin estéreo
      await import('../libs/aframe-stereo-component.js');
      const entity = document.querySelector('.dyn-media');
      // Remove crop para plugin funcionar
      entity.removeAttribute('material');
      entity.setAttribute('stereo-top-bottom', '');
    }
  });
}

init();