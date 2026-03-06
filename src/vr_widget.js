import { resolveAssetPath } from "./tour_loader.js";
import { VRWidgetUI } from "./vr_widget_ui.js";

const THREE = window.AFRAME?.THREE;

function appendRaycasterSelector(entityEl, selector) {
  if (!entityEl) return;

  const current = entityEl.getAttribute("raycaster") || {};
  const objects = String(current.objects || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!objects.includes(selector)) {
    objects.push(selector);
  }

  entityEl.setAttribute("raycaster", {
    ...current,
    objects: objects.join(", "),
  });
}

function normalizeEvents(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  return String(value)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function ensureControllerCursor(entityEl) {
  if (!entityEl) return;

  const currentRaycaster = entityEl.getAttribute("raycaster") || {};
  const objects = String(currentRaycaster.objects || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  if (!objects.includes(".vr-ui-clickable")) {
    objects.push(".vr-ui-clickable");
  }

  entityEl.setAttribute("raycaster", {
    ...currentRaycaster,
    far: currentRaycaster.far || 200,
    showLine: true,
    lineColor: currentRaycaster.lineColor || "#93C5FD",
    lineOpacity:
      currentRaycaster.lineOpacity !== undefined
        ? currentRaycaster.lineOpacity
        : 0.95,
    objects: objects.join(", "),
  });
}

function uniqueTours(list = [], currentPath = "", currentName = "") {
  const seen = new Set();
  const result = [];

  list.forEach((t) => {
    const key = String(t?.path || "").trim();
    if (!key || seen.has(key)) return;

    seen.add(key);

    result.push({
      value: key,
      label: t.label || key,
    });
  });

  if (currentPath && !seen.has(currentPath)) {
    result.push({
      value: currentPath,
      label: currentName || currentPath,
    });
  }

  return result;
}

function getButtonVisual(buttonEl) {
  return {
    baseColor: buttonEl.dataset.baseColor || "#111827",
    baseOpacity: Number(buttonEl.dataset.baseOpacity || 0.94),
    hoverColor: buttonEl.dataset.hoverColor || "#1F2937",
    hoverOpacity: Number(buttonEl.dataset.hoverOpacity || 0.98),
    activeColor: buttonEl.dataset.activeColor || "#1D4ED8",
    activeOpacity: Number(buttonEl.dataset.activeOpacity || 0.98),
    pressedColor: buttonEl.dataset.pressedColor || "#2563EB",
    pressedOpacity: Number(buttonEl.dataset.pressedOpacity || 1),
  };
}

function applyButtonVisualState(buttonEl, state = "base") {
  if (!buttonEl) return;

  const visual = getButtonVisual(buttonEl);
  const isActive = buttonEl.dataset.isActive === "true";

  let color = isActive ? visual.activeColor : visual.baseColor;
  let opacity = isActive ? visual.activeOpacity : visual.baseOpacity;

  if (state === "hover") {
    color = isActive ? visual.activeColor : visual.hoverColor;
    opacity = isActive ? visual.activeOpacity : visual.hoverOpacity;
  }

  if (state === "pressed") {
    color = visual.pressedColor;
    opacity = visual.pressedOpacity;
  }

  const currentMaterial = buttonEl.getAttribute("material") || {};

  buttonEl.setAttribute("material", {
    ...currentMaterial,
    color,
    opacity,
    transparent: true,
    shader: "flat",
    side: "double",
  });
}

function markButtonInteractive(
  buttonEl,
  {
    isActive = false,
    baseColor = "#111827",
    baseOpacity = 0.94,
    hoverColor = "#1F2937",
    hoverOpacity = 0.98,
    activeColor = "#1D4ED8",
    activeOpacity = 0.98,
    pressedColor = "#2563EB",
    pressedOpacity = 1,
  } = {}
) {
  if (!buttonEl) return;

  buttonEl.dataset.baseColor = baseColor;
  buttonEl.dataset.baseOpacity = String(baseOpacity);
  buttonEl.dataset.hoverColor = hoverColor;
  buttonEl.dataset.hoverOpacity = String(hoverOpacity);
  buttonEl.dataset.activeColor = activeColor;
  buttonEl.dataset.activeOpacity = String(activeOpacity);
  buttonEl.dataset.pressedColor = pressedColor;
  buttonEl.dataset.pressedOpacity = String(pressedOpacity);
  buttonEl.dataset.isActive = isActive ? "true" : "false";

  applyButtonVisualState(buttonEl, "base");
}

function bindInteractiveButton(buttonEl, onActivate) {
  if (!buttonEl) return;

  if (buttonEl.__vrWidgetBound) {
    return;
  }
  buttonEl.__vrWidgetBound = true;

  let isPressed = false;

  const onEnter = () => {
    if (!isPressed) {
      applyButtonVisualState(buttonEl, "hover");
    }
  };

  const onLeave = () => {
    isPressed = false;
    applyButtonVisualState(buttonEl, "base");
  };

  const onDown = () => {
    isPressed = true;
    applyButtonVisualState(buttonEl, "pressed");
  };

  const onUp = () => {
    isPressed = false;
    applyButtonVisualState(buttonEl, "hover");
  };

  const onClick = async (event) => {
    event?.stopPropagation?.();
    isPressed = false;
    applyButtonVisualState(buttonEl, "hover");

    if (typeof onActivate === "function") {
      await onActivate(event);
    }
  };

  buttonEl.addEventListener("mouseenter", onEnter);
  buttonEl.addEventListener("mouseleave", onLeave);
  buttonEl.addEventListener("mousedown", onDown);
  buttonEl.addEventListener("mouseup", onUp);
  buttonEl.addEventListener("click", onClick);
}

export class VRWidget {
  constructor({
    sceneEl,
    state,
    availableTours = [],
    onTourChange,
    onSceneChange,
  }) {
    if (!sceneEl) {
      throw new Error("VRWidget precisa de sceneEl.");
    }

    if (!state) {
      throw new Error("VRWidget precisa de state.");
    }

    this.sceneEl = sceneEl;
    this.state = state;
    this.availableTours = availableTours;
    this.onTourChange = onTourChange;
    this.onSceneChange = onSceneChange;

    this.ui = new VRWidgetUI({ sceneEl });

    this.isVisible = false;
    this.openDropdown = null;

    this.leftHandEl = null;
    this.rightHandEl = null;

    this.onThumbstickDown = this.onThumbstickDown.bind(this);
    this.syncFromState = this.syncFromState.bind(this);

    this.bindRaycasters();
    this.bindControls();
    this.bindUi();
    this.syncFromState();
  }

  bindRaycasters() {
    this.leftHandEl = this.sceneEl.querySelector("#vr-left-hand");
    this.rightHandEl = this.sceneEl.querySelector("#vr-right-hand");

    ensureControllerCursor(this.leftHandEl);
    ensureControllerCursor(this.rightHandEl);

    appendRaycasterSelector(this.leftHandEl, ".vr-ui-clickable");
    appendRaycasterSelector(this.rightHandEl, ".vr-ui-clickable");
  }

  bindControls() {
    if (this.rightHandEl) {
      this.rightHandEl.addEventListener("thumbstickdown", this.onThumbstickDown);
    }

    if (typeof this.state.subscribe === "function") {
      this.state.subscribe("tourchange", this.syncFromState);
      this.state.subscribe("scenechange", this.syncFromState);
    }
  }

  bindUi() {
    markButtonInteractive(this.ui.tourButtonEl, {
      baseColor: "#111827",
      hoverColor: "#1F2937",
      pressedColor: "#2563EB",
    });

    markButtonInteractive(this.ui.sceneButtonEl, {
      baseColor: "#111827",
      hoverColor: "#1F2937",
      pressedColor: "#2563EB",
    });

    bindInteractiveButton(this.ui.tourButtonEl, async () => {
      if (!this.isVisible) return;

      if (this.openDropdown === "tour") {
        this.ui.hideDropdown("tour");
        this.openDropdown = null;
        return;
      }

      this.showTourDropdown();
    });

    bindInteractiveButton(this.ui.sceneButtonEl, async () => {
      if (!this.isVisible) return;

      if (this.openDropdown === "scene") {
        this.ui.hideDropdown("scene");
        this.openDropdown = null;
        return;
      }

      this.showSceneDropdown();
    });
  }

  destroy() {
    if (this.rightHandEl) {
      this.rightHandEl.removeEventListener("thumbstickdown", this.onThumbstickDown);
    }

    this.ui.destroy();
  }

  onThumbstickDown() {
    this.toggle();
  }

  toggle(force = null) {
    const next = force === null ? !this.isVisible : !!force;
    this.isVisible = next;

    if (!next) {
      this.ui.hideAllDropdowns();
      this.ui.setVisible(false);
      this.openDropdown = null;
      return;
    }

    this.placeInFrontOfViewer();
    this.syncFromState();
    this.ui.setVisible(true);
  }

  placeInFrontOfViewer() {
    const camera = this.sceneEl?.camera;
    if (!camera || !THREE) return;

    const viewerPos = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const widgetPos = new THREE.Vector3();

    camera.getWorldPosition(viewerPos);
    camera.getWorldDirection(forward);

    forward.y = 0;

    if (forward.lengthSq() < 0.000001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    widgetPos.copy(viewerPos).add(forward.multiplyScalar(1.6));
    widgetPos.y = viewerPos.y - 0.12;

    const yaw = Math.atan2(
      viewerPos.x - widgetPos.x,
      viewerPos.z - widgetPos.z
    );

    this.ui.setPose(widgetPos, yaw);
  }

  syncFromState() {
    const tourData = this.state.getTourData?.() || null;
    const scene = this.state.getCurrentScene?.() || null;
    const tourPath = this.state.getTourPath?.() || "";

    const tourLabel =
      this.availableTours.find((t) => t.path === tourPath)?.label ||
      tourData?.tourName ||
      tourPath ||
      "Selecionar tour";

    const sceneLabel =
      scene?.title || scene?.id || "Selecionar cena";

    this.ui.setTourValue(tourLabel);
    this.ui.setSceneValue(sceneLabel);

    const mapSrc = resolveAssetPath(
      tourData,
      tourPath,
      scene?.imageMap || ""
    );

    this.ui.setMap({
      src: mapSrc,
      title: scene?.title || scene?.id || "Mapa",
      rotationDeg: Number(scene?.mapRotation || 0),
    });

    if (this.openDropdown === "tour") {
      this.showTourDropdown();
    }

    if (this.openDropdown === "scene") {
      this.showSceneDropdown();
    }
  }

  showTourDropdown() {
    this.ui.hideDropdown("scene");

    const currentTourPath = this.state.getTourPath?.() || "";
    const currentTourName = this.state.getTourData?.()?.tourName || "";

    const items = uniqueTours(
      this.availableTours,
      currentTourPath,
      currentTourName
    ).map((item) => ({
      ...item,
      isActive: item.value === currentTourPath,
    }));

    const refs = this.ui.renderDropdown("tour", items);

    refs.forEach(({ item, buttonEl }) => {
      markButtonInteractive(buttonEl, {
        isActive: item.isActive,
        baseColor: "#111827",
        hoverColor: "#1F2937",
        activeColor: "#1D4ED8",
        pressedColor: "#2563EB",
      });

      bindInteractiveButton(buttonEl, async () => {
        this.ui.hideDropdown("tour");
        this.openDropdown = null;

        if (!item.value || item.value === currentTourPath) {
          return;
        }

        if (typeof this.onTourChange === "function") {
          await this.onTourChange(item.value);
        }
      });
    });

    this.openDropdown = "tour";
  }

  showSceneDropdown() {
    this.ui.hideDropdown("tour");

    const tourData = this.state.getTourData?.() || null;
    const currentScene = this.state.getCurrentScene?.() || null;
    const scenes = Array.isArray(tourData?.scenes) ? tourData.scenes : [];

    const refs = this.ui.renderDropdown(
      "scene",
      scenes.map((s) => ({
        value: s.id,
        label: s.title || s.id,
        isActive: s.id === currentScene?.id,
      }))
    );

    refs.forEach(({ item, buttonEl }) => {
      markButtonInteractive(buttonEl, {
        isActive: item.isActive,
        baseColor: "#111827",
        hoverColor: "#1F2937",
        activeColor: "#1D4ED8",
        pressedColor: "#2563EB",
      });

      bindInteractiveButton(buttonEl, async () => {
        this.ui.hideDropdown("scene");
        this.openDropdown = null;

        if (!item.value || item.value === currentScene?.id) {
          return;
        }

        if (typeof this.onSceneChange === "function") {
          await this.onSceneChange(item.value);
        }
      });
    });

    this.openDropdown = "scene";
  }
}

export function initVRWidget(opts) {
  return new VRWidget(opts);
}