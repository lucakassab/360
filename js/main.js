// js/main.js
const spinner = document.getElementById('spinner');
const select  = document.getElementById('sceneSelect');
const scene   = document.querySelector('a-scene');
const assets  = document.querySelector('a-assets');
let cameraObj, MEDIA = [];

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
    // vídeo mono ou estéreo fora do VR
    const vid = document.createElement('video');
    vid.id = 'vid'; vid.src = item.url; vid.crossOrigin = 'anonymous';
    vid.loop = true; vid.setAttribute('playsinline','');
    await vid.play();
    assets.appendChild(vid);

    const vs = document.createElement('a-videosphere');
    vs.classList.add('dyn-media');
    vs.setAttribute('src','#vid');
    vs.setAttribute('look-controls','enabled: false');
    if (!mono) {
      // mostra só metade superior fora do VR
      vs.setAttribute('material','shader: flat; side: back; src: #vid; repeat: 1 0.5; offset: 0 0.5');
    }
    scene.appendChild(vs);
    hideSpinner();

  } else {
    // imagem mono ou estéreo fora do VR
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls','enabled: false');
    if (!mono) {
      // mostra só metade superior fora do VR
      sky.setAttribute('material',`shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
    } else {
      sky.setAttribute('src', item.url);
    }
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', hideSpinner, { once: true });
  }
}

function enableDragOrbit() {
  scene.addEventListener('loaded', () => {
    const camEl = scene.querySelector('[camera]');
    cameraObj = camEl.object3D;
    let isDown=false, lastX=0, lastY=0, yaw=0, pitch=0;
    const cnv = scene.canvas, s=0.005;
    cnv.style.touchAction='none';
    cnv.addEventListener('pointerdown', e=>{isDown=true; lastX=e.clientX; lastY=e.clientY;});
    cnv.addEventListener('pointerup',   ()=>{isDown=false;});
    cnv.addEventListener('pointerleave',()=>{isDown=false;});
    cnv.addEventListener('pointermove', e=>{
      if(!isDown) return;
      yaw   -= (e.clientX-lastX)*s;
      pitch -= (e.clientY-lastY)*s;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      cameraObj.rotation.set(pitch, yaw, 0);
      lastX = e.clientX; lastY = e.clientY;
    });
  });
}

window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  const mono = isMono(item.url);
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (!mono) {
    if (/\.(mp4|webm)$/i.test(item.url)) {
      // vídeo estéreo em VR: use esfera custom com plugin
      await import('../libs/aframe-stereo-component.js');
      // cria elemento de vídeo separado
      const vid2 = document.createElement('video');
      vid2.id = 'vidStereo';
      vid2.src = item.url;
      vid2.crossOrigin = 'anonymous';
      vid2.loop = true;
      vid2.setAttribute('playsinline','');
      await vid2.play();
      assets.appendChild(vid2);

      // parâmetros da esfera
      const geom = 'primitive: sphere; radius: 100; segmentsWidth: 64; segmentsHeight: 64;';
      const mat  = 'shader: flat; src: #vidStereo; side: back;';
      const scl  = '-1 1 1';

      ['left','right'].forEach(eye => {
        const ent = document.createElement('a-entity');
        ent.classList.add('dyn-media');
        ent.setAttribute('geometry', geom);
        ent.setAttribute('material', mat);
        ent.setAttribute('scale', scl);
        ent.setAttribute('stereo', `eye:${eye}; split: vertical`);
        scene.appendChild(ent);
      });

    } else {
      // imagem estéreo em VR: crop manual + plugin só pra filtrar olho
      await import('../libs/aframe-stereo-component.js');
      ['left','right'].forEach(eye => {
        const sky = document.createElement('a-sky');
        sky.classList.add('dyn-media');
        // top half pra left, bottom half pra right
        const offY = eye === 'left' ? 0.5 : 0;
        sky.setAttribute('material',
          `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 ${offY}`
        );
        sky.setAttribute('stereo', `eye:${eye}`);
        scene.appendChild(sky);
      });
    }
  } else {
    // se for mono, só carrega a cena normal
    loadMedia(item);
  }
});

async function init() {
  MEDIA = await fetchMediaList();
  MEDIA.forEach((m,i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.text = m.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => loadMedia(MEDIA[select.value]));
  loadMedia(MEDIA[0]);
  enableDragOrbit();
}

init();
