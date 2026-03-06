import "./components/vr_viewer_translation_lock.js";
import { initBrowserVr } from "./platforms/browser_vr.js";
import "./components/drag_look_controls.js";
import { preloadTourAssets } from "./tour_preloader.js";
import { tourState } from "./tour_state.js";
import {
  loadTour,
  resolveAssetPath,
  resolveLinkedTourPath,
  normalizePath,
} from "./tour_loader.js";
import { detectPlatform } from "./platform_selector.js";
import {
  initBrowserNormal,
  updateBrowserNormalPanoramaYaw,
  rerenderBrowserNormalHotspots,
} from "./platforms/browser_normal.js";

const SHOW_ALIGNMENT_DEBUG_UI = false;
const PANORAMA_FINE_YAW_STORAGE_KEY =
  "wpa360_debug_panorama_fine_yaw_offset_deg";
const HOTSPOT_ROTATION_FINE_YAW_STORAGE_KEY =
  "wpa360_debug_hotspot_rotation_fine_yaw_offset_deg";

const AVAILABLE_TOURS = [
  {
    id: "coluna_1",
    label: "Apartamento Coluna 1",
    path: "tours/coluna_1/tour.json",
  },
  {
    id: "coluna_2",
    label: "Apartamento Coluna 2",
    path: "tours/coluna_2/tour.json",
  },
  {
    id: "coluna_3",
    label: "Apartamento Coluna 3",
    path: "tours/coluna_3/tour.json",
  },
  {
    id: "coluna_4",
    label: "Apartamento Coluna 4",
    path: "tours/coluna_4/tour.json",
  },
  {
    id: "coluna_5",
    label: "Apartamento Coluna 5",
    path: "tours/coluna_5/tour.json",
  },
];

const MAP_MIN_SCALE = 1;
const MAP_MAX_SCALE = 5;
const MAP_ZOOM_STEP = 0.25;

const dom = {
  sceneEl: document.querySelector("#tour-scene"),
  tourNameEl: document.querySelector("#tour-name"),
  sceneTitleEl: document.querySelector("#scene-title"),
  sceneDescriptionEl: document.querySelector("#scene-description"),
  platformBadgeEl: document.querySelector("#platform-badge"),

  mapPanelEl: document.querySelector("#map-panel"),
  mapTitleEl: document.querySelector("#map-title"),
  mapPanelBodyEl: document.querySelector("#map-panel-body"),
  mapPanelCollapseBtnEl: document.querySelector("#map-panel-collapse-btn"),
  mapFrameEl: document.querySelector("#map-frame"),
  mapPanzoomStageEl: document.querySelector("#map-panzoom-stage"),
  mapImageEl: document.querySelector("#map-image"),
  mapPrevSceneBtnEl: document.querySelector("#map-prev-scene-btn"),
  mapNextSceneBtnEl: document.querySelector("#map-next-scene-btn"),
  mapZoomOutBtnEl: document.querySelector("#map-zoom-out-btn"),
  mapZoomInBtnEl: document.querySelector("#map-zoom-in-btn"),
  mapResetBtnEl: document.querySelector("#map-reset-btn"),

  toggleMapBtnEl: document.querySelector("#toggle-map-btn"),

  leftMainCardEl: document.querySelector("#left-main-card"),
  leftMainCardBodyEl: document.querySelector("#left-main-card-body"),
  leftCardCollapseBtnEl: document.querySelector("#left-card-collapse-btn"),

  loadingOverlayEl: document.querySelector("#loading-overlay"),
  loadingTextEl: document.querySelector("#loading-text"),
  errorToastEl: document.querySelector("#error-toast"),

  controlsCardEl: document.querySelector("#controls-card"),
  enterVrButtonEl: document.querySelector("#btn-enter-vr"),
  exitVrButtonEl: document.querySelector("#btn-exit-vr"),

  alignmentDebugPanelEl: document.querySelector("#alignment-debug-panel"),
  alignmentYawInputEl: document.querySelector("#alignment-yaw-input"),
  rotationYawInputEl: document.querySelector("#rotation-yaw-input"),
  alignmentDebugValueEl: document.querySelector("#alignment-debug-value"),
  alignmentResetBtnEl: document.querySelector("#alignment-reset-btn"),

  tourSelectEl: document.querySelector("#tour-select"),
  sceneSelectEl: document.querySelector("#scene-select"),
};

