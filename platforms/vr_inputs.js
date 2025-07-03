// platforms/vr_inputs.js
const prevStates = new Map();
const SNAP_THRESHOLD = 0.7;

export function setupVRInputs(renderer, handlersOrNext, maybePrev, maybeDebugLog) {
  let onNext, onPrev, onToggleHUD, onSnap, onDebugLog;
  if (typeof handlersOrNext === 'function') {
    onNext      = handlersOrNext;
    onPrev      = maybePrev;
    onToggleHUD = () => {};
    onSnap      = () => {};
    onDebugLog  = maybeDebugLog;
  } else {
    ({ onNext, onPrev, onToggleHUD, onSnap, onDebugLog } = handlersOrNext);
  }

  function handleSession(session) {
    prevStates.clear();
    session.addEventListener('inputsourceschange', () => prevStates.clear());

    function poll() {
      for (const src of session.inputSources) {
        const gp = src.gamepad;
        if (!gp) continue;

        const isHand = !!src.hand;
        const sourceLabel = isHand
          ? `hand-${src.handedness}`
          : `controller-${src.handedness}`;
        const id = `${sourceLabel}|${gp.id}`;

        const prev = prevStates.get(id) || { buttons: [], _snapDone: false };

        // ———— Botões ————
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed && !prev.buttons[idx]) {
            onDebugLog && onDebugLog(sourceLabel, idx);
            if (idx === 4) onNext      && onNext();      // A
            if (idx === 5) onPrev      && onPrev();      // B
            if (idx === 3) onToggleHUD && onToggleHUD(); // stick click
          }
        });

        // ———— Snap turn ————
        const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
        if (Math.abs(x) < SNAP_THRESHOLD) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(sourceLabel, dir);
          prev._snapDone = true;
        }

        // Atualiza estado (botões + flag)
        prev.buttons = gp.buttons.map(b => b.pressed);
        prevStates.set(id, prev);
      }
      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local')
      .then(() => session.requestAnimationFrame(poll));
  }

  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
