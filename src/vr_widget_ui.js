const DROPDOWN_TEXT_SCALE = 1.3275; // 75% de 1.77
const DROPDOWN_TEXT_PADDING_LEFT = 0.05;
const DROPDOWN_TEXT_MIN_SHRINK = 0.52;
const DROPDOWN_TEXT_SHRINK_START = 26;
const DROPDOWN_TEXT_SHRINK_FULL = 92;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setAttrs(el, attrs = {}) {
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

function createEntity(tagName = "a-entity", attrs = {}) {
  const el = document.createElement(tagName);
  return setAttrs(el, attrs);
}

function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function registerRoundedRectGeometry() {
  if (!window.AFRAME) {
    return;
  }

  if (window.AFRAME.geometries?.["rounded-rect"]) {
    return;
  }

  const THREE = window.AFRAME.THREE;

  window.AFRAME.registerGeometry("rounded-rect", {
    schema: {
      width: { default: 1 },
      height: { default: 1 },
      radius: { default: 0.06 },
      segments: { default: 8 },
    },

    init(data) {
      const w = Math.max(0.001, Number(data.width) || 1);
      const h = Math.max(0.001, Number(data.height) || 1);
      const r = Math.min(
        Math.max(0, Number(data.radius) || 0),
        w * 0.5,
        h * 0.5
      );

      const hw = w * 0.5;
      const hh = h * 0.5;

      const shape = new THREE.Shape();

      shape.moveTo(-hw + r, hh);
      shape.lineTo(hw - r, hh);
      shape.quadraticCurveTo(hw, hh, hw, hh - r);

      shape.lineTo(hw, -hh + r);
      shape.quadraticCurveTo(hw, -hh, hw - r, -hh);

      shape.lineTo(-hw + r, -hh);
      shape.quadraticCurveTo(-hw, -hh, -hw, -hh + r);

      shape.lineTo(-hw, hh - r);
      shape.quadraticCurveTo(-hw, hh, -hw + r, hh);

      this.geometry = new THREE.ShapeGeometry(shape, Number(data.segments) || 8);
    },
  });
}

function createText({
  value = "",
  color = "#F8FAFC",
  width = 1,
  align = "left",
  anchor = "left",
  baseline = "center",
  position = "0 0 0",
  wrapCount = 64,
  opacity = 1,
} = {}) {
  return createEntity("a-text", {
    value,
    color,
    width,
    align,
    anchor,
    baseline,
    position,
    "wrap-count": wrapCount,
    opacity,
    side: "double",
  });
}

function createDivider({
  width = 1,
  position = "0 0 0",
  color = "#334155",
  opacity = 0.18,
} = {}) {
  return createEntity("a-plane", {
    width,
    height: 0.004,
    color,
    opacity,
    transparent: true,
    shader: "flat",
    side: "double",
    position,
  });
}

function createSectionLabel(text, position) {
  return createText({
    value: text,
    color: "#CBD5E1",
    width: 1.6,
    align: "left",
    anchor: "left",
    baseline: "center",
    position,
    wrapCount: 28,
  });
}

function createRoundedRectEntity({
  width = 1,
  height = 0.2,
  radius = 0.04,
  color = "#111827",
  opacity = 1,
  position = "0 0 0",
  className = "",
} = {}) {
  return createEntity("a-entity", {
    geometry: {
      primitive: "rounded-rect",
      width,
      height,
      radius,
      segments: 10,
    },
    material: {
      color,
      opacity,
      transparent: true,
      shader: "flat",
      side: "double",
    },
    position,
    class: className,
  });
}

function setRoundedRectSize(el, width, height, radius) {
  if (!el) return;
  const current = el.getAttribute("geometry") || {};
  el.setAttribute("geometry", {
    ...current,
    primitive: "rounded-rect",
    width,
    height,
    radius,
    segments: current.segments || 10,
  });
}

function setPlaneSize(el, width, height) {
  if (!el) return;
  el.setAttribute("width", width);
  el.setAttribute("height", height);
}

function estimateWidthFromText(text = "", base = 1.3) {
  const safe = String(text || "").trim();
  if (!safe) return base;
  const len = safe.length;
  return Math.max(base, 0.58 + len * 0.022);
}

function getDropdownTextShrink(text = "") {
  const len = String(text || "").trim().length;

  if (len <= DROPDOWN_TEXT_SHRINK_START) {
    return 1;
  }

  const t = clampNumber(
    (len - DROPDOWN_TEXT_SHRINK_START) /
      (DROPDOWN_TEXT_SHRINK_FULL - DROPDOWN_TEXT_SHRINK_START),
    0,
    1
  );

  return 1 - (1 - DROPDOWN_TEXT_MIN_SHRINK) * t;
}

function getDropdownTextWidth(buttonWidth, text = "") {
  return buttonWidth * DROPDOWN_TEXT_SCALE * getDropdownTextShrink(text);
}

function createCardBlock({
  width,
  height,
  radius = 0.06,
  position = "0 0 0",
  bgColor = "#111827",
  bgOpacity = 0.95,
  borderColor = "#334155",
  borderOpacity = 0.22,
  shadowOpacity = 0.10,
} = {}) {
  const wrapper = createEntity("a-entity", { position });

  const shadow = createRoundedRectEntity({
    width: width + 0.028,
    height: height + 0.028,
    radius: radius + 0.012,
    color: "#000000",
    opacity: shadowOpacity,
    position: "0 0 -0.003",
  });

  const border = createRoundedRectEntity({
    width: width + 0.010,
    height: height + 0.010,
    radius: radius + 0.006,
    color: borderColor,
    opacity: borderOpacity,
    position: "0 0 -0.001",
  });

  const bg = createRoundedRectEntity({
    width,
    height,
    radius,
    color: bgColor,
    opacity: bgOpacity,
    position: "0 0 0",
  });

  wrapper.appendChild(shadow);
  wrapper.appendChild(border);
  wrapper.appendChild(bg);

  return { wrapper, shadow, border, bg };
}

function createPlaneButton({
  width = 1,
  height = 0.14,
  radius = 0.042,
  color = "#111827",
  opacity = 0.95,
  text = "",
  textWidth = 1.8,
  textColor = "#F8FAFC",
  textAlign = "left",
  textAnchor = "left",
  textPosition = null,
  className = "vr-ui-clickable",
} = {}) {
  const buttonWrap = createEntity("a-entity");

  const shadow = createRoundedRectEntity({
    width: width + 0.022,
    height: height + 0.022,
    radius: radius + 0.01,
    color: "#000000",
    opacity: 0.08,
    position: "0 0 -0.003",
  });

  const border = createRoundedRectEntity({
    width: width + 0.008,
    height: height + 0.008,
    radius: radius + 0.005,
    color: "#334155",
    opacity: 0.20,
    position: "0 0 -0.001",
  });

  const buttonEl = createRoundedRectEntity({
    width,
    height,
    radius,
    color,
    opacity,
    className,
    position: "0 0 0",
  });

  const labelEl = createText({
    value: text,
    color: textColor,
    width: textWidth,
    align: textAlign,
    anchor: textAnchor,
    baseline: "center",
    position:
      textPosition ||
      `${-width * 0.5 + DROPDOWN_TEXT_PADDING_LEFT} 0 0.002`,
    wrapCount: 64,
  });

  buttonEl.appendChild(labelEl);
  buttonWrap.appendChild(shadow);
  buttonWrap.appendChild(border);
  buttonWrap.appendChild(buttonEl);

  return {
    buttonWrap,
    buttonEl,
    labelEl,
    border,
    shadow,
  };
}

export class VRWidgetUI {
  constructor({ sceneEl }) {
    if (!sceneEl) {
      throw new Error("VRWidgetUI precisa de sceneEl.");
    }

    registerRoundedRectGeometry();

    this.sceneEl = sceneEl;
    this.rootEl = null;

    this.panelWidth = 1.30;
    this.panelMinWidth = 1.30;
    this.panelMaxWidth = 1.95;
    this.panelHeight = 1.68;
    this.panelRadius = 0.08;
    this.contentPaddingX = 0.13;

    this.tourValue = "Selecionar tour";
    this.sceneValue = "Selecionar cena";
    this.mapTitleValue = "Cena atual";

    this.tourButtonEl = null;
    this.tourButtonWrap = null;
    this.tourButtonBorder = null;
    this.tourButtonShadow = null;
    this.tourValueTextEl = null;
    this.tourChevronEl = null;

    this.sceneButtonEl = null;
    this.sceneButtonWrap = null;
    this.sceneButtonBorder = null;
    this.sceneButtonShadow = null;
    this.sceneValueTextEl = null;
    this.sceneChevronEl = null;

    this.tourDropdownEl = null;
    this.sceneDropdownEl = null;

    this.mapCard = null;
    this.mapCardShadow = null;
    this.mapCardBorder = null;
    this.mapCardBg = null;

    this.panelShadow = null;
    this.panelBorder = null;
    this.panelBg = null;
    this.titleEl = null;
    this.subtitleEl = null;
    this.headerDivider = null;
    this.middleDivider = null;
    this.tourLabelEl = null;
    this.sceneLabelEl = null;
    this.mapLabelEl = null;

    this.mapTitleTextEl = null;
    this.mapImageEl = null;
    this.mapEmptyTextEl = null;

    this.dropdownItemRefs = {
      tour: [],
      scene: [],
    };

    this.dropdownState = {
      tour: [],
      scene: [],
    };

    this.mapMaxWidth = 0.92;
    this.mapMaxHeight = 0.28;
    this.mapLoadToken = 0;

    this.build();
  }

  build() {
    this.rootEl = createEntity("a-entity", {
      id: "vr-widget-root",
      visible: false,
    });

    this.panelShadow = createRoundedRectEntity({
      width: this.panelWidth + 0.06,
      height: this.panelHeight + 0.06,
      radius: this.panelRadius + 0.03,
      color: "#000000",
      opacity: 0.16,
      position: "0 0 -0.004",
    });

    this.panelBorder = createRoundedRectEntity({
      width: this.panelWidth + 0.014,
      height: this.panelHeight + 0.014,
      radius: this.panelRadius + 0.01,
      color: "#334155",
      opacity: 0.24,
      position: "0 0 -0.001",
    });

    this.panelBg = createRoundedRectEntity({
      width: this.panelWidth,
      height: this.panelHeight,
      radius: this.panelRadius,
      color: "#0B1220",
      opacity: 0.97,
      position: "0 0 0",
    });

    this.titleEl = createText({
      value: "Painel do Tour",
      color: "#F8FAFC",
      width: 1.8,
      align: "left",
      anchor: "left",
      baseline: "center",
      position: "0 0 0.003",
      wrapCount: 28,
    });

    this.subtitleEl = createText({
      value: "Thumbstick direito: mostrar / ocultar",
      color: "#94A3B8",
      width: 1.5,
      align: "left",
      anchor: "left",
      baseline: "center",
      position: "0 0 0.003",
      wrapCount: 50,
    });

    this.headerDivider = createDivider({
      width: this.panelWidth - this.contentPaddingX * 2,
      position: "0 0 0.003",
    });

    this.tourLabelEl = createSectionLabel("Tour", "0 0 0.003");
    this.sceneLabelEl = createSectionLabel("Cena", "0 0 0.003");
    this.mapLabelEl = createSectionLabel("Mapa / planta baixa", "0 0 0.003");

    const initialButtonWidth = 1.04;

    const {
      buttonWrap: tourButtonWrap,
      buttonEl: tourButtonEl,
      labelEl: tourValueTextEl,
      border: tourButtonBorder,
      shadow: tourButtonShadow,
    } = createPlaneButton({
      width: initialButtonWidth,
      height: 0.145,
      radius: 0.045,
      color: "#111827",
      opacity: 0.95,
      text: this.tourValue,
      textWidth: getDropdownTextWidth(initialButtonWidth, this.tourValue),
      textPosition: `${-initialButtonWidth * 0.5 + DROPDOWN_TEXT_PADDING_LEFT} 0 0.002`,
    });

    this.tourChevronEl = createText({
      value: "▾",
      color: "#CBD5E1",
      width: 0.5,
      align: "right",
      anchor: "right",
      baseline: "center",
      position: "0.45 0 0.002",
    });
    tourButtonEl.appendChild(this.tourChevronEl);

    const {
      buttonWrap: sceneButtonWrap,
      buttonEl: sceneButtonEl,
      labelEl: sceneValueTextEl,
      border: sceneButtonBorder,
      shadow: sceneButtonShadow,
    } = createPlaneButton({
      width: initialButtonWidth,
      height: 0.145,
      radius: 0.045,
      color: "#111827",
      opacity: 0.95,
      text: this.sceneValue,
      textWidth: getDropdownTextWidth(initialButtonWidth, this.sceneValue),
      textPosition: `${-initialButtonWidth * 0.5 + DROPDOWN_TEXT_PADDING_LEFT} 0 0.002`,
    });

    this.sceneChevronEl = createText({
      value: "▾",
      color: "#CBD5E1",
      width: 0.5,
      align: "right",
      anchor: "right",
      baseline: "center",
      position: "0.45 0 0.002",
    });
    sceneButtonEl.appendChild(this.sceneChevronEl);

    this.tourButtonWrap = tourButtonWrap;
    this.tourButtonEl = tourButtonEl;
    this.tourButtonBorder = tourButtonBorder;
    this.tourButtonShadow = tourButtonShadow;
    this.tourValueTextEl = tourValueTextEl;

    this.sceneButtonWrap = sceneButtonWrap;
    this.sceneButtonEl = sceneButtonEl;
    this.sceneButtonBorder = sceneButtonBorder;
    this.sceneButtonShadow = sceneButtonShadow;
    this.sceneValueTextEl = sceneValueTextEl;

    this.tourDropdownEl = createEntity("a-entity", {
      visible: false,
      position: "0 0.22 0.010",
    });

    this.sceneDropdownEl = createEntity("a-entity", {
      visible: false,
      position: "0 -0.06 0.010",
    });

    this.middleDivider = createDivider({
      width: this.panelWidth - this.contentPaddingX * 2,
      position: "0 -0.03 0.003",
    });

    const mapCardParts = createCardBlock({
      width: 1.04,
      height: 0.56,
      radius: 0.055,
      position: "0 -0.45 0.002",
      bgColor: "#111827",
      bgOpacity: 0.96,
      borderColor: "#334155",
      borderOpacity: 0.22,
    });

    this.mapCard = mapCardParts.wrapper;
    this.mapCardShadow = mapCardParts.shadow;
    this.mapCardBorder = mapCardParts.border;
    this.mapCardBg = mapCardParts.bg;

    this.mapImageEl = createEntity("a-plane", {
      width: this.mapMaxWidth,
      height: this.mapMaxHeight,
      visible: false,
      position: "0 -0.40 0.004",
      material: {
        shader: "flat",
        transparent: true,
        side: "double",
        color: "#FFFFFF",
        opacity: 1,
      },
    });

    this.mapEmptyTextEl = createText({
      value: "Mapa indisponível",
      color: "#64748B",
      width: 1.0,
      align: "center",
      anchor: "center",
      baseline: "center",
      position: "0 -0.40 0.004",
      wrapCount: 24,
    });

    this.mapTitleTextEl = createText({
      value: this.mapTitleValue,
      color: "#E2E8F0",
      width: 1.12,
      align: "center",
      anchor: "center",
      baseline: "center",
      position: "0 -0.67 0.004",
      wrapCount: 30,
    });

    this.rootEl.appendChild(this.panelShadow);
    this.rootEl.appendChild(this.panelBorder);
    this.rootEl.appendChild(this.panelBg);

    this.rootEl.appendChild(this.titleEl);
    this.rootEl.appendChild(this.subtitleEl);
    this.rootEl.appendChild(this.headerDivider);

    this.rootEl.appendChild(this.tourLabelEl);
    this.rootEl.appendChild(this.tourButtonWrap);
    this.rootEl.appendChild(this.tourDropdownEl);

    this.rootEl.appendChild(this.sceneLabelEl);
    this.rootEl.appendChild(this.sceneButtonWrap);
    this.rootEl.appendChild(this.sceneDropdownEl);

    this.rootEl.appendChild(this.middleDivider);

    this.rootEl.appendChild(this.mapLabelEl);
    this.rootEl.appendChild(this.mapCard);
    this.rootEl.appendChild(this.mapImageEl);
    this.rootEl.appendChild(this.mapEmptyTextEl);
    this.rootEl.appendChild(this.mapTitleTextEl);

    this.sceneEl.appendChild(this.rootEl);

    this.updateLayoutDimensions();
  }

  destroy() {
    if (this.rootEl?.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
  }

  setVisible(visible) {
    this.rootEl?.setAttribute("visible", !!visible);
  }

  setPose(positionVec3, yawRad) {
    if (!this.rootEl?.object3D) {
      return;
    }

    this.rootEl.object3D.position.copy(positionVec3);
    this.rootEl.object3D.rotation.set(0, yawRad, 0);
  }

  computePanelWidth() {
    let desired = this.panelMinWidth;

    desired = Math.max(desired, estimateWidthFromText(this.tourValue, 1.30));
    desired = Math.max(desired, estimateWidthFromText(this.sceneValue, 1.30));
    desired = Math.max(desired, estimateWidthFromText(this.mapTitleValue, 1.24));

    const allDropdownItems = [
      ...this.dropdownState.tour,
      ...this.dropdownState.scene,
    ];

    allDropdownItems.forEach((item) => {
      desired = Math.max(desired, estimateWidthFromText(item.label, 1.30));
    });

    desired += 0.30;

    return Math.min(this.panelMaxWidth, Math.max(this.panelMinWidth, desired));
  }

  updateLayoutDimensions() {
    this.panelWidth = this.computePanelWidth();

    const leftX = -this.panelWidth * 0.5 + this.contentPaddingX;
    const dividerWidth = this.panelWidth - this.contentPaddingX * 2;
    const buttonWidth = this.panelWidth - this.contentPaddingX * 2;
    const buttonHeight = 0.145;
    const buttonRadius = 0.045;

    const mapCardWidth = buttonWidth;
    const mapCardHeight = 0.56;

    this.mapMaxWidth = mapCardWidth - 0.14;
    this.mapMaxHeight = 0.28;

    setRoundedRectSize(
      this.panelShadow,
      this.panelWidth + 0.06,
      this.panelHeight + 0.06,
      this.panelRadius + 0.03
    );
    setRoundedRectSize(
      this.panelBorder,
      this.panelWidth + 0.014,
      this.panelHeight + 0.014,
      this.panelRadius + 0.01
    );
    setRoundedRectSize(
      this.panelBg,
      this.panelWidth,
      this.panelHeight,
      this.panelRadius
    );

    this.titleEl.setAttribute("position", `${leftX} 0.73 0.003`);
    this.subtitleEl.setAttribute("position", `${leftX} 0.65 0.003`);
    this.headerDivider.setAttribute("width", dividerWidth);
    this.headerDivider.setAttribute("position", `0 0.55 0.003`);

    this.tourLabelEl.setAttribute("position", `${leftX} 0.45 0.003`);
    this.sceneLabelEl.setAttribute("position", `${leftX} 0.17 0.003`);
    this.mapLabelEl.setAttribute("position", `${leftX} -0.08 0.003`);

    this.tourButtonWrap.setAttribute("position", "0 0.32 0.003");
    setRoundedRectSize(this.tourButtonShadow, buttonWidth + 0.022, buttonHeight + 0.022, buttonRadius + 0.01);
    setRoundedRectSize(this.tourButtonBorder, buttonWidth + 0.008, buttonHeight + 0.008, buttonRadius + 0.005);
    setRoundedRectSize(this.tourButtonEl, buttonWidth, buttonHeight, buttonRadius);
    this.tourValueTextEl.setAttribute("width", getDropdownTextWidth(buttonWidth, this.tourValue));
    this.tourValueTextEl.setAttribute("position", `${-buttonWidth * 0.5 + DROPDOWN_TEXT_PADDING_LEFT} 0 0.002`);
    this.tourChevronEl.setAttribute("position", `${buttonWidth * 0.5 - 0.05} 0 0.002`);

    this.sceneButtonWrap.setAttribute("position", "0 0.04 0.003");
    setRoundedRectSize(this.sceneButtonShadow, buttonWidth + 0.022, buttonHeight + 0.022, buttonRadius + 0.01);
    setRoundedRectSize(this.sceneButtonBorder, buttonWidth + 0.008, buttonHeight + 0.008, buttonRadius + 0.005);
    setRoundedRectSize(this.sceneButtonEl, buttonWidth, buttonHeight, buttonRadius);
    this.sceneValueTextEl.setAttribute("width", getDropdownTextWidth(buttonWidth, this.sceneValue));
    this.sceneValueTextEl.setAttribute("position", `${-buttonWidth * 0.5 + DROPDOWN_TEXT_PADDING_LEFT} 0 0.002`);
    this.sceneChevronEl.setAttribute("position", `${buttonWidth * 0.5 - 0.05} 0 0.002`);

    this.middleDivider.setAttribute("width", dividerWidth);
    this.middleDivider.setAttribute("position", `0 -0.03 0.003`);

    this.mapCard.setAttribute("position", "0 -0.45 0.002");
    setRoundedRectSize(this.mapCardShadow, mapCardWidth + 0.028, mapCardHeight + 0.028, 0.055 + 0.012);
    setRoundedRectSize(this.mapCardBorder, mapCardWidth + 0.010, mapCardHeight + 0.010, 0.055 + 0.006);
    setRoundedRectSize(this.mapCardBg, mapCardWidth, mapCardHeight, 0.055);

    this.mapImageEl.setAttribute("position", "0 -0.40 0.004");
    this.mapEmptyTextEl.setAttribute("position", "0 -0.40 0.004");
    this.mapTitleTextEl.setAttribute("position", "0 -0.67 0.004");

    if (!this.mapImageEl.getAttribute("visible")) {
      setPlaneSize(this.mapImageEl, this.mapMaxWidth, this.mapMaxHeight);
    }

    if (!this.tourDropdownEl.getAttribute("visible")) {
      this.tourDropdownEl.setAttribute("position", "0 0.22 0.010");
    }

    if (!this.sceneDropdownEl.getAttribute("visible")) {
      this.sceneDropdownEl.setAttribute("position", "0 -0.06 0.010");
    }
  }

  setTourValue(label) {
    this.tourValue = label || "Selecionar tour";
    if (this.tourValueTextEl) {
      this.tourValueTextEl.setAttribute("value", this.tourValue);
    }
    this.updateLayoutDimensions();
  }

  setSceneValue(label) {
    this.sceneValue = label || "Selecionar cena";
    if (this.sceneValueTextEl) {
      this.sceneValueTextEl.setAttribute("value", this.sceneValue);
    }
    this.updateLayoutDimensions();
  }

  async fitMapImageToContainer(src) {
    const loadToken = ++this.mapLoadToken;

    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        if (loadToken !== this.mapLoadToken) {
          resolve();
          return;
        }

        const naturalWidth = img.naturalWidth || 1;
        const naturalHeight = img.naturalHeight || 1;
        const aspect = naturalWidth / naturalHeight;

        let finalWidth = this.mapMaxWidth;
        let finalHeight = finalWidth / aspect;

        if (finalHeight > this.mapMaxHeight) {
          finalHeight = this.mapMaxHeight;
          finalWidth = finalHeight * aspect;
        }

        this.mapImageEl.setAttribute("width", finalWidth);
        this.mapImageEl.setAttribute("height", finalHeight);

        resolve();
      };

      img.onerror = () => {
        if (loadToken !== this.mapLoadToken) {
          resolve();
          return;
        }

        this.mapImageEl.setAttribute("width", this.mapMaxWidth);
        this.mapImageEl.setAttribute("height", this.mapMaxHeight);
        resolve();
      };

      img.src = src;
    });
  }

  async setMap({ src = "", title = "", rotationDeg = 0 } = {}) {
    this.mapTitleValue = title || "Mapa";

    if (this.mapTitleTextEl) {
      this.mapTitleTextEl.setAttribute("value", this.mapTitleValue);
    }

    this.updateLayoutDimensions();

    if (!src) {
      this.mapImageEl.setAttribute("visible", false);
      this.mapEmptyTextEl.setAttribute("visible", true);
      return;
    }

    await this.fitMapImageToContainer(src);

    this.mapImageEl.setAttribute("visible", true);
    this.mapImageEl.setAttribute("material", {
      src,
      shader: "flat",
      transparent: true,
      side: "double",
      color: "#FFFFFF",
      opacity: 1,
    });

    this.mapImageEl.setAttribute("rotation", `0 0 ${Number(rotationDeg || 0)}`);
    this.mapEmptyTextEl.setAttribute("visible", false);
  }

  hideAllDropdowns() {
    this.hideDropdown("tour");
    this.hideDropdown("scene");
  }

  hideDropdown(type) {
    const container = type === "tour" ? this.tourDropdownEl : this.sceneDropdownEl;
    if (!container) {
      return;
    }

    clearChildren(container);
    container.setAttribute("visible", false);
    this.dropdownItemRefs[type] = [];
    this.dropdownState[type] = [];
    this.updateLayoutDimensions();
  }

  renderDropdown(type, items = []) {
    const container = type === "tour" ? this.tourDropdownEl : this.sceneDropdownEl;
    if (!container) {
      return [];
    }

    this.dropdownState[type] = items.slice();
    this.updateLayoutDimensions();

    clearChildren(container);
    this.dropdownItemRefs[type] = [];

    if (!items.length) {
      container.setAttribute("visible", false);
      return [];
    }

    const rowHeight = 0.11;
    const itemHeight = 0.084;
    const totalHeight = Math.max(0.12, items.length * rowHeight + 0.045);

    const dropdownWidth = this.panelWidth - this.contentPaddingX * 2;

    const dropdownShadow = createRoundedRectEntity({
      width: dropdownWidth + 0.02,
      height: totalHeight + 0.03,
      radius: 0.05,
      color: "#000000",
      opacity: 0.12,
      position: `0 ${-totalHeight * 0.5 + 0.055} -0.003`,
    });

    const dropdownBorder = createRoundedRectEntity({
      width: dropdownWidth + 0.008,
      height: totalHeight + 0.014,
      radius: 0.045,
      color: "#334155",
      opacity: 0.22,
      position: `0 ${-totalHeight * 0.5 + 0.055} -0.001`,
    });

    const dropdownBg = createRoundedRectEntity({
      width: dropdownWidth,
      height: totalHeight,
      radius: 0.040,
      color: "#0F172A",
      opacity: 0.985,
      position: `0 ${-totalHeight * 0.5 + 0.055} 0`,
    });

    container.appendChild(dropdownShadow);
    container.appendChild(dropdownBorder);
    container.appendChild(dropdownBg);

    items.forEach((item, index) => {
      const y = -index * rowHeight;
      const itemButtonWidth = dropdownWidth - 0.08;

      const {
        buttonWrap,
        buttonEl,
        labelEl,
      } = createPlaneButton({
        width: itemButtonWidth,
        height: itemHeight,
        radius: 0.032,
        color: item.isActive ? "#1D4ED8" : "#111827",
        opacity: item.isActive ? 0.97 : 0.93,
        text: item.label,
        textWidth: getDropdownTextWidth(itemButtonWidth, item.label),
        textPosition: `${-itemButtonWidth * 0.5 + DROPDOWN_TEXT_PADDING_LEFT} 0 0.002`,
      });

      buttonWrap.setAttribute("position", `0 ${y} 0.003`);
      buttonEl.dataset.value = item.value;
      buttonEl.dataset.type = type;

      container.appendChild(buttonWrap);

      this.dropdownItemRefs[type].push({
        item,
        buttonEl,
        labelEl,
      });
    });

    container.setAttribute("visible", true);
    return this.dropdownItemRefs[type];
  }
}