let platformInfo = null;
let errorToastTimer = null;
let panoramaFineYawOffsetDeg = 0;
let hotspotRotationFineYawOffsetDeg = 0;
let isProgrammaticTourSelectUpdate = false;
let isProgrammaticSceneSelectUpdate = false;
let isMapVisible = false;
let isLeftCardCollapsed = false;
let isMapCardCollapsed = false;

let activePreloadToken = 0;

let mapScale = 1;
let mapTranslateX = 0;
let mapTranslateY = 0;
let lastMapSourceKey = "";

const mapPointers = new Map();
let pinchStartDistance = 0;
let pinchStartScale = 1;
let dragStartTranslateX = 0;
let dragStartTranslateY = 0;
let dragStartPointerX = 0;
let dragStartPointerY = 0;

function waitForSceneReady(sceneEl) {
  return new Promise((resolve) => {
    if (sceneEl.hasLoaded) {
      resolve();
      return;
    }

    sceneEl.addEventListener("loaded", () => resolve(), { once: true });
  });
}

function setLoading(isLoading, message = "Carregando...") {
  dom.loadingTextEl.textContent = message;
  dom.loadingOverlayEl.classList.toggle("is-hidden", !isLoading);
}

function showError(message, sticky = false) {
  dom.errorToastEl.textContent = message;
  dom.errorToastEl.classList.remove("is-hidden");

  if (errorToastTimer) {
    window.clearTimeout(errorToastTimer);
  }

  if (!sticky) {
    errorToastTimer = window.setTimeout(() => {
      dom.errorToastEl.classList.add("is-hidden");
    }, 4800);
  }
}

function hideError() {
  dom.errorToastEl.classList.add("is-hidden");
}

function getSearchParams() {
  return new URLSearchParams(window.location.search);
}

function getInitialTourPath() {
  const params = getSearchParams();
  return params.get("tour") || "tour.json";
}

function getInitialSceneId() {
  const params = getSearchParams();
  return params.get("scene") || "";
}

function updatePlatformBadge() {
  if (!platformInfo) {
    dom.platformBadgeEl.textContent = "Desconhecido";
    return;
  }

  dom.platformBadgeEl.textContent = platformInfo.label;
}

