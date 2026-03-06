const AFRAME = window.AFRAME;

console.log("[vr-lock] módulo vr_viewer_translation_lock.js carregado");

if (AFRAME && !AFRAME.components["vr-viewer-translation-lock"]) {
  const THREE = AFRAME.THREE;

  AFRAME.registerComponent("vr-viewer-translation-lock", {
    schema: {
      enabled: { default: false },
      worldTargets: {
        type: "string",
        default: "#panorama-root, #hotspot-root",
      },
      lockX: { default: true },
      lockY: { default: true },
      lockZ: { default: true },
      debug: { default: false },
    },

    init() {
      this.worldTargetEls = [];
      this.neutralWorldPositions = new Map();

      this.baseViewerWorldPosition = new THREE.Vector3();
      this.currentViewerWorldPosition = new THREE.Vector3();
      this.viewerWorldDelta = new THREE.Vector3();
      this.tempPosition = new THREE.Vector3();

      this.resolveWorldTargets = this.resolveWorldTargets.bind(this);
      this.captureBaseline = this.captureBaseline.bind(this);
      this.resetWorldPositions = this.resetWorldPositions.bind(this);

      this.resolveWorldTargets();
      this.captureBaseline();
    },

    update(oldData = {}) {
      if (oldData.worldTargets !== this.data.worldTargets) {
        this.resolveWorldTargets();
        this.captureBaseline();
      }

      if (oldData.enabled !== this.data.enabled) {
        this.resolveWorldTargets();

        if (this.data.enabled) {
          this.captureBaseline();
          this.resetWorldPositions();
          this.log("lock ativado: baseline capturada");
        } else {
          this.resetWorldPositions();
          this.log("lock desativado: roots restaurados");
        }
      }
    },

    log(...args) {
      if (!this.data.debug) {
        return;
      }

      console.log("[vr-lock]", ...args);
    },

    resolveWorldTargets() {
      const selectors = String(this.data.worldTargets || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.worldTargetEls = selectors
        .map((selector) => document.querySelector(selector))
        .filter(Boolean);

      this.log("worldTargets resolvidos", {
        selectors,
        count: this.worldTargetEls.length,
        elements: this.worldTargetEls,
      });
    },

    getViewerCamera() {
      return this.el.sceneEl?.camera || null;
    },

    captureBaseline() {
      this.resolveWorldTargets();
      this.neutralWorldPositions.clear();

      for (const el of this.worldTargetEls) {
        if (!el?.object3D) {
          continue;
        }

        this.neutralWorldPositions.set(el, el.object3D.position.clone());
      }

      const viewerCamera = this.getViewerCamera();

      if (viewerCamera) {
        viewerCamera.getWorldPosition(this.baseViewerWorldPosition);
      } else {
        this.baseViewerWorldPosition.set(0, 0, 0);
      }

      this.log("baseline capturada", {
        baseViewerWorldPosition: this.baseViewerWorldPosition.clone(),
        targets: this.neutralWorldPositions.size,
      });
    },

    resetWorldPositions() {
      for (const [el, pos] of this.neutralWorldPositions.entries()) {
        if (!el?.object3D) {
          continue;
        }

        el.object3D.position.copy(pos);
        el.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
      }
    },

    tick() {
      if (!this.data.enabled) {
        return;
      }

      if (!this.el.sceneEl?.is("vr-mode")) {
        return;
      }

      const viewerCamera = this.getViewerCamera();
      if (!viewerCamera) {
        return;
      }

      if (!this.worldTargetEls.length) {
        return;
      }

      viewerCamera.getWorldPosition(this.currentViewerWorldPosition);

      this.viewerWorldDelta
        .copy(this.currentViewerWorldPosition)
        .sub(this.baseViewerWorldPosition);

      if (!this.data.lockX) this.viewerWorldDelta.x = 0;
      if (!this.data.lockY) this.viewerWorldDelta.y = 0;
      if (!this.data.lockZ) this.viewerWorldDelta.z = 0;

      for (const [el, neutralPos] of this.neutralWorldPositions.entries()) {
        if (!el?.object3D) {
          continue;
        }

        // CORREÇÃO: o mundo acompanha o viewer no mesmo delta
        // para manter a relação visual entre viewer e panorama/hotspots.
        this.tempPosition.copy(neutralPos).add(this.viewerWorldDelta);

        el.object3D.position.copy(this.tempPosition);
        el.setAttribute(
          "position",
          `${this.tempPosition.x} ${this.tempPosition.y} ${this.tempPosition.z}`
        );
      }

      if (this.data.debug) {
        this.log("compensação aplicada", {
          baseViewerWorldPosition: this.baseViewerWorldPosition.clone(),
          currentViewerWorldPosition: this.currentViewerWorldPosition.clone(),
          viewerWorldDelta: this.viewerWorldDelta.clone(),
        });
      }
    },
  });

  console.log("[vr-lock] componente vr-viewer-translation-lock registrado");
}