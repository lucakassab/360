// js/main.js
import { OrbitControls } from '../libs/OrbitControls.js';

// 1) Registramos um component A-Frame que monta o OrbitControls na câmera
AFRAME.registerComponent('orbit-controls', {
  init: function () {
    // this.el é o <a-entity camera>
    const sceneEl = this.el.sceneEl;
    const threeCam = this.el.getObject3D('camera');
    // cria o OrbitControls
    this.controls = new OrbitControls(
      threeCam,
      sceneEl.renderer.domElement
    );
    this.controls.enableZoom = false;
    this.controls.enablePan  = false;
    this.controls.minPolarAngle = 0;        // pode olhar lá em cima
    this.controls.maxPolarAngle = Math.PI;  // pode olhar lá em baixo
  },
  tick: function () {
    // a cada frame a gente atualiza os controles
    this.controls.update();
  }
});

const spinner = document.getElementById('spinner');
const select  = document.getElementById('sceneSelect');
const scene   = document.querySelector('a-scene');
const assets  = document.querySelector('a-assets');
let MEDIA = [];

function isMono(url) {
  return /_Mono(\.[a-z0-9]+)$/i.test(url);
}

function showSpinner() { spinner.style.display = 'block'; }
function hideSpinner() { spinner.style.display = 'none'; }

async function fetchMediaList() {
  const resp = await fetch(
    'https://api.github.com/repos/lucakassab/360/contents/media'
  );
  const json = await resp.json();
  return json
    .filter(e => e.type === 'file')
    .map(e => ({ name: e.name, url: `media/${e.name}` }));
}

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);

  // limpa cenas antigas
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (/\.(mp4|webm)$/i.test(item.url)) {
    // vídeo
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
      vs.setAttribute(
        'material',
        'shader: flat; side: back; src: #vid; repeat: 1 0.5; offset: 0 0.5'
      );
    }
    scene.appendChild(vs);
    hideSpinner();
  } else {
    // imagem
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls', 'enabled: false');
    if (!mono) {
      sky.setAttribute(
        'material',
        `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`
      );
    } else {
      sky.setAttribute('src', item.url);
    }
    scene.appendChild(sky);
    sky.addEventListener(
      'materialtextureloaded',
      () => hideSpinner(),
      { once: true }
    );
  }
}

async function init() {
  MEDIA = await fetchMediaList();

  // popula dropdown
  MEDIA.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text  = m.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () =>
    loadMedia(MEDIA[select.value])
  );

  // carrega a primeira mídia
  await loadMedia(MEDIA[0]);

  // integra OrbitControls via component
  // apenas precisa do atributo orbit-controls no <a-entity camera>
}

init();

// VR handlers continuam exatamente iguais ao que já estava,
// mas removi a parte de drag manual, pois agora tudo é feito pelo OrbitControls.