function getCurrentTourCatalogEntry() {
  const currentTourPath = normalizePath(tourState.getTourPath());

  return (
    AVAILABLE_TOURS.find((tour) => normalizePath(tour.path) === currentTourPath) ||
    null
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function resetMapViewTransform(applyNow = true) {
  mapScale = 1;
  mapTranslateX = 0;
  mapTranslateY = 0;

  if (applyNow) {
    applyMapTransform();
  }
}

function startTourPreload(tourData, tourPath) {
  const preloadToken = ++activePreloadToken;

  preloadTourAssets({
    tourData,
    tourPath,
    debug: true,
  })
    .then((summary) => {
      if (preloadToken !== activePreloadToken) {
        return;
      }

      console.log("[preload] tour pronto em cache", {
        tourName: tourData?.tourName || "",
        total: summary.total,
        loaded: summary.loaded,
        failed: summary.failed,
      });
    })
    .catch((error) => {
      if (preloadToken !== activePreloadToken) {
        return;
      }

      console.warn("[preload] falha na pré-carga do tour", error);
    });
}

function applyMapTransform() {
  if (!dom.mapPanzoomStageEl || !dom.mapImageEl) {
    return;
  }

  dom.mapPanzoomStageEl.style.transform = `translate(${mapTranslateX}px, ${mapTranslateY}px) scale(${mapScale})`;
}

function setMapScale(nextScale, applyNow = true) {
  mapScale = clamp(round2(nextScale), MAP_MIN_SCALE, MAP_MAX_SCALE);

  if (mapScale <= 1) {
    mapTranslateX = 0;
    mapTranslateY = 0;
  }

  if (applyNow) {
    applyMapTransform();
  }
}

function updateMapImageRotation(rotationDeg = 0) {
  if (!dom.mapImageEl) {
    return;
  }

  dom.mapImageEl.style.transform = `rotate(${Number(rotationDeg || 0)}deg)`;
}

function updateLeftCardCollapseUi() {
  if (!dom.leftMainCardEl || !dom.leftMainCardBodyEl || !dom.leftCardCollapseBtnEl) {
    return;
  }

  dom.leftMainCardEl.classList.toggle("is-collapsed", isLeftCardCollapsed);
  dom.leftMainCardBodyEl.classList.toggle(
    "is-hidden-by-collapse",
    isLeftCardCollapsed
  );

  dom.leftCardCollapseBtnEl.textContent = isLeftCardCollapsed ? "+" : "−";
  dom.leftCardCollapseBtnEl.setAttribute(
    "aria-label",
    isLeftCardCollapsed ? "Expandir interface" : "Colapsar interface"
  );
}

function updateMapCardCollapseUi() {
  if (!dom.mapPanelEl || !dom.mapPanelBodyEl || !dom.mapPanelCollapseBtnEl) {
    return;
  }

  dom.mapPanelEl.classList.toggle("is-collapsed", isMapCardCollapsed);
  dom.mapPanelBodyEl.classList.toggle("is-hidden-by-collapse", isMapCardCollapsed);

  dom.mapPanelCollapseBtnEl.textContent = isMapCardCollapsed ? "+" : "−";
  dom.mapPanelCollapseBtnEl.setAttribute(
    "aria-label",
    isMapCardCollapsed ? "Expandir minimapa" : "Colapsar minimapa"
  );
}

function updateMapSceneNavUi() {
  const scenes = tourState.getTourData()?.scenes || [];
  const currentSceneId = tourState.getCurrentScene()?.id || "";
  const currentIndex = scenes.findIndex((scene) => scene.id === currentSceneId);
  const hasScenes = scenes.length > 0;

  if (dom.mapPrevSceneBtnEl) {
    dom.mapPrevSceneBtnEl.disabled = !hasScenes || currentIndex <= 0;
  }

  if (dom.mapNextSceneBtnEl) {
    dom.mapNextSceneBtnEl.disabled =
      !hasScenes || currentIndex < 0 || currentIndex >= scenes.length - 1;
  }
}

function updateMapToggleUi(hasMap) {
  if (!dom.toggleMapBtnEl) {
    return;
  }

  if (!hasMap) {
    dom.toggleMapBtnEl.disabled = true;
    dom.toggleMapBtnEl.textContent = "Minimapa indisponível";
    return;
  }

  dom.toggleMapBtnEl.disabled = false;
  dom.toggleMapBtnEl.textContent = isMapVisible
    ? "Ocultar minimapa"
    : "Mostrar minimapa";
}

function applyMapVisibility(hasMap) {
  if (!dom.mapPanelEl) {
    return;
  }

  dom.mapPanelEl.classList.toggle("is-hidden", !(hasMap && isMapVisible));
  updateMapToggleUi(hasMap);
  updateMapCardCollapseUi();
  updateMapSceneNavUi();
}

function populateTourSelect() {
  const select = dom.tourSelectEl;
  if (!select) {
    return;
  }

  const currentTourPath = normalizePath(tourState.getTourPath());
  const currentTourData = tourState.getTourData();

  isProgrammaticTourSelectUpdate = true;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecionar tour...";
  select.appendChild(placeholder);

  AVAILABLE_TOURS.forEach((tour) => {
    const option = document.createElement("option");
    option.value = normalizePath(tour.path);
    option.textContent = tour.label || tour.id || tour.path;
    select.appendChild(option);
  });

  if (
    currentTourPath &&
    !AVAILABLE_TOURS.some((tour) => normalizePath(tour.path) === currentTourPath)
  ) {
    const extraOption = document.createElement("option");
    extraOption.value = currentTourPath;
    extraOption.textContent =
      currentTourData?.tourName || currentTourPath || "Tour atual";
    select.appendChild(extraOption);
  }

  select.value = currentTourPath || "";
  isProgrammaticTourSelectUpdate = false;
}

function populateSceneSelect() {
  const select = dom.sceneSelectEl;
  if (!select) {
    return;
  }

  const tourData = tourState.getTourData();
  const currentScene = tourState.getCurrentScene();

  isProgrammaticSceneSelectUpdate = true;
  select.innerHTML = "";

  if (!tourData?.scenes?.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhuma cena disponível";
    select.appendChild(option);
    select.value = "";
    isProgrammaticSceneSelectUpdate = false;
    return;
  }

  tourData.scenes.forEach((scene) => {
    const option = document.createElement("option");
    option.value = scene.id;
    option.textContent = scene.title || scene.id;
    select.appendChild(option);
  });

  select.value = currentScene?.id || "";
  isProgrammaticSceneSelectUpdate = false;
}

function updateHud() {
  const tourData = tourState.getTourData();
  const sceneData = tourState.getCurrentScene();
  const tourPath = tourState.getTourPath();
  const catalogEntry = getCurrentTourCatalogEntry();

  if (!tourData || !sceneData) {
    return;
  }

  dom.tourNameEl.textContent =
    catalogEntry?.label || tourData.tourName || "Tour sem nome";

  dom.sceneTitleEl.textContent = sceneData.title || sceneData.id || "Cena";
  dom.sceneDescriptionEl.textContent = sceneData.description || "";
  dom.mapTitleEl.textContent = sceneData.title || sceneData.id || "Cena";

  const mapPath = resolveAssetPath(tourData, tourPath, sceneData.imageMap || "");
  const hasMap = Boolean(mapPath);
  const nextMapKey = hasMap
    ? `${mapPath}|${Number(sceneData.mapRotation || 0)}`
    : "";

  if (hasMap) {
    dom.mapImageEl.src = mapPath;
    updateMapImageRotation(sceneData.mapRotation || 0);

    if (nextMapKey !== lastMapSourceKey) {
      resetMapViewTransform(false);
      lastMapSourceKey = nextMapKey;
    }
  } else {
    dom.mapImageEl.removeAttribute("src");
    updateMapImageRotation(0);
    resetMapViewTransform(false);
    lastMapSourceKey = "";
    isMapVisible = false;
  }

  applyMapTransform();
  applyMapVisibility(hasMap);
  populateTourSelect();
  populateSceneSelect();
  updateLeftCardCollapseUi();
}

function syncUrl() {
  const tourPath = tourState.getTourPath();
  const sceneData = tourState.getCurrentScene();

  if (!tourPath || !sceneData) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  params.set("tour", tourPath);
  params.set("scene", sceneData.id);

  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState({}, "", newUrl);
}

function readStoredNumber(key) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function storeNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignora
  }
}

