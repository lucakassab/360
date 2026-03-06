import { renderVrScene } from "../renderers/vr_scene_renderer.js";
import { renderVrHotspots } from "../renderers/vr_hotspot_renderer.js";
import { initVRWidget } from "../vr_widget.js";

let vrWidget = null;
let vrControllersInitialized = false;

// Flags de configuração dos lasers dos controles
const VR_LEFT_CONTROLLER_LASER_ENABLED = false;
const VR_RIGHT_CONTROLLER_LASER_ENABLED = true;

function setVisible(el, visible) {
  if (!el) return;
  el.setAttribute("visible", visible);
}

function resetEntityLocalTransform(entityEl) {
  if (!entityEl?.object3D) return;

  entityEl.object3D.position.set(0, 0, 0);
  entityEl.object3D.rotation.set(0, 0, 0);
  entityEl.object3D.scale.set(1, 1, 1);

  entityEl.setAttribute("position", "0 0 0");
  entityEl.setAttribute("rotation", "0 0 0");
  entityEl.setAttribute("scale", "1 1 1");
}

function getMergedRayTargets(currentObjectsValue = "") {
  const requiredTargets = [
    ".clickable-hotspot",
    ".vr-clickable-hotspot",
    ".vr-ui-clickable",
  ];

  const currentTargets = String(currentObjectsValue || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  requiredTargets.forEach((target) => {
    if (!currentTargets.includes(target)) {
      currentTargets.push(target);
    }
  });

  return currentTargets.join(", ");
}

function isControllerLaserEnabled(hand) {
  if (hand === "left") {
    return VR_LEFT_CONTROLLER_LASER_ENABLED;
  }

  if (hand === "right") {
    return VR_RIGHT_CONTROLLER_LASER_ENABLED;
  }

  return true;
}

function applyControllerLaserState(entityEl, hand) {
  if (!entityEl) return;

  const laserEnabled = isControllerLaserEnabled(hand);
  const currentRaycaster = entityEl.getAttribute("raycaster") || {};

  entityEl.dataset.vrLaserEnabled = laserEnabled ? "true" : "false";

  if (!laserEnabled) {
    // Desliga completamente interação e linha visual desse controle.
    entityEl.removeAttribute("cursor");

    entityEl.setAttribute("raycaster", {
      ...currentRaycaster,
      enabled: false,
      showLine: false,
      far: currentRaycaster.far || 200,
      objects: "",
    });

    entityEl.setAttribute("line", {
      color: "#93C5FD",
      opacity: 0,
      visible: false,
    });

    console.log("[VR] laser desativado para controle", { hand });
    return;
  }

  entityEl.setAttribute("raycaster", {
    ...currentRaycaster,
    enabled: true,
    far: currentRaycaster.far || 200,
    showLine: true,
    lineColor: currentRaycaster.lineColor || "#93C5FD",
    lineOpacity:
      currentRaycaster.lineOpacity !== undefined
        ? currentRaycaster.lineOpacity
        : 0.95,
    objects: getMergedRayTargets(currentRaycaster.objects),
  });

  entityEl.setAttribute("line", {
    color: "#93C5FD",
    opacity: 0.95,
    visible: true,
  });
}

function configureVrControllerOnce(entityEl, hand) {
  if (!entityEl) return;

  const alreadyConfigured =
    entityEl.dataset.vrControllerConfigured === "true" &&
    entityEl.dataset.vrControllerHand === hand;

  if (!alreadyConfigured) {
    entityEl.removeAttribute("laser-controls");
    entityEl.removeAttribute("meta-touch-controls");
    entityEl.removeAttribute("tracked-controls");
    entityEl.removeAttribute("hand-controls");
    entityEl.removeAttribute("cursor");
    entityEl.removeAttribute("raycaster");
    entityEl.removeAttribute("line");

    resetEntityLocalTransform(entityEl);

    // Mantém laser-controls para tracking/modelo/eventos do controle.
    entityEl.setAttribute("laser-controls", {
      hand,
      model: true,
    });

    entityEl.dataset.vrControllerConfigured = "true";
    entityEl.dataset.vrControllerHand = hand;

    console.log("[VR] controle configurado pela primeira vez na sessão", {
      hand,
    });
  }

  setVisible(entityEl, true);
  applyControllerLaserState(entityEl, hand);
}

function refreshRaycasterEntity(entityEl, label = "") {
  const laserEnabled = entityEl?.dataset?.vrLaserEnabled === "true";
  if (!laserEnabled) {
    return;
  }

  const raycasterComponent = entityEl?.components?.raycaster;

  if (!raycasterComponent) {
    console.warn("[VR] raycaster ainda não disponível para refresh", { label });
    return;
  }

  try {
    raycasterComponent.refreshObjects();

    console.log("[VR] raycaster refreshed", {
      label,
      objectCount: Array.isArray(raycasterComponent.objects)
        ? raycasterComponent.objects.length
        : 0,
    });
  } catch (error) {
    console.warn("[VR] falha ao atualizar raycaster", { label, error });
  }
}

function refreshVrInteractionTargets(sceneEl) {
  const vrLeftHand = sceneEl.querySelector("#vr-left-hand");
  const vrRightHand = sceneEl.querySelector("#vr-right-hand");
  const vrGazeCursor = sceneEl.querySelector("#vr-gaze-cursor");

  const run = () => {
    applyControllerLaserState(vrLeftHand, "left");
    applyControllerLaserState(vrRightHand, "right");

    refreshRaycasterEntity(vrLeftHand, "left-hand");
    refreshRaycasterEntity(vrRightHand, "right-hand");
    refreshRaycasterEntity(vrGazeCursor, "gaze-cursor");
  };

  run();

  window.requestAnimationFrame(() => {
    run();

    window.requestAnimationFrame(() => {
      run();
    });
  });

  window.setTimeout(run, 120);
  window.setTimeout(run, 280);
}

function resetVrCameraTransforms(sceneEl) {
  const rigEl = sceneEl.querySelector("#camera-rig");
  const pitchEl = sceneEl.querySelector("#camera-pitch");
  const cameraEl = sceneEl.querySelector("#main-camera");

  if (rigEl?.object3D) {
    const currentYaw = rigEl.object3D.rotation.y || 0;
    rigEl.object3D.rotation.set(0, currentYaw, 0);
    rigEl.setAttribute("rotation", `0 ${(currentYaw * 180) / Math.PI} 0`);
  }

  if (pitchEl?.object3D) {
    pitchEl.object3D.rotation.set(0, 0, 0);
    pitchEl.setAttribute("rotation", "0 0 0");
  }

  if (cameraEl?.object3D) {
    cameraEl.object3D.rotation.set(0, 0, 0);
    cameraEl.object3D.position.set(0, 0, 0);
    cameraEl.setAttribute("rotation", "0 0 0");
    cameraEl.setAttribute("position", "0 0 0");
  }
}

function setDragLookEnabled(sceneEl, enabled) {
  const rigEl = sceneEl.querySelector("#camera-rig");
  if (!rigEl) return;

  const current = rigEl.getAttribute("drag-look-controls") || {};
  rigEl.setAttribute("drag-look-controls", {
    ...current,
    enabled,
  });
}

function setViewerTranslationLockEnabled(sceneEl, enabled) {
  const rigEl = sceneEl.querySelector("#camera-rig");
  if (!rigEl) return;

  const current = rigEl.getAttribute("vr-viewer-translation-lock") || {};
  rigEl.setAttribute("vr-viewer-translation-lock", {
    ...current,
    enabled,
    lockX: true,
    lockY: true,
    lockZ: true,
    worldTargets: "#panorama-root, #hotspot-root",
  });

  const component = rigEl.components?.["vr-viewer-translation-lock"];
  if (!component) return;

  component.resolveWorldTargets?.();

  if (enabled) {
    component.captureBaseline?.();
  } else {
    component.resetWorldPositions?.();
  }
}

function destroyVrWidget() {
  if (!vrWidget) return;
  vrWidget.destroy();
  vrWidget = null;
}

function resetVrSessionControllerState() {
  vrControllersInitialized = false;
}

function createWidgetSceneNavigateHandler(onHotspotNavigate) {
  return async (sceneId) => {
    if (!sceneId || typeof onHotspotNavigate !== "function") return;

    await onHotspotNavigate({
      id: `vr-widget-scene-${sceneId}`,
      label: `VR Widget Scene ${sceneId}`,
      targetScene: sceneId,
      targetTour: "",
    });
  };
}

function createWidgetTourNavigateHandler(onHotspotNavigate) {
  return async (tourPath) => {
    if (!tourPath || typeof onHotspotNavigate !== "function") return;

    await onHotspotNavigate({
      id: `vr-widget-tour-${tourPath}`,
      label: `VR Widget Tour ${tourPath}`,
      targetScene: "",
      targetTour: tourPath,
    });
  };
}

function initVrWidget(sceneEl, state, onHotspotNavigate, availableTours = []) {
  if (vrWidget) {
    vrWidget.availableTours = Array.isArray(availableTours) ? availableTours : [];
    vrWidget.syncFromState?.();
    return;
  }

  vrWidget = initVRWidget({
    sceneEl,
    state,
    availableTours: Array.isArray(availableTours) ? availableTours : [],
    onTourChange: createWidgetTourNavigateHandler(onHotspotNavigate),
    onSceneChange: createWidgetSceneNavigateHandler(onHotspotNavigate),
  });
}

export async function initBrowserVr({
  sceneEl,
  state,
  tourPath,
  onHotspotNavigate,
  availableTours = [],
}) {
  const currentScene = state.getCurrentScene();
  const tourData = state.getTourData();

  if (!currentScene) {
    throw new Error("Não existe cena atual para renderizar em VR.");
  }

  state.setMode("vr");

  document.body.classList.remove("mode-normal");
  document.body.classList.add("mode-vr");

  setDragLookEnabled(sceneEl, false);
  resetVrCameraTransforms(sceneEl);

  const mouseCursor = sceneEl.querySelector("#mouse-cursor");
  const vrGazeCursor = sceneEl.querySelector("#vr-gaze-cursor");
  const vrLeftHand = sceneEl.querySelector("#vr-left-hand");
  const vrRightHand = sceneEl.querySelector("#vr-right-hand");

  setVisible(mouseCursor, false);
  setVisible(vrGazeCursor, false);

  configureVrControllerOnce(vrLeftHand, "left");
  configureVrControllerOnce(vrRightHand, "right");
  vrControllersInitialized = true;

  await renderVrScene({
    sceneEl,
    sceneData: currentScene,
    tourData,
    tourPath,
  });

  renderVrHotspots({
    sceneEl,
    sceneData: currentScene,
    tourData,
    tourPath,
    onHotspotNavigate,
  });

  setViewerTranslationLockEnabled(sceneEl, true);

  initVrWidget(sceneEl, state, onHotspotNavigate, availableTours);

  refreshVrInteractionTargets(sceneEl);

  sceneEl.addEventListener(
    "exit-vr",
    () => {
      destroyVrWidget();
      resetVrSessionControllerState();
    },
    { once: true }
  );
}