// platforms/vr_inputs.js
const prevStates = new Map();

export function setupVRInputs(renderer, handlersOrNext, maybePrev, maybeDebugLog) {
  let onNext, onPrev, onToggleHUD, onSnap, onDebugLog;
  if (typeof handlersOrNext === 'function') {
    onNext       = handlersOrNext;
    onPrev       = maybePrev;
    onToggleHUD  = () => {};
    onSnap       = () => {};
    onDebugLog   = maybeDebugLog;
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
        const id   = `${src.handedness}|${gp.id}`;
        const prev = prevStates.get(id) || { buttons: [], _snapDone: false };

        // Botões: A=4, B=5, stick click=3
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed && !prev.buttons[idx]) {
            onDebugLog && onDebugLog(src.handedness, idx);
            if (idx === 4) onNext      && onNext();      // A
            if (idx === 5) onPrev      && onPrev();      // B
            if (idx === 3) onToggleHUD && onToggleHUD(); // stick click
          }
        });

        // Snap turn via thumbstick (x do stick)
        const x = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
        if (Math.abs(x) < 0.7) {
          prev._snapDone = false;
        } else if (!prev._snapDone) {
          const dir = x > 0 ? 1 : -1;
          onSnap && onSnap(src.handedness, dir);
          prev._snapDone = true;
        }

        // Atualiza prevState completo (botões + flag)
        prev.buttons = gp.buttons.map(b => b.pressed);
        prevStates.set(id, prev);
      }
      session.requestAnimationFrame(poll);
    }

    session.requestReferenceSpace('local').then(() => session.requestAnimationFrame(poll));
  }

  if (renderer.xr.isPresenting) {
    handleSession(renderer.xr.getSession());
  }
  renderer.xr.addEventListener('sessionstart', () => {
    handleSession(renderer.xr.getSession());
  });
}