function updateAlignmentDebugUi() {
  if (dom.alignmentYawInputEl) {
    dom.alignmentYawInputEl.value = String(panoramaFineYawOffsetDeg);
  }

  if (dom.rotationYawInputEl) {
    dom.rotationYawInputEl.value = String(hotspotRotationFineYawOffsetDeg);
  }

  if (dom.alignmentDebugValueEl) {
    dom.alignmentDebugValueEl.textContent =
      `Posição: ${panoramaFineYawOffsetDeg}° · Rotação: ${hotspotRotationFineYawOffsetDeg}°`;
  }
}

function applyPanoramaFineYawOnly() {
  updateBrowserNormalPanoramaYaw({
    sceneEl: dom.sceneEl,
    panoramaYawOffsetDeg: panoramaFineYawOffsetDeg,
  });
}

function rerenderHotspotsOnly() {
  rerenderBrowserNormalHotspots({
    sceneEl: dom.sceneEl,
    state: tourState,
    tourPath: tourState.getTourPath(),
    onHotspotNavigate: handleHotspotNavigate,
    hotspotRotationYawOffsetDeg: hotspotRotationFineYawOffsetDeg,
  });
}

function setPanoramaFineYawOffset(value, shouldApply = true) {
  const parsed = Number(value);
  panoramaFineYawOffsetDeg = Number.isFinite(parsed) ? parsed : 0;

  updateAlignmentDebugUi();
  storeNumber(PANORAMA_FINE_YAW_STORAGE_KEY, panoramaFineYawOffsetDeg);

  if (shouldApply) {
    applyPanoramaFineYawOnly();
  }
}

function setHotspotRotationFineYawOffset(value, shouldApply = true) {
  const parsed = Number(value);
  hotspotRotationFineYawOffsetDeg = Number.isFinite(parsed) ? parsed : 0;

  updateAlignmentDebugUi();
  storeNumber(
    HOTSPOT_ROTATION_FINE_YAW_STORAGE_KEY,
    hotspotRotationFineYawOffsetDeg
  );

  if (shouldApply) {
    rerenderHotspotsOnly();
  }
}

