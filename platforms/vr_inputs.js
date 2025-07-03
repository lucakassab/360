// platforms/vr_inputs.js
const prevStates = new Map();

/**
 * Configura polling de inputs VR (controllers e hand-tracking).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object} handlers
 *   @param {Function} handlers.onNext      — botão A (idx 4)
 *   @param {Function} handlers.onPrev      — botão B (idx 5)
 *   @param {Function} handlers.onToggleHUD — stick-press (idx 2)
 *   @param {Function} handlers.onSnap      — snap-turn via eixos
 *   @param {Function} handlers.onDebugLog  — log de qualquer botão/index
 */
export function setupVRInputs(renderer, {
  onNext,
  onPrev,
  onToggleHUD,
  onSnap,
  onDebugLog
}) {
  function handleSession(session) {
    prevStates.clear();

    // Reconecta/desconecta fontes
    session.addEventListener('inputsourceschange', () => {
      prevStates.clear();
      session.inputSources.forEach(src => {
        if (src.hand) {
          onDebugLog(src.handedness, 'hand-connected');
        } else if (src.targetRayMode === 'tracked-pointer') {
          onDebugLog(src.handedness, 'controller-connected');
        }
      });
    });

    // Loop de polling
    function poll() {
      for (const src of session.inputSources) {
        // — HAND-TRACKING —
        if (src.hand && !src.gamepad) {
          const hid = `hand|${src.handedness}`;
          if (!prevStates.has(hid)) {
            onDebugLog(src.handedness, 'hand-detected');
            prevStates.set(hid, { seen: true });
          }
          continue;
        }

        // — GAMEPAD —
        const gp = src.gamepad;
        if (!gp) continue;

        const id = `${src.handedness}|${gp.id}`;
        let prev = prevStates.get(id) || {
          buttons: Array(gp.buttons.length).fill(false),
          _snapDone: false
        };

        // — BOTÕES —
        const curr = gp.buttons.map(b => b.pressed);
        curr.forEach((pressed, idx) => {
          if (pressed && !prev.buttons[idx]) {
            onDebugLog(src.handedness, idx);

            if (idx === 4) {
              onNext?.();       // A
            } else if (idx === 5) {
              onPrev?.();       // B
            } else if (idx === 3) {
              onToggleHUD?.();  // stick-press
            }
          }
        });

        // — SNAP-TURN via eixo X —
        // tenta eixo[2] (direito), senão eixo[0]
        const x = gp.axes[2] ?? gp.axes[0] ?? 0;
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          const dir = x > 0 ? 1 : -1;
          onSnap?.(src.handedness, dir);
          onDebugLog(src.handedness, `snap ${dir>0?'▶':'◀'}`);
          prev._snapDone = true;
        }

        // guarda para próxima iteração
        prev.buttons = curr;
        prevStates.set(id, prev);
      }

      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local')
      .then(() => session.requestAnimationFrame(poll));
  }

  // Se já estiver em VR
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  // Ao entrar em VR
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
