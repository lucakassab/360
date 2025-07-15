  // platforms/vr/vr_dbg_widget.js
  import * as THREE from '../../libs/three.module.js';

  const FONT_SIZE     = 24;
  const LINE_HEIGHT   = FONT_SIZE * 1.2;
  const MAX_LOG_LINES = 20;
  const CANVAS_WIDTH  = 512;
  const CANVAS_HEIGHT = LINE_HEIGHT * MAX_LOG_LINES + 100;
  const PLANE_SCALE   = 0.5;

  let canvas, ctx, texture, mesh;
  const logs = [];

  export function initDebugWidget(camera, scene) {
    canvas = document.createElement('canvas');
    canvas.width  = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');
    ctx.font = `${FONT_SIZE}px monospace`;
    ctx.textBaseline = 'top';
    drawBackground();

    texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
      depthTest: false
    });
    const width  = (CANVAS_WIDTH  / 128) * PLANE_SCALE;
    const height = (CANVAS_HEIGHT / 128) * PLANE_SCALE;
    const geometry = new THREE.PlaneGeometry(width, height);

    mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, -2.5);
    camera.add(mesh);

    window.addEventListener('keydown',             e => addLog(`KeyDown: ${e.key} code=${e.code}`));
    window.addEventListener('keyup',               e => addLog(`KeyUp:   ${e.key} code=${e.code}`));
    window.addEventListener('gamepadconnected',    e => addLog(`Gamepad connected: ${e.gamepad.id}`));
    window.addEventListener('gamepaddisconnected', e => addLog(`Gamepad disconnected: ${e.gamepad.id}`));
  }

  export function addLog(msg) {
    const lines = wrapText(msg, CANVAS_WIDTH - 20);
    lines.forEach(line => logs.push(line));
    while (logs.length > MAX_LOG_LINES) logs.shift();
    redraw();
  }

  export function getLogs() {
    return logs.slice();
  }

  function redraw() {
    drawBackground();
    ctx.fillStyle = '#0f0';
    logs.forEach((line, i) => {
      ctx.fillText(line, 10, 10 + i * LINE_HEIGHT);
    });
    texture.needsUpdate = true;
  }

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // torna o debug widget (canvas + mesh) visível/invisível
  export function toggleDebugWidget() {
    if (!mesh) return;
    mesh.visible = !mesh.visible;
  }