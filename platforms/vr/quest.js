// platforms/vr/quest.js

import * as THREE from '../../libs/three.module.js';
import { XRControllerModelFactory } from '../../libs/XRControllerModelFactory.js';
import { XRHandModelFactory }       from '../../libs/XRHandModelFactory.js';
import { toggleDebugWidget } from '../vr/vr_dbg_widget.js';

const FINGER_MAP = {
  'index-finger-tip': 2,
  'middle-finger-tip': 3,
  'ring-finger-tip': 4,
  'pinky-finger-tip': 5,
  'thumb-tip': 1
};

export function initControllers({ renderer, scene, referenceSpace }) {
  const session        = renderer.xr.getSession();
  const ctrlFactory    = new XRControllerModelFactory();
  const handFactory    = new XRHandModelFactory();
  const controllers    = new Map();
  const AXIS_THRESHOLD = 0.05;

  // Polyfill para inputSources.filter
  if (session.inputSources && typeof session.inputSources.filter !== 'function') {
    session.inputSources.filter = cb => Array.from(session.inputSources).filter(cb);
  }

  // PINCH (select)
  session.addEventListener('selectstart', ev => {
    if (!ev.inputSource.hand) return;
    const h = ev.inputSource.handedness;
    const i = FINGER_MAP['index-finger-tip'];
    console.log(`[${h} hand] finger ${i} PINCHED`);
  });
  session.addEventListener('selectend', ev => {
    if (!ev.inputSource.hand) return;
    const h = ev.inputSource.handedness;
    const i = FINGER_MAP['index-finger-tip'];
    console.log(`[${h} hand] finger ${i} RELEASED`);
  });

  // WRIST BUTTON (squeeze)
  session.addEventListener('squeezestart', ev => {
    if (!ev.inputSource.hand) return;
    const h = ev.inputSource.handedness;
    console.log(`[${h} hand] wrist button DOWN`);
  });
  session.addEventListener('squeezeend', ev => {
    if (!ev.inputSource.hand) return;
    const h = ev.inputSource.handedness;
    console.log(`[${h} hand] wrist button UP`);
  });

  function registerSource(src) {
    try {
      if (controllers.has(src)) {
        const ent = controllers.get(src);
        if (ent.isHand && !ent.modelAdded) ent.tryAddModel();
        return;
      }

      const inputs = Array.from(session.inputSources);
      const idx    = inputs.indexOf(src);
      if (idx < 0) return;

      // === HAND TRACKING ===
      if (src.hand) {
        const handLabel = src.handedness || 'unknown';
        const handRoot  = renderer.xr.getHand(idx);
        scene.add(handRoot);
        console.log(`[${handLabel} hand] handRoot adicionado`);

        const ent = { source: src, isHand: true, modelAdded: false, tryAddModel: null };
        const tryAddModel = () => {
          try {
            const handModel = handFactory.createHandModel(handRoot, 'mesh');
            handRoot.add(handModel);
            console.log(`[${handLabel} hand] modelo de mão adicionado`);
            ent.modelAdded = true;
          } catch (err) {
            console.warn(`[${handLabel} hand] sem tracking ainda, retry…`, err);
            setTimeout(tryAddModel, 200);
          }
        };
        ent.tryAddModel = tryAddModel;
        tryAddModel();

        // Se houver gamepad na mão (botões extras)
        if (src.gamepad) {
          ent.gp = src.gamepad;
          ent.prevPressed = src.gamepad.buttons.map(b => b.pressed);
          ent.prevAxes    = src.gamepad.axes.slice();
          console.log(`[${handLabel} hand] gamepad em hand registrado`);
        }

        controllers.set(src, ent);
        return;
      }

      // === GAMEPAD CONTROLLER ===
      // Somente tracked-pointer (evita duplicar grip)
      if (src.gamepad && src.targetRayMode === 'tracked-pointer') {
        const gp   = src.gamepad;
        const hand = src.handedness || 'unknown';
        console.log(`[${hand}] controller registrado`);

        // grip + modelo
        try {
          const grip  = renderer.xr.getControllerGrip(idx);
          scene.add(grip);
          const model = ctrlFactory.createControllerModel(grip);
          grip.add(model);
          console.log(`[${hand}] modelo de grip adicionado`);
        } catch (err) {
          console.error(`[${hand}] gripModel erro:`, err);
        }

        // ray pointer
        try {
          const ctrl = renderer.xr.getController(idx);
          scene.add(ctrl);
          const pts = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
          ];
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x00ff00 })
          );
          line.scale.z = 5;
          ctrl.add(line);
        } catch (err) {
          console.error(`[${hand}] pointer erro:`, err);
        }

        controllers.set(src, {
          source: src,
          isHand: false,
          gp,
          prevPressed: gp.buttons.map(b => b.pressed),
          prevAxes:    gp.axes.slice()
        });
      }
    } catch (err) {
      console.error('registerSource geral erro:', err);
    }
  }

  // Conexões iniciais
  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    const hand = renderer.xr.getHand(i);

    ctrl.addEventListener('connected', ev => registerSource(ev.data));
    grip.addEventListener('connected', ev => registerSource(ev.data));
    hand.addEventListener('connected', ev => registerSource(ev.data));

    scene.add(ctrl);
    scene.add(grip);
    scene.add(hand);
  }

  session.addEventListener('inputsourceschange', evt => {
    evt.removed.forEach(rem => {
      if (controllers.has(rem)) {
        const h = rem.handedness || 'unknown';
        console.log(`[${h}] fonte removida`);
        controllers.delete(rem);
      }
    });
    evt.added.forEach(src => registerSource(src));
  });

  session.addEventListener('visibilitychange', () => {
    if (session.visibilityState === 'visible') {
      console.log('Sessão visível novamente → re-registrando fontes');
      session.inputSources.forEach(registerSource);
    }
  });

  // Monkey-patch do render pra gamepad polling, navegação e toggle do debug widget
  try {
    const _render = renderer.render.bind(renderer);
    renderer.render = (sceneArg, cameraArg) => {
      // Garante que novas fontes sejam registradas
      session.inputSources.forEach(src => registerSource(src));

      controllers.forEach(ent => {
        if (!ent.gp) return;
        const { source, gp, prevPressed, prevAxes } = ent;
        const h = source.handedness || 'unknown';

        // Processamento de botões
        gp.buttons.forEach((b, i) => {
          // Só on DOWN
          if (b.pressed && !prevPressed[i]) {
            const type = source.hand ? 'hand-button' : 'controller button';
            console.log(`[${h}] ${type} ${i} DOWN`);

            // ─── Navegação de mídia ───
            if (!source.hand) {
              // controles físicos
              if (i === 4) document.getElementById('next-btn').click();
              if (i === 5) document.getElementById('prev-btn').click();
            } else {
              // hand-tracking
              if (i === 0 && h === 'right') document.getElementById('next-btn').click();
              if (i === 0 && h === 'left')  document.getElementById('prev-btn').click();
            }

            // ─── Toggle do VR debug widget ───
            // botão 3 do controle
            if (!source.hand && i === 3) {
              toggleDebugWidget();
            }
            // botão 4 da mão esquerda
            if (source.hand && h === 'left' && i === 4) {
              toggleDebugWidget();
            }
          }
          // Atualiza estado para ignorar UP e repetidos
          prevPressed[i] = b.pressed;
        });

        // Processamento de eixos (opcional)
        gp.axes.forEach((ax, ai) => {
          if (Math.abs(ax - prevAxes[ai]) > AXIS_THRESHOLD) {
            console.log(`[${h}] Axis ${ai} = ${ax.toFixed(2)}`);
            prevAxes[ai] = ax;
          }
        });
      });

      // Chama o render original
      _render(sceneArg, cameraArg);
    };
  } catch (err) {
    console.error('Falha ao aplicar monkeypatch render:', err);
  }

}
