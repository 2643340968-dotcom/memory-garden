export class PointerController {
  constructor() {
    this.state = {
      x: 0,
      y: 0,
      active: false,
      hasPosition: false,
    };
  }

  updatePointer(normalizedX, normalizedY, isPlanting, hasPosition = true) {
    this.state.x = Math.max(-1, Math.min(1, normalizedX));
    this.state.y = Math.max(-1, Math.min(1, normalizedY));
    this.state.active = Boolean(isPlanting);
    this.state.hasPosition = Boolean(hasPosition);
  }

  setActive(isPlanting) {
    this.state.active = Boolean(isPlanting);
  }

  setVisible(hasPosition) {
    this.state.hasPosition = Boolean(hasPosition);
  }

  getState() {
    return this.state;
  }
}

