// js/main.js
const spinner = document.getElementById('spinner');
const select  = document.getElementById('sceneSelect');
const scene   = document.querySelector('a-scene');
const assets  = document.querySelector('a-assets');

function isMono(url) {
  return /_Mono(\.[a-z0-9]+)$/i.test(url);
}

function showSpinner(){ spinner.style.display = 'block'; }
function hideSpinner(){ spinner.style.display = 'none'; }

async function fetchMediaList() {
  // GitHub API público retorna JSON com arquivos da pasta media/
  const resp = await fetch('https://api.github.com/repos/lucakassab/360/contents/media');
  const json = await resp.json();
  return json
    .filter(f => f.type === 'file')
    .map(f => ({ name: f.name, url: `media/${f.name}` }));
}

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);
  scene.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (item.url.match(/\.(mp4|webm)$/i)) {
    const vid = document.createElement('video');
    vid.id = 'vid'; vid.src = item.url; vid.crossOrigin = 'anonymous';
    vid.loop = true; vid.setAttribute('playsinline', '');
    await vid.play(); // aguarda o play começar
    assets.appendChild(vid);

    const vs = document.createElement('a-videosphere');
    vs.classList.add('dyn-media');
    vs.setAttribute('src', '#vid');
    vs.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true; gyroscopeEnabled:false');
    if (!mono) vs.setAttribute('stereo-top-bottom', '');
    scene.appendChild(vs);
    hideSpinner();

  } else {
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('src', item.url);
    sky.setAttribute('look-controls', 'touchEnabled:true; mouseEnabled:true; gyroscopeEnabled:false');
    if (!mono) sky.setAttribute('stereo-top-bottom','');
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', hideSpinner, { once:true });
  }
}

async function init() {
  const MEDIA = await fetchMediaList();
  // popula dropdown
  MEDIA.forEach((m,i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.text = m.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => loadMedia(MEDIA[select.value]));
  loadMedia(MEDIA[0]);

  // import plugin só em VR e se for estéreo
  window.addEventListener('enter-vr', async () => {
    const item = MEDIA[select.value];
    if (!isMono(item.url)) await import('../libs/aframe-stereo-component.js');
  });
}

init();
