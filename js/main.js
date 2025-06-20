// js/main.js
import { OrbitControls } from '../libs/OrbitControls.js';

// 1) Component A-Frame para OrbitControls
AFRAME.registerComponent('orbit-controls', {
  init: function () {
    const sceneEl  = this.el.sceneEl;
    const threeCam = this.el.getObject3D('camera');
    this.controls = new OrbitControls(threeCam, sceneEl.renderer.domElement);
    this.controls.enableZoom      = false;
    this.controls.enablePan       = false;
    this.controls.minPolarAngle   = 0;
    this.controls.maxPolarAngle   = Math.PI;
  },
  tick: function () {
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
  const resp = await fetch('https://api.github.com/repos/lucakassab/360/contents/media');
  const json = await resp.json();
  return json
    .filter(e => e.type === 'file')
    .map(e => ({ name: e.name, url: `media/${e.name}` }));
}

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (/\.(mp4|webm)$/i.test(item.url)) {
    // Vídeo
    const vid = document.createElement('video');
    vid.id = 'vid'; vid.src = item.url; vid.crossOrigin = 'anonymous';
    vid.loop = true; vid.setAttribute('playsinline', '');
    await vid.play();
    assets.appendChild(vid);

    const vs = document.createElement('a-videosphere');
    vs.classList.add('dyn-media');
    vs.setAttribute('src', '#vid');
    vs.setAttribute('look-controls', 'enabled: false');
    if (!mono) vs.setAttribute('material','shader: flat; side: back; src: #vid; repeat:1 0.5; offset:0 0.5');
    scene.appendChild(vs);
    hideSpinner();
  } else {
    // Imagem
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls', 'enabled: false');
    if (!mono) {
      sky.setAttribute('material', `shader: flat; side: back; src: ${item.url}; repeat:1 0.5; offset:0 0.5`);
    } else {
      sky.setAttribute('src', item.url);
    }
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', () => hideSpinner(), { once: true });
  }
}

// 2) Handlers de VR
window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  const mono = isMono(item.url);
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (!mono) {
    await import('../libs/aframe-stereo-component.js');
    if (/\.(mp4|webm)$/i.test(item.url)) {
      // Vídeo estéreo em VR
      const vid2 = document.createElement('video');
      vid2.id = 'vidStereo'; vid2.src = item.url; vid2.crossOrigin = 'anonymous';
      vid2.loop = true; vid2.setAttribute('playsinline','');
      await vid2.play();
      assets.appendChild(vid2);
      const geom = 'primitive: sphere; radius:100; segmentsWidth:64; segmentsHeight:64;';
      const mat  = 'shader: flat; side: back; src: #vidStereo;';
      ['left','right'].forEach(eye => {
        const ent = document.createElement('a-entity');
        ent.classList.add('dyn-media');
        ent.setAttribute('geometry', geom);
        ent.setAttribute('material', mat);
        ent.setAttribute('scale', '-1 1 1');
        ent.setAttribute('stereo', `eye:${eye}; split: vertical`);
        scene.appendChild(ent);
      });
    } else {
      // Imagem estéreo em VR
      ['left','right'].forEach(eye => {
        const sky = document.createElement('a-sky');
        sky.classList.add('dyn-media');
        const offY = eye === 'left' ? 0.5 : 0;
        sky.setAttribute('material',
          `shader: flat; side: back; src: ${item.url}; repeat:1 0.5; offset:0 ${offY}`
        );
        sky.setAttribute('stereo', `eye:${eye}`);
        scene.appendChild(sky);
      });
    }
  } else {
    // Volta ao mono
    await loadMedia(item);
  }
});

window.addEventListener('exit-vr', async () => {
  const item = MEDIA[select.value];
  await loadMedia(item);
});

async function init() {
  MEDIA = await fetchMediaList();
  MEDIA.forEach((m,i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.text = m.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => loadMedia(MEDIA[select.value]));
  await loadMedia(MEDIA[0]);
  // OrbitControls via <a-entity orbit-controls> já registrado lá no index.html
}

init();
