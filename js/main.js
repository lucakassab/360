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
  document.querySelectorAll('.dyn-media').forEach(el=>el.remove());

  if (/\.(mp4|webm)$/i.test(item.url)) {
    const vid = document.createElement('video');
    vid.id = 'vid'; vid.src = item.url; vid.loop = true;
    vid.setAttribute('playsinline',''); await vid.play();
    assets.appendChild(vid);

    const vs = document.createElement('a-videosphere');
    vs.classList.add('dyn-media');
    vs.setAttribute('src','#vid');
    vs.setAttribute('look-controls','enabled:false');
    if (!mono) vs.setAttribute('material','shader: flat; side: back; src: #vid; repeat: 1 0.5; offset: 0 0.5');
    scene.appendChild(vs);
    hideSpinner();
  } else {
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls','enabled:false');
    if (!mono) {
      sky.setAttribute('material',`shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
    } else {
      sky.setAttribute('src',item.url);
    }
    scene.appendChild(sky);
    sky.addEventListener('materialtextureloaded', hideSpinner, { once:true });
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
      const dx=e.clientX-lastX, dy=e.clientY-lastY;
      yaw   -= dx*s; pitch -= dy*s;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      cameraObj.rotation.set(pitch,yaw,0);
      lastX=e.clientX; lastY=e.clientY;
    });
  });
}

window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  if (!isMono(item.url)) {
    document.querySelectorAll('.dyn-media').forEach(el=>el.remove());
    await import('../libs/aframe-stereo-component.js');
    ['left','right'].forEach(eye => {
      const sky = document.createElement('a-sky');
      sky.classList.add('dyn-media');
      sky.setAttribute('material',`shader: flat; side: back; src: ${item.url}`);
      sky.setAttribute('stereo',`eye:${eye}; split:vertical`);
      scene.appendChild(sky);
    });
  }
});

async function init() {
  MEDIA = await fetchMediaList();
  MEDIA.forEach((m,i)=>{
    const o = document.createElement('option');
    o.value=i; o.text=m.name; select.appendChild(o);
  });
  select.addEventListener('change',()=>loadMedia(MEDIA[select.value]));
  loadMedia(MEDIA[0]);
  enableDragOrbit();
}

init();