async function renderCurrentScene() {
  const currentScene = tourState.getCurrentScene();

  if (!currentScene) {
    throw new Error("Não existe cena atual para renderizar.");
  }

  updateHud();

  const isVrRuntime = dom.sceneEl?.is?.("vr-mode");

  if (isVrRuntime) {
    await initBrowserVr({
      sceneEl: dom.sceneEl,
      state: tourState,
      tourPath: tourState.getTourPath(),
      onHotspotNavigate: handleHotspotNavigate,
    });
    return;
  }

  await initBrowserNormal({
    sceneEl: dom.sceneEl,
    state: tourState,
    tourPath: tourState.getTourPath(),
    onHotspotNavigate: handleHotspotNavigate,
    panoramaYawOffsetDeg: panoramaFineYawOffsetDeg,
    hotspotRotationYawOffsetDeg: hotspotRotationFineYawOffsetDeg,
  });
}

function bindVrLifecycle() {
  if (!dom.sceneEl) {
    return;
  }

  dom.sceneEl.addEventListener("enter-vr", async () => {
    hideError();

    try {
      setLoading(true, "Entrando em VR...");
      await renderCurrentScene();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "Falhou ao entrar em VR.");
    }
  });

  dom.sceneEl.addEventListener("exit-vr", async () => {
    hideError();

    try {
      setLoading(true, "Saindo do VR...");
      await renderCurrentScene();
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "Falhou ao sair do VR.");
    }
  });
}

async function openTour(tourPath, preferredSceneId = "") {
  setLoading(true, "Carregando tour...");

  const { tourData, tourPath: resolvedTourPath } = await loadTour(tourPath);

  tourState.setTour(tourData, resolvedTourPath);

  const sceneIdExists =
    preferredSceneId &&
    tourData.scenes.some((scene) => scene.id === preferredSceneId);

  const startingSceneId = sceneIdExists
    ? preferredSceneId
    : tourData.defaultScene || tourData.scenes[0]?.id;

  if (!startingSceneId) {
    throw new Error("Não consegui descobrir qual cena abrir primeiro.");
  }

  tourState.setCurrentScene(startingSceneId);

  setLoading(true, "Renderizando cena...");
  await renderCurrentScene();
  updateHud();
  syncUrl();
  setLoading(false);

  startTourPreload(tourData, resolvedTourPath);
}

async function switchToScene(sceneId) {
  if (!sceneId) {
    throw new Error("Hotspot sem targetScene.");
  }

  tourState.setCurrentScene(sceneId);

  setLoading(true, "Trocando de cena...");
  await renderCurrentScene();
  updateHud();
  syncUrl();
  setLoading(false);
}

async function openAdjacentScene(direction) {
  const scenes = tourState.getTourData()?.scenes || [];
  const currentSceneId = tourState.getCurrentScene()?.id || "";
  const currentIndex = scenes.findIndex((scene) => scene.id === currentSceneId);

  if (currentIndex < 0) {
    return;
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= scenes.length) {
    return;
  }

  await switchToScene(scenes[nextIndex].id);
}

async function openLinkedTourFromHotspot(hotspot) {
  const currentTourPath = tourState.getTourPath();
  const linkedTour = tourState.resolveLinkedTour(hotspot.targetTour) || null;

  let nextTourPath = "";

  if (linkedTour?.path) {
    nextTourPath = resolveLinkedTourPath(currentTourPath, linkedTour.path);
  } else if (String(hotspot.targetTour || "").endsWith(".json")) {
    nextTourPath = resolveLinkedTourPath(currentTourPath, hotspot.targetTour);
  }

  if (!nextTourPath) {
    throw new Error(
      `Não achei targetTour "${hotspot.targetTour}" na lista linkedTours.`
    );
  }

  await openTour(nextTourPath, hotspot.targetScene || "");
}

async function handleHotspotNavigate(hotspot) {
  hideError();

  try {
    if (hotspot.targetTour) {
      await openLinkedTourFromHotspot(hotspot);
      return;
    }

    await switchToScene(hotspot.targetScene);
  } catch (error) {
    console.error(error);
    setLoading(false);
    showError(error.message || "Falhou ao navegar pelo hotspot.");
  }
}

