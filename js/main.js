// js/main.js
const spinner = document.getElementById('spinner');
const select  = document.getElementById('sceneSelect');
const scene   = document.querySelector('a-scene');
const assets  = document.querySelector('a-assets');
let cameraObj, MEDIA = [];

function isMono(url) {
  return /_Mono(\.[a-z0-9]+)$/i.test(url);
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
  return json
    .filter(e => e.type === 'file')
    .map(e => ({ name: e.name, url: `media/${e.name}` }));
}

async function loadMedia(item) {
  console.debug('[loadMedia] Carregando:', item);
  showSpinner();
  const mono = isMono(item.url);
  // limpa qualquer mídia anterior
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (/\.(mp4|webm)$/i.test(item.url)) {
    console.debug('[loadMedia] Tipo: vídeo');
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
    console.debug('[loadMedia] Tipo: imagem');
    const sky = document.createElement('a-sky');
    sky.classList.add('dyn-media');
    sky.setAttribute('look-controls', 'enabled: false');
    if (!mono) {
      sky.setAttribute('material', `shader: flat; side: back; src: ${item.url}; repeat: 1 0.5; offset: 0 0.5`);
    } else {
      sky.setAttribute('src', item.url);
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
    const cnv = scene.canvas;
    const sens = 0.005;
    cnv.style.touchAction = 'none';

    cnv.addEventListener('pointerdown', e => {
      isDown = true;
      lastX = e.clientX; lastY = e.clientY;
    });
    cnv.addEventListener('pointerup',   () => { isDown = false; });
    cnv.addEventListener('pointerleave',() => { isDown = false; });

    cnv.addEventListener('pointermove', e => {
      if (!isDown) return;
      yaw   -= (e.clientX - lastX) * sens;
      pitch -= (e.clientY - lastY) * sens;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
      cameraObj.rotation.set(pitch, yaw, 0);
      lastX = e.clientX; lastY = e.clientY;
    });
  });
}

window.addEventListener('enter-vr', async () => {
  const item = MEDIA[select.value];
  const mono = isMono(item.url);
  console.debug('[VR] Entrando em VR:', item);

  // sempre limpa tudo
  document.querySelectorAll('.dyn-media').forEach(el => el.remove());

  if (!mono) {
    if (/\.(mp4|webm)$/i.test(item.url)) {
      // vídeo estéreo em VR
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
      // imagem estéreo em VR
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
    // volta a cena mono/normal
    await loadMedia(item);
  }
});

// **NOVA LOGIC**: ao sair do VR, recarrega modo normal
window.addEventListener('exit-vr', async () => {
  console.debug('[VR] Saindo do VR, recarregando mídia normal');
  const item = MEDIA[select.value];
  await loadMedia(item);
});

async function init() {
  console.debug('[Init] Inicializando aplicação');
  MEDIA = await fetchMediaList();

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

  loadMedia(MEDIA[0]);
  enableDragOrbit();
}

init();
