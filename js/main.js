// js/main.js

window.addEventListener('DOMContentLoaded', () => {
  const SCENE = document.querySelector('#scene');
  const mediaNameEl = document.querySelector('#mediaName');
  const prevBtn = document.querySelector('#prevBtn');
  const nextBtn = document.querySelector('#nextBtn');

  if (!SCENE || !mediaNameEl || !prevBtn || !nextBtn) {
    console.error('[main.js] Não encontrei os elementos do DOM (verifica os IDs).');
    return;
  }

  let mediaList = [];
  let currentIndex = 0;
  let currentEntity = null;

  fetch('./load_media_list.json')
    .then(res => {
      if (!res.ok) throw new Error('Não consegui carregar o JSON das mídias');
      return res.json();
    })
    .then(json => {
      mediaList = json;
      if (!mediaList.length) {
        mediaNameEl.textContent = 'JSON vazio. Sem mídia pra exibir.';
        return;
      }
      loadMedia(0);
    })
    .catch(err => {
      console.error('[main.js] Erro ao buscar JSON:', err);
      mediaNameEl.textContent = 'Erro ao carregar mídias';
    });

  function loadMedia(idx) {
    if (!mediaNameEl) return; // evita o null
    if (currentEntity) {
      SCENE.removeChild(currentEntity);
      currentEntity = null;
    }

    currentIndex = idx;
    const item = mediaList[currentIndex];
    mediaNameEl.textContent = item.name;

    const url = item.url;
    const lower = url.toLowerCase();
    const isVideo = lower.match(/\.(mp4|webm|ogg)$/);
    const isStereoImage = !isVideo && (lower.includes('stereo') || item.name.toLowerCase().includes('stereo'));
    const isMonoImage = !isVideo && !isStereoImage && lower.match(/\.(jpg|jpeg|png)$/);

    if (isVideo) {
      loadVideoSphere(url);
    } else if (isStereoImage) {
      loadStereoImage(url);
    } else if (isMonoImage) {
      loadMonoImage(url);
    } else {
      console.warn('[main.js] Formato da mídia não reconhecido:', url);
      mediaNameEl.textContent = 'Formato não suportado';
    }
  }

  function loadMonoImage(src) {
    const sky = document.createElement('a-sky');
    sky.setAttribute('src', src);
    sky.setAttribute('rotation', '0 -130 0');
    currentEntity = sky;
    SCENE.appendChild(sky);
  }

  function loadStereoImage(src) {
    const sphereL = document.createElement('a-entity');
    sphereL.setAttribute('geometry', 'primitive: sphere; radius: 5000;');
    sphereL.setAttribute('material', 'shader: flat; side: back; src: ' + src);
    sphereL.setAttribute('stereo', 'eye: left;');

    const sphereR = document.createElement('a-entity');
    sphereR.setAttribute('geometry', 'primitive: sphere; radius: 5000;');
    sphereR.setAttribute('material', 'shader: flat; side: back; src: ' + src);
    sphereR.setAttribute('stereo', 'eye: right;');

    const container = document.createElement('a-entity');
    container.appendChild(sphereL);
    container.appendChild(sphereR);
    currentEntity = container;
    SCENE.appendChild(container);
  }

  function loadVideoSphere(src) {
    let assets = document.querySelector('a-assets');
    if (!assets) {
      assets = document.createElement('a-assets');
      SCENE.appendChild(assets);
    }

    const oldVideo = assets.querySelector('video[id="dynVideo"]');
    if (oldVideo) assets.removeChild(oldVideo);

    const video = document.createElement('video');
    video.setAttribute('id', 'dynVideo');
    video.setAttribute('src', src);
    video.setAttribute('crossorigin', 'anonymous');
    video.setAttribute('loop', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    assets.appendChild(video);

    const sphere = document.createElement('a-videosphere');
    sphere.setAttribute('src', '#dynVideo');
    sphere.setAttribute('rotation', '0 -130 0');
    currentEntity = sphere;
    SCENE.appendChild(sphere);

    video.play().catch(e => {
      console.warn('[main.js] Erro ao dar play no vídeo:', e);
    });
  }

  prevBtn.addEventListener('click', () => {
    const prev = (currentIndex - 1 + mediaList.length) % mediaList.length;
    loadMedia(prev);
  });
  nextBtn.addEventListener('click', () => {
    const next = (currentIndex + 1) % mediaList.length;
    loadMedia(next);
  });
});
