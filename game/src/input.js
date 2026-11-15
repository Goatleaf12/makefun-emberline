// Keyboard + pointer state for EMBERLINE. The world reads this object
// once per step and never touches the DOM itself, which keeps the rules
// testable in Node and the browser code in one small place.

// One-shot actions (flare, dash, pause...) are queued on keydown and
// consumed exactly once by the world, so a held key never double-fires.
export class Controls {
  constructor() {
    this.keys = new Set();
    this.queue = [];
    this.pointer = { x: 0, y: 0, down: false, active: false };
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
  }

  attach(element) {
    if (typeof document === 'undefined' || !element) return;
    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (!e.repeat) {
        if (k === 'f' || k === ' ') this.queue.push('flare');
        if (k === ' ') this.queue.push('confirm');
        if (k === 'shift') this.queue.push('dash');
        if (k === 'p' || k === 'escape') this.queue.push('pause');
        if (k === 'm') this.queue.push('mute');
        if (k === 'r') this.queue.push('restart');
        if (k === 'enter') this.queue.push('confirm');
      }
      this.keys.add(k);
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    this._onPointerDown = (e) => {
      const r = element.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.down = true;
      this.pointer.active = true;
      this.queue.push('confirm');
    };
    this._onPointerMove = (e) => {
      const r = element.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
    };
    this._onPointerUp = () => { this.pointer.down = false; };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    element.addEventListener('pointerdown', this._onPointerDown);
    element.addEventListener('pointermove', this._onPointerMove);
    element.addEventListener('pointerup', this._onPointerUp);
    element.addEventListener('pointerleave', this._onPointerUp);
  }

  // Steering direction from keys, as a unit vector (or zero when idle).
  steerVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  hasAction(name) {
    const i = this.queue.indexOf(name);
    if (i === -1) return false;
    this.queue.splice(i, 1);
    return true;
  }

  drainActions() {
    const out = this.queue.slice();
    this.queue.length = 0;
    return out;
  }
}
