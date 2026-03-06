import { resolveAssetPath } from "../tour_loader.js";

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function num(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function vecToString(vec = {}) {
  return `${num(vec.x)} ${num(vec.y)} ${num(vec.z)}`;
}

function rotToString(rot = {}) {
  return `${num(rot.x)} ${num(rot.y)} ${num(rot.z)}`;
}

function sanitizeId(value = "") {
  return String(value).replace(/[^a-zA-Z0-9\-_:.]/g, "_");
}

function registerComponents() {
  if (!window.AFRAME) {
    return;
  }

  if (!window.AFRAME.components["tour-billboard-root"]) {
    const THREE = window.AFRAME.THREE;

    window.AFRAME.registerComponent("tour-billboard-root", {
      schema: {
        offsetX: { type: "number", default: 0 },
      },

      init() {
        this.cameraWorldPosition = new THREE.Vector3();
      },

      tick() {
        const camera = this.el.sceneEl?.camera;

        if (!camera) {
          return;
        }

        camera.getWorldPosition(this.cameraWorldPosition);
        this.el.object3D.lookAt(this.cameraWorldPosition);

        if (this.data.offsetX) {
          this.el.object3D.rotateX(THREE.MathUtils.degToRad(this.data.offsetX));
        }
      },
    });
  }

  if (!window.AFRAME.components["tour-label-world-billboard"]) {
    const THREE = window.AFRAME.THREE;

    window.AFRAME.registerComponent("tour-label-world-billboard", {
      init() {
        this.cameraWorldPosition = new THREE.Vector3();
        this.parentWorldPosition = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.parentQuat = new THREE.Quaternion();
        this.invParentQuat = new THREE.Quaternion();

        this.worldYawQuat = new THREE.Quaternion();
        this.yawEuler = new THREE.Euler(0, 0, 0, "YXZ");
      },

      tick() {
        const camera = this.el.sceneEl?.camera;
        const parent = this.el.object3D.parent;

        if (!camera || !parent) {
          return;
        }

        camera.getWorldPosition(this.cameraWorldPosition);
        parent.getWorldPosition(this.parentWorldPosition);

        this.direction
          .copy(this.cameraWorldPosition)
          .sub(this.parentWorldPosition);

        // Billboard em um único eixo: yaw
        this.direction.y = 0;

        if (this.direction.lengthSq() < 0.000001) {
          return;
        }

        this.direction.normalize();

        const yaw = Math.atan2(this.direction.x, this.direction.z);

        this.yawEuler.set(0, yaw, 0, "YXZ");
        this.worldYawQuat.setFromEuler(this.yawEuler);

        parent.getWorldQuaternion(this.parentQuat);
        this.invParentQuat.copy(this.parentQuat).invert();

        this.el.object3D.quaternion
          .copy(this.invParentQuat)
          .multiply(this.worldYawQuat);

        // trava qualquer resíduo de pitch/roll
        this.el.object3D.rotation.x = 0;
        this.el.object3D.rotation.z = 0;
      },
    });
  }
}

function patchMeshMaterials(entityEl, patchFn) {
  const applyPatch = () => {
    const mesh = entityEl.getObject3D("mesh");
    if (!mesh) {
      return;
    }

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    for (const material of materials) {
      if (!material) {
        continue;
      }

      patchFn(material);
      material.needsUpdate = true;
    }
  };

  entityEl.addEventListener("object3dset", (event) => {
    if (event.detail?.type === "mesh") {
      applyPatch();
    }
  });

  entityEl.addEventListener("materialtextureloaded", () => {
    applyPatch();
  });

  requestAnimationFrame(() => {
    applyPatch();
  });
}

function makeVisualMaterialDoubleSided(entityEl) {
  patchMeshMaterials(entityEl, (material) => {
    const THREE = window.AFRAME?.THREE;

    if (THREE?.DoubleSide !== undefined) {
      material.side = THREE.DoubleSide;
    }

    material.transparent = true;

    if ("depthWrite" in material) {
      material.depthWrite = false;
    }
  });
}

function makeInvisibleColliderNonBlocking(entityEl) {
  patchMeshMaterials(entityEl, (material) => {
    const THREE = window.AFRAME?.THREE;

    if (THREE?.DoubleSide !== undefined) {
      material.side = THREE.DoubleSide;
    }

    material.transparent = true;
    material.opacity = 0;

    if ("depthWrite" in material) {
      material.depthWrite = false;
    }

    if ("depthTest" in material) {
      material.depthTest = false;
    }

    if ("colorWrite" in material) {
      material.colorWrite = false;
    }
  });
}

function createDefaultIcon(iconSize) {
  const wrapper = document.createElement("a-entity");

  const outer = document.createElement("a-circle");
  outer.setAttribute("radius", iconSize * 0.5);
  outer.setAttribute("position", "0 0 0.02");
  outer.setAttribute("material", {
    color: "#0ea5e9",
    opacity: 0.92,
    shader: "flat",
    side: "double",
    transparent: true,
    depthWrite: false,
  });

  const inner = document.createElement("a-circle");
  inner.setAttribute("radius", iconSize * 0.24);
  inner.setAttribute("position", "0 0 0.03");
  inner.setAttribute("material", {
    color: "#ffffff",
    opacity: 0.96,
    shader: "flat",
    side: "double",
    transparent: true,
    depthWrite: false,
  });

  wrapper.appendChild(outer);
  wrapper.appendChild(inner);

  makeVisualMaterialDoubleSided(outer);
  makeVisualMaterialDoubleSided(inner);

  return wrapper;
}

function createImageIcon(iconSrc, iconSize) {
  const plane = document.createElement("a-plane");
  plane.setAttribute("width", iconSize);
  plane.setAttribute("height", iconSize);
  plane.setAttribute("position", "0 0 0.02");
  plane.setAttribute("material", {
    src: iconSrc,
    shader: "flat",
    transparent: true,
    alphaTest: 0.01,
    side: "double",
    depthWrite: false,
  });

  makeVisualMaterialDoubleSided(plane);
  return plane;
}

function estimateLabelWorldWidth(labelText, worldHeight) {
  const estimatedAspect = clamp(labelText.length * 0.42, 3.2, 10.5);
  return worldHeight * estimatedAspect;
}

function createLabelEntity(hotspot, sizeValue) {
  const labelText = String(hotspot.label || "").trim();

  if (!hotspot.showLabel || !labelText) {
    return null;
  }

  const labelGroup = document.createElement("a-entity");

  const fontSize = clamp(num(hotspot.fontSize, 1), 0.35, 4);
  const worldH = 0.18 * fontSize;
  const worldW = estimateLabelWorldWidth(labelText, worldH);

  const baseX = 0;
  const baseY = 0.25 + 0.1 * sizeValue;
  const baseZ = 0.06;

  const finalX = baseX + num(hotspot.labelOffsetX, 0);
  const finalY = baseY + num(hotspot.labelOffsetY, 0);

  labelGroup.setAttribute("position", `${finalX} ${finalY} ${baseZ}`);

  const background = document.createElement("a-plane");
  background.setAttribute("width", worldW);
  background.setAttribute("height", worldH);
  background.setAttribute("material", {
    opacity: 0,
    transparent: true,
    side: "double",
    depthWrite: false,
  });

  const text = document.createElement("a-text");
  text.setAttribute("value", labelText);
  text.setAttribute("align", "center");
  text.setAttribute("anchor", "center");
  text.setAttribute("baseline", "center");
  text.setAttribute("color", "#ffffff");
  text.setAttribute("width", Math.max(worldW * 1.9, 1.2));
  text.setAttribute("wrap-count", Math.max(10, Math.ceil(labelText.length * 0.9)));
  text.setAttribute("position", "0 0 0.01");
  text.setAttribute("side", "double");

  labelGroup.appendChild(background);
  labelGroup.appendChild(text);

  makeVisualMaterialDoubleSided(background);
  makeVisualMaterialDoubleSided(text);

  return labelGroup;
}

function applyRootOrientation(rootEl, hotspot) {
  const isBillboard = Boolean(hotspot.billboard);

  if (isBillboard) {
    rootEl.setAttribute("tour-billboard-root", {
      offsetX: num(hotspot.billboardRotationOffset, 0),
    });
    return;
  }

  rootEl.setAttribute(
    "rotation",
    rotToString({
      x: num(hotspot.rotation?.x, 0),
      y: num(hotspot.rotation?.y, 0),
      z: num(hotspot.rotation?.z, 0),
    })
  );
}

function createCollider(iconSize) {
  const collider = document.createElement("a-plane");
  const colliderSize = iconSize * 1.35;

  collider.classList.add("vr-clickable-hotspot");

  collider.setAttribute("width", colliderSize);
  collider.setAttribute("height", colliderSize);
  collider.setAttribute("position", "0 0 0");
  collider.setAttribute("material", {
    opacity: 0,
    transparent: true,
    side: "double",
    color: "#ffffff",
    depthWrite: false,
    depthTest: false,
  });

  makeInvisibleColliderNonBlocking(collider);

  return collider;
}

function attachHotspotEvents(targetEl, rootEl, hotspot, onHotspotNavigate) {
  let navigating = false;

  targetEl.addEventListener("mouseenter", () => {
    rootEl.object3D.scale.setScalar(1.08);
  });

  targetEl.addEventListener("mouseleave", () => {
    rootEl.object3D.scale.setScalar(1);
  });

  targetEl.addEventListener("click", async () => {
    if (navigating || typeof onHotspotNavigate !== "function") {
      return;
    }

    navigating = true;

    try {
      await onHotspotNavigate(hotspot);
    } finally {
      navigating = false;
      rootEl.object3D.scale.setScalar(1);
    }
  });
}

function createHotspotEntity({
  hotspot,
  index,
  tourData,
  tourPath,
  onHotspotNavigate,
}) {
  const rootEl = document.createElement("a-entity");
  const sizeValue = clamp(num(hotspot.size, 1), 0.1, 20);
  const iconSize = 0.35 * sizeValue;

  rootEl.id = `vr-hotspot-${sanitizeId(hotspot.id || `item-${index}`)}`;
  rootEl.dataset.hotspotId = hotspot.id || `item-${index}`;

  rootEl.setAttribute("position", vecToString(hotspot.pos));
  applyRootOrientation(rootEl, hotspot);

  const colliderEl = createCollider(iconSize);
  attachHotspotEvents(colliderEl, rootEl, hotspot, onHotspotNavigate);
  rootEl.appendChild(colliderEl);

  const iconSrc = resolveAssetPath(tourData, tourPath, hotspot.imageHotspot || "");
  const iconEl = iconSrc
    ? createImageIcon(iconSrc, iconSize)
    : createDefaultIcon(iconSize);

  rootEl.appendChild(iconEl);

  const labelEl = createLabelEntity(hotspot, sizeValue);
  if (labelEl) {
    const shouldBillboardLabel =
      !hotspot.billboard && Boolean(hotspot.textLabelBillboard);

    if (shouldBillboardLabel) {
      labelEl.setAttribute("tour-label-world-billboard", "");
    }

    rootEl.appendChild(labelEl);
  }

  return rootEl;
}

export function renderVrHotspots({
  sceneEl,
  sceneData,
  tourData,
  tourPath,
  onHotspotNavigate,
}) {
  registerComponents();

  const hotspotRoot = sceneEl.querySelector("#hotspot-root");

  if (!hotspotRoot) {
    throw new Error('Elemento "#hotspot-root" não foi encontrado.');
  }

  clearChildren(hotspotRoot);

  const hotspots = Array.isArray(sceneData.hotspots) ? sceneData.hotspots : [];

  hotspots.forEach((hotspot, index) => {
    const hotspotEl = createHotspotEntity({
      hotspot,
      index,
      tourData,
      tourPath,
      onHotspotNavigate,
    });

    hotspotRoot.appendChild(hotspotEl);
  });
}