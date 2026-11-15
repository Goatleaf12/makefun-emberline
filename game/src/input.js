// input.js — keyboard + pointer state; one-shot actions queued on keydown, never lost between frames.

export function makeInput(canvas) {
  const input = {
    keys: new Set(),
    queue: [], // one-shot actions, delivered once each
    pointer: { x: 0, y: 0, down: false, active: false },
    placeMode: false,
  };

  const ACTION_KEYS = {
    Space: 'confirm',
    Enter: 'confirm',
    KeyF: 'flare',
    KeyB: 'place',
    KeyP: 'pause',
    Escape: 'pause',
    KeyR: 'restart',
    KeyM: 'mute',
    Digit1: 'draft1',
    Digit2: 'draft2',
    Digit3: 'draft3',
    Digit4: 'draft4',
    Digit5: 'draft5',
    Digit6: 'draft6',
    Numpad1: 'draft1',
    Numpad2: 'draft2',
    Numpad3: 'draft3',
    Numpad4: 'draft4',
    Numpad5: 'draft5',
    Numpad6: 'draft6',
  };

  function toLocal(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action) {
      input.queue.push(action);
      e.preventDefault();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pointer.down = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const p = toLocal(e);
    input.pointer.x = p.x;
    input.pointer.y = p.y;
    input.pointer.down = true;
    input.pointer.active = true;
    if (e.button === 0) input.queue.push('click');
    if (e.button === 2) input.queue.push('cancel');
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toLocal(e);
    input.pointer.x = p.x;
    input.pointer.y = p.y;
    input.pointer.active = true;
  });

  canvas.addEventListener('pointerup', () => {
    input.pointer.down = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.steer = function steer(ember) {
    let x = 0;
    let y = 0;
    if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) x -= 1;
    if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) x += 1;
    if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) y -= 1;
    if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) y += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    }
    if (input.pointer.down && input.pointer.active) {
      const dx = input.pointer.x - ember.x;
      const dy = input.pointer.y - ember.y;
      const d = Math.hypot(dx, dy);
      if (d > 8) return { x: dx / d, y: dy / d };
    }
    return { x: 0, y: 0 };
  };

  input.dashHeld = function dashHeld() {
    return input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  };

  input.drain = function drain() {
    const out = input.queue;
    input.queue = [];
    return out;
  };

  return input;
}
