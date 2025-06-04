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

  // 1) Carrega o JSON com fetch()
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

  // 2) Função para carregar mídia por índice
  function loadMedia(idx) {
    // Remove entidade anterior (se existir)
    if (currentEntity) {
      SCENE.removeChild(currentEntity);
      currentEntity = null;
    }

    currentIndex = idx;
    const item = mediaList[currentIndex];
    mediaNameEl.textContent = item.name;

    const url = item.url;
    const lower = url.toLowerCase();

    // Detecta se é vídeo: mp4, webm, ogg
    const isVideo = lower.match(/\.(mp4|webm|ogg)$/);
    // Detecta imagem estéreo 360: nome ou URL contiver “stereo”
    const isStereoImage = !isVideo && (lower.includes('stereo') || item.name.toLowerCase().includes('stereo'));
    // Caso contrário, assume imagem mono (jpg, jpeg, png)
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

  // 2.1) Carrega imagem mono 360°
  function loadMonoImage(src) {
    const sky = document.createElement('a-sky');
    sky.setAttribute('src', src);
    sky.setAttribute('rotation', '0 -130 0');
    currentEntity = sky;
    SCENE.appendChild(sky);
  }

  // 2.2) Carrega imagem estéreo 360°
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

  // 2.3) Carrega vídeo 360° (esperando carregar antes de criar a sphere)
  function loadVideoSphere(src) {
    // Remove entidade anterior (pra garantir)
    if (currentEntity) {
      SCENE.removeChild(currentEntity);
      currentEntity = null;
    }

    // Garante que exista <a-assets> no <a-scene>
    let assets = document.querySelector('a-assets');
    if (!assets) {
      assets = document.createElement('a-assets');
      SCENE.appendChild(assets);
    }

    // Remove vídeo antigo se existir
    const oldVideo = assets.querySelector('video[id="dynVideo"]');
    if (oldVideo) {
      // Pause antes de remover (segurança)
      oldVideo.pause();
      assets.removeChild(oldVideo);
    }

    // Cria o novo <video>
    const video = document.createElement('video');
    video.setAttribute('id', 'dynVideo');
    video.setAttribute('crossorigin', 'anonymous');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');  // necessário pra mobile sem fullscreen forçado
    video.setAttribute('preload', 'auto');  // tenta pré-carregar
    // Coloca o listener ANTES de setar o src e chamar load()
    video.addEventListener('loadeddata', () => {
      // Só cria o <a-videosphere> depois que o vídeo tiver carregado algum frame
      const sphere = document.createElement('a-videosphere');
      sphere.setAttribute('src', '#dynVideo');
      sphere.setAttribute('rotation', '0 -130 0');
      currentEntity = sphere;
      SCENE.appendChild(sphere);
      // Toca o vídeo
      video.play().catch(e => {
        console.warn('[main.js] Erro ao dar play no vídeo:', e);
      });
    });
    video.addEventListener('error', e => {
      console.error('[main.js] Erro ao carregar o vídeo:', e);
      mediaNameEl.textContent = 'Falha ao carregar vídeo.';
    });

    // Agora sim seta a URL e carrega
    video.setAttribute('src', src);
    assets.appendChild(video);
    video.load();
  }

  // 3) Botões anterior/próxima
  prevBtn.addEventListener('click', () => {
    const prev = (currentIndex - 1 + mediaList.length) % mediaList.length;
    loadMedia(prev);
  });
  nextBtn.addEventListener('click', () => {
    const next = (currentIndex + 1) % mediaList.length;
    loadMedia(next);
  });
});
