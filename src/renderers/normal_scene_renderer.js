import { resolveAssetPath } from "../tour_loader.js";

const THREE = window.AFRAME?.THREE;
const BASE_PANORAMA_YAW_CORRECTION_DEG = 270;

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function setTextureColorSpace(texture) {
  if (!THREE || !texture) {
    return;
  }

  if ("colorSpace" in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else if ("encoding" in texture && THREE.sRGBEncoding) {
    texture.encoding = THREE.sRGBEncoding;
  }
}

function getNonVrCrop(stereoFormat, invertStereo) {
  switch (stereoFormat) {
    case "top-bottom":
      return invertStereo
        ? { repeatX: 1, repeatY: 0.5, offsetX: 0, offsetY: 0 }
        : { repeatX: 1, repeatY: 0.5, offsetX: 0, offsetY: 0.5 };

    case "left-right":
      return invertStereo
        ? { repeatX: 0.5, repeatY: 1, offsetX: 0.5, offsetY: 0 }
        : { repeatX: 0.5, repeatY: 1, offsetX: 0, offsetY: 0 };

    default:
      return { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 };
  }
}

function getFinalPanoramaYawDeg(panoramaYawOffsetDeg = 0) {
  return BASE_PANORAMA_YAW_CORRECTION_DEG + Number(panoramaYawOffsetDeg || 0);
}

function setPanoramaYawOnEntity(entity, panoramaYawOffsetDeg = 0) {
  if (!entity?.object3D) {
    return;
  }

  const yawRad = (getFinalPanoramaYawDeg(panoramaYawOffsetDeg) * Math.PI) / 180;
  entity.object3D.rotation.set(0, yawRad, 0);
}

function waitForMaterialTexture(entity) {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      entity.removeEventListener("object3dset", onObject3DSet);
      entity.removeEventListener("materialtextureloaded", onTextureLoaded);

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(entity.getObject3D("mesh") || null);
    };

    const hasTexture = () => {
      const mesh = entity.getObject3D("mesh");
      const material = Array.isArray(mesh?.material)
        ? mesh.material[0]
        : mesh?.material;

      return Boolean(material?.map);
    };

    const tryFinish = () => {
      if (hasTexture()) {
        finish();
        return true;
      }

      return false;
    };

    const onObject3DSet = (event) => {
      if (event.detail?.type === "mesh") {
        window.requestAnimationFrame(() => {
          tryFinish();
        });
      }
    };

    const onTextureLoaded = () => {
      finish();
    };

    if (tryFinish()) {
      return;
    }

    entity.addEventListener("object3dset", onObject3DSet);
    entity.addEventListener("materialtextureloaded", onTextureLoaded);

    timeoutId = window.setTimeout(() => {
      finish();
    }, 4000);
  });
}

function applyPanoramaTransform(entity, sceneData, panoramaYawOffsetDeg = 0) {
  const mesh = entity.getObject3D("mesh");
  const material = Array.isArray(mesh?.material) ? mesh.material[0] : mesh?.material;
  const texture = material?.map;

  if (!texture) {
    return;
  }

  setTextureColorSpace(texture);

  const crop = getNonVrCrop(sceneData.stereoFormat, sceneData.invertStereo);

  texture.repeat.set(crop.repeatX, crop.repeatY);
  texture.offset.set(crop.offsetX, crop.offsetY);
  texture.needsUpdate = true;

  material.needsUpdate = true;

  entity.object3D.scale.set(-1, 1, 1);
  setPanoramaYawOnEntity(entity, panoramaYawOffsetDeg);
}

export function updateNormalScenePanoramaYaw({
  sceneEl,
  panoramaYawOffsetDeg = 0,
}) {
  const panoramaRoot = sceneEl?.querySelector?.("#panorama-root");

  if (!panoramaRoot) {
    return;
  }

  const panoramaEl = panoramaRoot.firstElementChild;

  if (!panoramaEl) {
    return;
  }

  setPanoramaYawOnEntity(panoramaEl, panoramaYawOffsetDeg);
}

export async function renderNormalScene({
  sceneEl,
  sceneData,
  tourData,
  tourPath,
  panoramaYawOffsetDeg = 0,
}) {
  const panoramaRoot = sceneEl.querySelector("#panorama-root");

  if (!panoramaRoot) {
    throw new Error('Elemento "#panorama-root" não foi encontrado.');
  }

  clearChildren(panoramaRoot);

  const panoramaSrc = resolveAssetPath(tourData, tourPath, sceneData.image360);

  if (!panoramaSrc) {
    throw new Error(`A cena "${sceneData.id}" não possui "image360" válida.`);
  }

  const panoramaEl = document.createElement("a-entity");
  panoramaEl.setAttribute("geometry", {
    primitive: "sphere",
    radius: 64,
    segmentsWidth: 80,
    segmentsHeight: 64,
  });

  panoramaEl.setAttribute("material", {
    shader: "flat",
    side: "back",
    src: panoramaSrc,
    npot: true,
    transparent: false,
  });

  panoramaRoot.appendChild(panoramaEl);

  await waitForMaterialTexture(panoramaEl);
  applyPanoramaTransform(panoramaEl, sceneData, panoramaYawOffsetDeg);
}