// js/main.js

window.addEventListener('DOMContentLoaded', () => {
  const SCENE_EL = document.querySelector('#scene');
  const mediaNameEl = document.querySelector('#mediaName');
  const prevBtn = document.querySelector('#prevBtn');
  const nextBtn = document.querySelector('#nextBtn');

  if (!SCENE_EL || !mediaNameEl || !prevBtn || !nextBtn) {
    console.error('[main.js] Não encontrei os elementos do DOM (verifica os IDs).');
    return;
  }

  let mediaList = [];
  let currentIndex = 0;
  let currentEntity = null;

  // Espera o A-Frame completar o carregamento
  SCENE_EL.addEventListener('loaded', () => {
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
  });

  function loadMedia(idx) {
    if (currentEntity) {
      SCENE_EL.removeChild(currentEntity);
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
      console.warn('[main.js] Formato da mídia não suportado:', url);
      mediaNameEl.textContent = 'Formato não suportado';
    }
  }

  function loadMonoImage(src) {
    const sky = document.createElement('a-sky');
    sky.setAttribute('src', src);
    sky.setAttribute('rotation', '0 -130 0');
    currentEntity = sky;
    SCENE_EL.appendChild(sky);
  }

  // <<<-----------------------------------------------------------------------------
// Antes: havia um fallback preto se não estivesse em VR
// Agora: sempre criamos 1 esfera com eye:both para mostrar a imagem stereo side-by-side
  function loadStereoImage(src) {
    const sphere = document.createElement('a-entity');
    sphere.setAttribute('geometry', 'primitive: sphere; radius: 5000;');
    sphere.setAttribute('material', 'shader: flat; side: back; src: ' + src);
    sphere.setAttribute('stereo', 'eye: both;'); // mostra os dois olhos na mesma esfera
    currentEntity = sphere;
    SCENE_EL.appendChild(sphere);
  }
// <<<-----------------------------------------------------------------------------

  function loadVideoSphere(src) {
    if (currentEntity) {
      SCENE_EL.removeChild(currentEntity);
      currentEntity = null;
    }

    let assets = document.querySelector('a-assets');
    if (!assets) {
      assets = document.createElement('a-assets');
      SCENE_EL.appendChild(assets);
    }

    assets.querySelectorAll('video[data-dyn]').forEach(v => {
      v.pause();
      assets.removeChild(v);
    });

    const vidId = `dynVideo_${Date.now()}`;
    const video = document.createElement('video');
    video.setAttribute('id', vidId);
    video.setAttribute('data-dyn', 'true');
    video.setAttribute('crossorigin', 'anonymous');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.src = src;
    assets.appendChild(video);

    function createSphereAndPlay() {
      video.currentTime = 0;
      const sphere = document.createElement('a-videosphere');
      sphere.setAttribute('src', `#${vidId}`);
      sphere.setAttribute('rotation', '0 -130 0');
      currentEntity = sphere;
      SCENE_EL.appendChild(sphere);
      video.play().catch(e => {
        console.warn('[main.js] play() bloqueado:', e);
      });
    }

    video.addEventListener('loadeddata', () => {
      createSphereAndPlay();
    });
    video.addEventListener('error', e => {
      console.error('[main.js] Erro ao carregar vídeo:', e);
      mediaNameEl.textContent = 'Falha ao carregar vídeo.';
    });

    video.load();
    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      createSphereAndPlay();
    }
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
