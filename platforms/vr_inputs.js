// platforms/vr_inputs.js

const prevStates = new Map();

/**
 * Configura polling de inputs VR (controllers e hand-tracking).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {Object|Function} handlersOrNext
 *    - Se for função: apenas onNext (avançar mídia)
 *    - Se for objeto: { onNext, onPrev, onToggleHUD, onSnap, onDebugLog }
 * @param {Function} [maybePrev]       onPrev, se handlersOrNext for função
 * @param {Function} [maybeDebugLog]   onDebugLog, se handlersOrNext for função
 */
export function setupVRInputs(renderer, handlersOrNext, maybePrev, maybeDebugLog) {
  let onNext, onPrev, onToggleHUD, onSnap, onDebugLog;

  if (typeof handlersOrNext === 'function') {
    // assinatura antiga: (renderer, onNext, onPrev, onDebugLog)
    onNext      = handlersOrNext;
    onPrev      = maybePrev;
    onToggleHUD = () => {};
    onSnap      = () => {};
    onDebugLog  = maybeDebugLog;
  } else {
    // nova assinatura: (renderer, { onNext, onPrev, onToggleHUD, onSnap, onDebugLog })
    ({ onNext, onPrev, onToggleHUD, onSnap, onDebugLog } = handlersOrNext);
  }

  function handleSession(session) {
    prevStates.clear();

    // Quando mudar fontes (controller ↔ hand)
    session.addEventListener('inputsourceschange', () => {
      prevStates.clear();
      // Loga eventuais conexões de mão ou controller
      session.inputSources.forEach(src => {
        if (src.hand) {
          onDebugLog && onDebugLog(src.handedness, 'hand-connected');
        } else if (src.targetRayMode === 'tracked-pointer') {
          onDebugLog && onDebugLog(src.handedness, 'controller-connected');
        }
      });
    });

    function poll() {
      for (const src of session.inputSources) {
        // --- hand-tracking ---
        if (src.hand && !src.gamepad) {
          const hid = `hand|${src.handedness}`;
          if (!prevStates.has(hid)) {
            onDebugLog && onDebugLog(src.handedness, 'hand-detected');
            prevStates.set(hid, { seen: true });
          }
          continue;
        }

        const gp = src.gamepad;
        if (!gp) continue; // sem gamepad, já tratei hand acima

        const id = `${src.handedness}|${gp.id}`;
        let prev = prevStates.get(id);
        if (!prev) {
          // estado inicial: nenhum botão pressionado + snap liberado
          prev = { buttons: Array(gp.buttons.length).fill(false), _snapDone: false };
        }

        // --- botões ---
        const curr = gp.buttons.map(b => b.pressed);
        curr.forEach((pressed, idx) => {
          if (pressed && !prev.buttons[idx]) {
            // log genérico
            onDebugLog && onDebugLog(src.handedness, idx);
            // A e B
            if (idx === 4) onNext && onNext();
            if (idx === 5) onPrev && onPrev();
            // stick click (botão 3)
            if (idx === 3) onToggleHUD && onToggleHUD();
          }
        });

        // --- snap turn (eixo X do thumbstick) ---
        const x = gp.axes[0] || 0;  // eixo X principal
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        // atualiza estado para próxima iteração
        prev.buttons = curr;
        prevStates.set(id, prev);
      }

      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local').then(() => {
      session.requestAnimationFrame(poll);
    });
  }

  // já apresentando?
  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  // nova sessão
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