function bindStateEvents() {
  tourState.subscribe("tourchange", () => {
    updateHud();
  });

  tourState.subscribe("scenechange", () => {
    updateHud();
  });

  tourState.subscribe("modechange", () => {
    document.body.classList.toggle("mode-vr", tourState.getMode() === "vr");
    document.body.classList.toggle(
      "mode-normal",
      tourState.getMode() === "normal"
    );
  });
}

function bindAlignmentDebugUi() {
  if (!dom.alignmentDebugPanelEl) {
    return;
  }

  if (!SHOW_ALIGNMENT_DEBUG_UI) {
    dom.alignmentDebugPanelEl.classList.add("is-hidden");
    return;
  }

  dom.alignmentDebugPanelEl.classList.remove("is-hidden");

  panoramaFineYawOffsetDeg = readStoredNumber(PANORAMA_FINE_YAW_STORAGE_KEY);
  hotspotRotationFineYawOffsetDeg = readStoredNumber(
    HOTSPOT_ROTATION_FINE_YAW_STORAGE_KEY
  );

  updateAlignmentDebugUi();

  dom.alignmentYawInputEl?.addEventListener("input", (event) => {
    setPanoramaFineYawOffset(event.target.value, true);
  });

  dom.rotationYawInputEl?.addEventListener("input", (event) => {
    setHotspotRotationFineYawOffset(event.target.value, true);
  });

  dom.alignmentResetBtnEl?.addEventListener("click", () => {
    setPanoramaFineYawOffset(0, false);
    setHotspotRotationFineYawOffset(0, false);
    applyPanoramaFineYawOnly();
    rerenderHotspotsOnly();
  });
}

function bindTourAndSceneSelectors() {
  dom.tourSelectEl?.addEventListener("change", async (event) => {
    if (isProgrammaticTourSelectUpdate) {
      return;
    }

    const nextTourPath = event.target.value;
    if (!nextTourPath) {
      return;
    }

    if (normalizePath(nextTourPath) === normalizePath(tourState.getTourPath())) {
      return;
    }

    hideError();

    try {
      await openTour(nextTourPath);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "Falhou ao trocar de tour.");
    }
  });

  dom.sceneSelectEl?.addEventListener("change", async (event) => {
    if (isProgrammaticSceneSelectUpdate) {
      return;
    }

    const nextSceneId = event.target.value;
    if (!nextSceneId) {
      return;
    }

    if (nextSceneId === tourState.getCurrentScene()?.id) {
      return;
    }

    hideError();

    try {
      await switchToScene(nextSceneId);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "Falhou ao trocar de cena.");
    }
  });
}

function bindMapToggle() {
  dom.toggleMapBtnEl?.addEventListener("click", () => {
    const tourData = tourState.getTourData();
    const sceneData = tourState.getCurrentScene();
    const tourPath = tourState.getTourPath();

    if (!tourData || !sceneData) {
      return;
    }

    const mapPath = resolveAssetPath(tourData, tourPath, sceneData.imageMap || "");
    const hasMap = Boolean(mapPath);

    if (!hasMap) {
      isMapVisible = false;
      applyMapVisibility(false);
      return;
    }

    isMapVisible = !isMapVisible;
    applyMapVisibility(true);
  });

  updateMapToggleUi(false);
  applyMapVisibility(false);
}

function bindLeftCardCollapse() {
  dom.leftCardCollapseBtnEl?.addEventListener("click", () => {
    isLeftCardCollapsed = !isLeftCardCollapsed;
    updateLeftCardCollapseUi();
  });

  updateLeftCardCollapseUi();
}

function bindMapCardCollapse() {
  dom.mapPanelCollapseBtnEl?.addEventListener("click", () => {
    isMapCardCollapsed = !isMapCardCollapsed;
    updateMapCardCollapseUi();
  });

  updateMapCardCollapseUi();
}

function getDistanceBetweenPointers(pointerA, pointerB) {
  const dx = pointerB.clientX - pointerA.clientX;
  const dy = pointerB.clientY - pointerA.clientY;
  return Math.hypot(dx, dy);
}

function getPointersArray() {
  return Array.from(mapPointers.values());
}

