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

function ensureVrComponentsRegistered() {
  if (!window.AFRAME) {
    return;
  }

  if (!window.AFRAME.components["vr-eye-layer"]) {
    window.AFRAME.registerComponent("vr-eye-layer", {
      schema: {
        eye: { default: "both" }, // both | left | right
      },

      init() {
        this.applyLayers = this.applyLayers.bind(this);
        this.onObject3DSet = this.onObject3DSet.bind(this);

        this.el.addEventListener("object3dset", this.onObject3DSet);
        this.applyLayers();
      },

      update() {
        this.applyLayers();
      },

      remove() {
        this.el.removeEventListener("object3dset", this.onObject3DSet);
      },

      onObject3DSet() {
        this.applyLayers();
      },

      applyLayers() {
        const eye = String(this.data.eye || "both").toLowerCase();
        const root = this.el.object3D;

        if (!root) {
          return;
        }

        root.traverse((obj) => {
          obj.layers.disableAll();

          if (eye === "left") {
            obj.layers.enable(1);
            return;
          }

          if (eye === "right") {
            obj.layers.enable(2);
            return;
          }

          obj.layers.enable(0);
        });
      },
    });
  }
}

function ensureVrCameraLayers(sceneEl) {
  const camera = sceneEl?.camera;

  if (!camera) {
    return;
  }

  camera.layers.enable(0);
  camera.layers.enable(1);
  camera.layers.enable(2);

  if (Array.isArray(camera.cameras)) {
    camera.cameras.forEach((subCamera) => {
      subCamera.layers.enable(0);
      subCamera.layers.enable(1);
      subCamera.layers.enable(2);
    });
  }
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

function createPanoramaEntity(src, eye = "both") {
  const el = document.createElement("a-entity");

  el.setAttribute("geometry", {
    primitive: "sphere",
    radius: 64,
    segmentsWidth: 80,
    segmentsHeight: 64,
  });

  el.setAttribute("material", {
    shader: "flat",
    side: "back",
    src,
    npot: true,
    transparent: false,
  });

  el.setAttribute("vr-eye-layer", { eye });

  return el;
}

function getEyeCrop(stereoFormat, invertStereo, eye) {
  if (stereoFormat === "top-bottom") {
    const topBelongsToLeft = !invertStereo;
    const useTopHalf = eye === "left" ? topBelongsToLeft : !topBelongsToLeft;

    return {
      repeatX: 1,
      repeatY: 0.5,
      offsetX: 0,
      offsetY: useTopHalf ? 0.5 : 0,
    };
  }

  if (stereoFormat === "left-right") {
    const leftHalfBelongsToLeft = !invertStereo;
    const useLeftHalf = eye === "left" ? leftHalfBelongsToLeft : !leftHalfBelongsToLeft;

    return {
      repeatX: 0.5,
      repeatY: 1,
      offsetX: useLeftHalf ? 0 : 0.5,
      offsetY: 0,
    };
  }

  return {
    repeatX: 1,
    repeatY: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

function applyPanoramaTransform(entity, crop) {
  const mesh = entity.getObject3D("mesh");
  const material = Array.isArray(mesh?.material) ? mesh.material[0] : mesh?.material;
  const texture = material?.map;

  if (!texture) {
    return;
  }

  setTextureColorSpace(texture);

  texture.repeat.set(crop.repeatX, crop.repeatY);
  texture.offset.set(crop.offsetX, crop.offsetY);
  texture.needsUpdate = true;

  material.needsUpdate = true;

  entity.object3D.scale.set(-1, 1, 1);
  entity.object3D.rotation.set(
    0,
    THREE.MathUtils.degToRad(BASE_PANORAMA_YAW_CORRECTION_DEG),
    0
  );
}

async function appendStereoEye({
  panoramaRoot,
  panoramaSrc,
  stereoFormat,
  invertStereo,
  eye,
}) {
  const entity = createPanoramaEntity(panoramaSrc, eye);
  panoramaRoot.appendChild(entity);

  await waitForMaterialTexture(entity);

  const crop = getEyeCrop(stereoFormat, invertStereo, eye);
  applyPanoramaTransform(entity, crop);
}

async function appendMonoPanorama({
  panoramaRoot,
  panoramaSrc,
}) {
  const entity = createPanoramaEntity(panoramaSrc, "both");
  panoramaRoot.appendChild(entity);

  await waitForMaterialTexture(entity);
  applyPanoramaTransform(entity, {
    repeatX: 1,
    repeatY: 1,
    offsetX: 0,
    offsetY: 0,
  });
}

export async function renderVrScene({
  sceneEl,
  sceneData,
  tourData,
  tourPath,
}) {
  ensureVrComponentsRegistered();
  ensureVrCameraLayers(sceneEl);

  const panoramaRoot = sceneEl.querySelector("#panorama-root");

  if (!panoramaRoot) {
    throw new Error('Elemento "#panorama-root" não foi encontrado.');
  }

  clearChildren(panoramaRoot);

  const panoramaSrc = resolveAssetPath(tourData, tourPath, sceneData.image360);

  if (!panoramaSrc) {
    throw new Error(`A cena "${sceneData.id}" não possui "image360" válida.`);
  }

  const stereoFormat = String(sceneData.stereoFormat || "").toLowerCase();
  const isStereo = stereoFormat === "top-bottom" || stereoFormat === "left-right";

  if (!isStereo) {
    await appendMonoPanorama({
      panoramaRoot,
      panoramaSrc,
    });
    return;
  }

  await Promise.all([
    appendStereoEye({
      panoramaRoot,
      panoramaSrc,
      stereoFormat,
      invertStereo: Boolean(sceneData.invertStereo),
      eye: "left",
    }),
    appendStereoEye({
      panoramaRoot,
      panoramaSrc,
      stereoFormat,
      invertStereo: Boolean(sceneData.invertStereo),
      eye: "right",
    }),
  ]);
}