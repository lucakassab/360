// js/main.js
const spinner = document.getElementById('spinner');
const select  = document.getElementById('sceneSelect');
const scene   = document.querySelector('a-scene');
const assets  = document.querySelector('a-assets');
let MEDIA = [];

function isMono(url) {
  return /_Mono(\.[a-z0-9]+)$/i.test(url);
}

function showSpinner()  { spinner.style.display = 'block'; }
function hideSpinner()  { spinner.style.display = 'none'; }

async function fetchMediaList() {
  const resp = await fetch('https://api.github.com/repos/lucakassab/360/contents/media');
  const json = await resp.json();
  MEDIA = json
    .filter(e => e.type === 'file')
    .map(e => ({ name: e.name, url: `media/${e.name}` }));
  MEDIA.forEach((m,i) => {
    const o = document.createElement('option');
    o.value = i; o.text = m.name;
    select.appendChild(o);
  });
}

async function loadMedia(item) {
  showSpinner();
  const mono = isMono(item.url);
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (/\.(mp4|webm)$/i.test(item.url)) {
    // Vídeo 360 mono estereoscópico
    const vid = document.createElement('video');
    vid.id = 'vid'; vid.src = item.url; vid.crossOrigin = 'anonymous';
    vid.loop = true; vid.setAttribute('playsinline','');
    await vid.play();
    assets.appendChild(vid);

    const vs = document.createElement('a-videosphere');
    vs.classList.add('dyn-media');
    vs.setAttribute('src','#vid');
    vs.setAttribute('look-controls','enabled:false');
    if (!mono) {
      vs.setAttribute('material','shader: flat; side: back; src: #vid; repeat: 1 0.5; offset: 0 0.5');
    }
    scene.appendChild(vs);
    hideSpinner();

  } else {
    // Imagem estática 360
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls','enabled:false');
    if (mono) sky.setAttribute('src', item.url);
    else      sky.setAttribute('material', `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', hideSpinner, { once: true });
  }
}

function enableDragOrbit() {
  scene.addEventListener('loaded', () => {
    const camObj = scene.querySelector('[camera]').object3D;
    let down=false, lx=0, ly=0, yaw=0, pitch=0;
    const cnv = scene.canvas, s=0.005;
    cnv.style.touchAction = 'none';
    cnv.addEventListener('pointerdown', e => { down=true; lx=e.clientX; ly=e.clientY; });
    cnv.addEventListener('pointerup',   ()=>down=false);
    cnv.addEventListener('pointerleave',()=>down=false);
    cnv.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      yaw   -= dx * s;
      pitch -= dy * s;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      camObj.rotation.set(pitch, yaw, 0);
      lx = e.clientX; ly = e.clientY;
    });
  });
}

window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  if (!isMono(item.url)) {
    // Remove vista mono/top-crop
    document.querySelectorAll('.dyn-media').forEach(el => el.remove());
    // Carrega o plugin
    await import('../libs/aframe-stereo-component.js');
    // Cria duas esferas: uma pra cada olho, dividindo o top-bottom corretamente
    ['left','right'].forEach(eye => {
      const ent = document.createElement('a-entity');
      ent.classList.add('dyn-media');
      ent.setAttribute('geometry', `
        primitive: sphere;
        radius: 100;
        segmentsWidth: 64;
        segmentsHeight: 64
      `);
      ent.setAttribute('scale','-1 1 1');
      ent.setAttribute('material', `shader: flat; src: ${item.url}; side: back`);
      // split: vertical força a divisão top-bottom para cada olho :contentReference[oaicite:0]{index=0}
      ent.setAttribute('stereo', `eye:${eye}; split: vertical`);
      scene.appendChild(ent);
    });
  }
});

(async function init(){
  await fetchMediaList();
  select.addEventListener('change', ()=> loadMedia(MEDIA[select.value]));
  loadMedia(MEDIA[0]);
  enableDragOrbit();
})();