function bindMapPanZoom() {
  if (!dom.mapFrameEl) {
    return;
  }

  dom.mapZoomInBtnEl?.addEventListener("click", () => {
    setMapScale(mapScale + MAP_ZOOM_STEP, true);
  });

  dom.mapZoomOutBtnEl?.addEventListener("click", () => {
    setMapScale(mapScale - MAP_ZOOM_STEP, true);
  });

  dom.mapResetBtnEl?.addEventListener("click", () => {
    resetMapViewTransform(true);
  });

  dom.mapFrameEl.addEventListener("pointerdown", (event) => {
    if (!isMapVisible || isMapCardCollapsed) {
      return;
    }

    dom.mapFrameEl.setPointerCapture?.(event.pointerId);

    mapPointers.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    const pointers = getPointersArray();

    if (pointers.length === 1) {
      dragStartPointerX = event.clientX;
      dragStartPointerY = event.clientY;
      dragStartTranslateX = mapTranslateX;
      dragStartTranslateY = mapTranslateY;
    }

    if (pointers.length === 2) {
      pinchStartDistance = getDistanceBetweenPointers(pointers[0], pointers[1]);
      pinchStartScale = mapScale;
    }
  });

  dom.mapFrameEl.addEventListener("pointermove", (event) => {
    if (!mapPointers.has(event.pointerId)) {
      return;
    }

    mapPointers.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    const pointers = getPointersArray();

    if (pointers.length === 2) {
      const nextDistance = getDistanceBetweenPointers(pointers[0], pointers[1]);

      if (pinchStartDistance > 0) {
        const scaleFactor = nextDistance / pinchStartDistance;
        setMapScale(pinchStartScale * scaleFactor, true);
      }

      return;
    }

    if (pointers.length === 1 && mapScale > 1) {
      mapTranslateX = dragStartTranslateX + (event.clientX - dragStartPointerX);
      mapTranslateY = dragStartTranslateY + (event.clientY - dragStartPointerY);
      applyMapTransform();
    }
  });

  const endPointer = (event) => {
    mapPointers.delete(event.pointerId);

    const pointers = getPointersArray();

    if (pointers.length === 1) {
      dragStartPointerX = pointers[0].clientX;
      dragStartPointerY = pointers[0].clientY;
      dragStartTranslateX = mapTranslateX;
      dragStartTranslateY = mapTranslateY;
      pinchStartDistance = 0;
    }

    if (pointers.length === 0) {
      pinchStartDistance = 0;
    }
  };

  dom.mapFrameEl.addEventListener("pointerup", endPointer);
  dom.mapFrameEl.addEventListener("pointercancel", endPointer);
  dom.mapFrameEl.addEventListener("pointerleave", endPointer);
}

function bindMapSceneNavigation() {
  dom.mapPrevSceneBtnEl?.addEventListener("click", async () => {
    hideError();

    try {
      await openAdjacentScene(-1);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "Falhou ao abrir a cena anterior.");
    }
  });

  dom.mapNextSceneBtnEl?.addEventListener("click", async () => {
    hideError();

    try {
      await openAdjacentScene(1);
    } catch (error) {
      console.error(error);
      setLoading(false);
      showError(error.message || "Falhou ao abrir a próxima cena.");
    }
  });

  updateMapSceneNavUi();
}

function bindUi() {
  updatePlatformBadge();

  if (dom.controlsCardEl) {
    dom.controlsCardEl.classList.add("is-hidden");
  }

  if (dom.enterVrButtonEl) {
    dom.enterVrButtonEl.disabled = true;
  }

  bindAlignmentDebugUi();
  bindTourAndSceneSelectors();
  bindMapToggle();
  bindLeftCardCollapse();
  bindMapCardCollapse();
  bindMapPanZoom();
  bindMapSceneNavigation();

  populateTourSelect();
  populateSceneSelect();
}

async function bootstrap() {
  if (!dom.sceneEl) {
    throw new Error("A cena principal do A-Frame não foi encontrada.");
  }

  await waitForSceneReady(dom.sceneEl);

  platformInfo = await detectPlatform();

  bindStateEvents();
  bindUi();
  bindVrLifecycle();

  const initialTourPath = getInitialTourPath();
  const initialSceneId = getInitialSceneId();

  await openTour(initialTourPath, initialSceneId);
}

bootstrap().catch((error) => {
  console.error(error);
  setLoading(false);
  showError(error.message || "Deu ruim ao iniciar o player.", true);
});
