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
    const vid = document.createElement('video');
    vid.id = 'vid'; vid.src = item.url; vid.crossOrigin = 'anonymous';
    vid.loop = true; vid.setAttribute('playsinline', '');
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
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls', 'enabled: false');
    if (!mono) {
      sky.setAttribute('material', `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
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

    let isDown = false;
    let lastX = 0, lastY = 0;
    let yaw = 0, pitch = 0;
    const sens = 0.005;
    const canvas = scene.canvas;
    canvas.style.touchAction = 'none';

    function start(x, y) {
      isDown = true;
      lastX = x;
      lastY = y;
    }
    function move(x, y) {
      if (!isDown) return;
      const dx = x - lastX;
      const dy = y - lastY;
      yaw   -= dx * sens;
      pitch -= dy * sens;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      cameraObj.rotation.set(pitch, yaw, 0);
      lastX = x;
      lastY = y;
    }
    function end() {
      isDown = false;
    }

    // Desktop: mouse events
    canvas.addEventListener('mousedown', e => start(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', e => {
      if (e.buttons) move(e.clientX, e.clientY);
    });
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);

    // Mobile: touch events
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      const t = e.touches[0];
      move(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      end();
      e.preventDefault();
    }, { passive: false });
  });
}

window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  const mono = isMono(item.url);
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (!mono) {
    if (/\.(mp4|webm)$/i.test(item.url)) {
      await import('../libs/aframe-stereo-component.js');
      const vid2 = document.createElement('video');
      vid2.id = 'vidStereo'; vid2.src = item.url; vid2.crossOrigin = 'anonymous';
      vid2.loop = true; vid2.setAttribute('playsinline', '');
      await vid2.play();
      assets.appendChild(vid2);

      const geom = 'primitive: sphere; radius: 100; segmentsWidth: 64; segmentsHeight: 64;';
      const mat  = 'shader: flat; side: back; src: #vidStereo;';
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
      await import('../libs/aframe-stereo-component.js');
      ['left','right'].forEach(eye => {
        const sky = document.createElement('a-sky');
        sky.classList.add('dyn-media');
        const offY = eye === 'left' ? 0.5 : 0;
        sky.setAttribute('material',
          `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 ${offY}`
        );
        sky.setAttribute('stereo', `eye:${eye}`);
        scene.appendChild(sky);
      });
    }
  } else {
    await loadMedia(item);
  }
});

window.addEventListener('exit-vr', async () => {
  const item = MEDIA[select.value];
  await loadMedia(item);
});

async function init() {
  MEDIA = await fetchMediaList();
  MEDIA.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text  = m.name;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => loadMedia(MEDIA[select.value]));
  loadMedia(MEDIA[0]);
  enableDragOrbit();
}

init();
