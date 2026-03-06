const AFRAME = window.AFRAME;

console.log("[drag-look] módulo drag_look_controls.js carregado");

if (AFRAME && !AFRAME.components["drag-look-controls"]) {
  const THREE = AFRAME.THREE;

  AFRAME.registerComponent("drag-look-controls", {
    schema: {
      enabled: { default: true },
      sensitivity: { type: "number", default: 0.14 },
      invertX: { default: false },
      invertY: { default: false },
      pitchMin: { type: "number", default: -85 },
      pitchMax: { type: "number", default: 85 },
      pitchTarget: { type: "string", default: "" },
      cameraTarget: { type: "string", default: "#main-camera" },
      dragThreshold: { type: "number", default: 6 },
      debug: { default: true },
    },

    init() {
      this.activePointerId = null;
      this.pointerIsDown = false;
      this.isDragging = false;

      this.lastClientX = 0;
      this.lastClientY = 0;
      this.startClientX = 0;
      this.startClientY = 0;

      this.yawDeg = 0;
      this.pitchDeg = 0;

      this.yawTargetEl = null;
      this.pitchTargetEl = null;
      this.cameraTargetEl = null;
      this.sourceEl = null;

      this.attach = this.attach.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);

      this.log("init do componente");

      if (this.el.sceneEl?.hasLoaded) {
        this.attach();
      } else {
        this.el.sceneEl?.addEventListener("loaded", this.attach, { once: true });
      }
    },

    tick() {
      if (!this.yawTargetEl || !this.pitchTargetEl) {
        return;
      }

      // garante zero roll / zero sujeira residual
      this.yawTargetEl.object3D.rotation.x = 0;
      this.yawTargetEl.object3D.rotation.z = 0;

      this.pitchTargetEl.object3D.rotation.y = 0;
      this.pitchTargetEl.object3D.rotation.z = 0;

      if (this.cameraTargetEl) {
        this.cameraTargetEl.object3D.rotation.x = 0;
        this.cameraTargetEl.object3D.rotation.y = 0;
        this.cameraTargetEl.object3D.rotation.z = 0;
      }
    },

    log(...args) {
      if (!this.data.debug) return;
      console.log("[drag-look]", ...args);
    },

    resolveTargets() {
      this.yawTargetEl = this.el;
      this.pitchTargetEl = this.data.pitchTarget
        ? document.querySelector(this.data.pitchTarget)
        : this.el;
      this.cameraTargetEl = this.data.cameraTarget
        ? document.querySelector(this.data.cameraTarget)
        : null;

      if (!this.yawTargetEl || !this.pitchTargetEl) {
        this.log("falha ao resolver targets", {
          yawTargetEl: this.yawTargetEl,
          pitchTargetEl: this.pitchTargetEl,
          cameraTargetEl: this.cameraTargetEl,
          pitchTargetSelector: this.data.pitchTarget,
          cameraTargetSelector: this.data.cameraTarget,
        });
        return false;
      }

      this.yawDeg = THREE.MathUtils.radToDeg(
        this.yawTargetEl.object3D.rotation.y || 0
      );

      this.pitchDeg = THREE.MathUtils.radToDeg(
        this.pitchTargetEl.object3D.rotation.x || 0
      );

      this.log("targets resolvidos", {
        yawTargetEl: this.yawTargetEl,
        pitchTargetEl: this.pitchTargetEl,
        cameraTargetEl: this.cameraTargetEl,
        yawDeg: this.yawDeg,
        pitchDeg: this.pitchDeg,
      });

      return true;
    },

    attach() {
      const sceneEl = this.el.sceneEl;
      const sourceEl = sceneEl?.canvas || sceneEl;

      if (!sourceEl) {
        requestAnimationFrame(this.attach);
        return;
      }

      if (!this.resolveTargets()) {
        requestAnimationFrame(this.attach);
        return;
      }

      this.sourceEl = sourceEl;
      this.sourceEl.style.touchAction = "none";

      this.sourceEl.addEventListener("pointerdown", this.onPointerDown, {
        passive: false,
      });
      window.addEventListener("pointermove", this.onPointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", this.onPointerUp, {
        passive: false,
      });
      window.addEventListener("pointercancel", this.onPointerUp, {
        passive: false,
      });

      this.log("listeners registrados");
    },

    remove() {
      if (this.sourceEl) {
        this.sourceEl.removeEventListener("pointerdown", this.onPointerDown);
      }

      window.removeEventListener("pointermove", this.onPointerMove);
      window.removeEventListener("pointerup", this.onPointerUp);
      window.removeEventListener("pointercancel", this.onPointerUp);
    },

    applyRotation() {
      const yawRad = THREE.MathUtils.degToRad(this.yawDeg);
      const pitchRad = THREE.MathUtils.degToRad(this.pitchDeg);

      // yaw só no rig
      this.yawTargetEl.object3D.rotation.x = 0;
      this.yawTargetEl.object3D.rotation.y = yawRad;
      this.yawTargetEl.object3D.rotation.z = 0;
      this.yawTargetEl.setAttribute("rotation", `0 ${this.yawDeg} 0`);

      // pitch só no wrapper
      this.pitchTargetEl.object3D.rotation.x = pitchRad;
      this.pitchTargetEl.object3D.rotation.y = 0;
      this.pitchTargetEl.object3D.rotation.z = 0;
      this.pitchTargetEl.setAttribute("rotation", `${this.pitchDeg} 0 0`);

      // câmera neutra
      if (this.cameraTargetEl) {
        this.cameraTargetEl.object3D.rotation.x = 0;
        this.cameraTargetEl.object3D.rotation.y = 0;
        this.cameraTargetEl.object3D.rotation.z = 0;
        this.cameraTargetEl.setAttribute("rotation", "0 0 0");
      }
    },

    onPointerDown(event) {
      if (!this.data.enabled) return;
      if (this.el.sceneEl?.is("vr-mode")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      this.pointerIsDown = true;
      this.isDragging = false;
      this.activePointerId = event.pointerId;

      this.startClientX = event.clientX;
      this.startClientY = event.clientY;
      this.lastClientX = event.clientX;
      this.lastClientY = event.clientY;

      this.log("pointerdown", {
        pointerType: event.pointerType,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      });

      // NÃO bloquear aqui, senão mata o click do hotspot
    },

    onPointerMove(event) {
      if (!this.pointerIsDown) return;
      if (event.pointerId !== this.activePointerId) return;

      const totalDx = event.clientX - this.startClientX;
      const totalDy = event.clientY - this.startClientY;
      const totalDist = Math.hypot(totalDx, totalDy);

      // só vira drag depois de passar do limiar
      if (!this.isDragging) {
        if (totalDist < this.data.dragThreshold) {
          return;
        }

        this.isDragging = true;
        this.sourceEl?.setPointerCapture?.(event.pointerId);

        this.log("drag habilitado", {
          pointerId: event.pointerId,
          totalDx,
          totalDy,
          totalDist,
          threshold: this.data.dragThreshold,
        });
      }

      const dx = event.clientX - this.lastClientX;
      const dy = event.clientY - this.lastClientY;

      this.lastClientX = event.clientX;
      this.lastClientY = event.clientY;

      const sx = this.data.invertX ? 1 : -1;
      const sy = this.data.invertY ? 1 : -1;

      this.yawDeg += dx * this.data.sensitivity * sx;
      this.pitchDeg += dy * this.data.sensitivity * sy;

      this.pitchDeg = THREE.MathUtils.clamp(
        this.pitchDeg,
        this.data.pitchMin,
        this.data.pitchMax
      );

      this.applyRotation();

      this.log("drag move", {
        dx,
        dy,
        yawDeg: this.yawDeg,
        pitchDeg: this.pitchDeg,
      });

      // só previne quando realmente virou drag
      event.preventDefault();
    },

    onPointerUp(event) {
      if (event.pointerId !== this.activePointerId) return;

      if (this.isDragging) {
        this.log("drag finalizado");
      } else {
        this.log("pointerup sem drag, click liberado para hotspot");
      }

      this.pointerIsDown = false;
      this.isDragging = false;
      this.activePointerId = null;
    },
  });

  console.log("[drag-look] componente registrado");
} else if (!AFRAME) {
  console.warn("[drag-look] window.AFRAME não existe");
} else {
  console.log("[drag-look] componente já estava registrado");
}

export {};