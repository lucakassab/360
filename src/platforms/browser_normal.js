import {
  renderNormalScene,
  updateNormalScenePanoramaYaw,
} from "../renderers/normal_scene_renderer.js";
import { renderNormalHotspots } from "../renderers/normal_hotspot_renderer.js";

function setDragLookEnabled(sceneEl, enabled) {
  const rigEl = sceneEl.querySelector("#camera-rig");

  if (!rigEl) {
    return;
  }

  const current = rigEl.getAttribute("drag-look-controls") || {};
  rigEl.setAttribute("drag-look-controls", {
    ...current,
    enabled,
  });
}

function setViewerTranslationLockEnabled(sceneEl, enabled) {
  const rigEl = sceneEl.querySelector("#camera-rig");

  if (!rigEl) {
    return;
  }

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
  if (component?.resetWorldPositions) {
    component.resetWorldPositions();
  }
}

export async function initBrowserNormal({
  sceneEl,
  state,
  tourPath,
  onHotspotNavigate,
  panoramaYawOffsetDeg = 0,
  hotspotRotationYawOffsetDeg = 0,
}) {
  const currentScene = state.getCurrentScene();
  const tourData = state.getTourData();

  if (!currentScene) {
    throw new Error("Não existe cena atual para renderizar.");
  }

  state.setMode("normal");

  document.body.classList.remove("mode-vr");
  document.body.classList.add("mode-normal");

  setViewerTranslationLockEnabled(sceneEl, false);
  setDragLookEnabled(sceneEl, true);

  const mouseCursor = sceneEl.querySelector("#mouse-cursor");
  const vrGazeCursor = sceneEl.querySelector("#vr-gaze-cursor");
  const vrLeftHand = sceneEl.querySelector("#vr-left-hand");
  const vrRightHand = sceneEl.querySelector("#vr-right-hand");

  if (mouseCursor) {
    mouseCursor.setAttribute("visible", true);
  }

  if (vrGazeCursor) {
    vrGazeCursor.setAttribute("visible", false);
  }

  if (vrLeftHand) {
    vrLeftHand.setAttribute("visible", false);
  }

  if (vrRightHand) {
    vrRightHand.setAttribute("visible", false);
  }

  await renderNormalScene({
    sceneEl,
    sceneData: currentScene,
    tourData,
    tourPath,
    panoramaYawOffsetDeg,
  });

  renderNormalHotspots({
    sceneEl,
    sceneData: currentScene,
    tourData,
    tourPath,
    onHotspotNavigate,
    hotspotRotationYawOffsetDeg,
  });
}

export function updateBrowserNormalPanoramaYaw({
  sceneEl,
  panoramaYawOffsetDeg = 0,
}) {
  updateNormalScenePanoramaYaw({
    sceneEl,
    panoramaYawOffsetDeg,
  });
}

export function rerenderBrowserNormalHotspots({
  sceneEl,
  state,
  tourPath,
  onHotspotNavigate,
  hotspotRotationYawOffsetDeg = 0,
}) {
  const currentScene = state.getCurrentScene();
  const tourData = state.getTourData();

  if (!currentScene || !tourData) {
    return;
  }

  renderNormalHotspots({
    sceneEl,
    sceneData: currentScene,
    tourData,
    tourPath,
    onHotspotNavigate,
    hotspotRotationYawOffsetDeg,
  });
}