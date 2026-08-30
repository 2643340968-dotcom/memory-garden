export class MouseInput {
  constructor(canvas, pointerController) {
    this.canvas = canvas;
    this.pointerController = pointerController;
    this.isPlanting = false;
    this.pointerId = null;

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("blur", this.onWindowBlur);
  }

  updateFromEvent(event, active = this.isPlanting) {
    const bounds = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.pointerController.updatePointer(x, y, active, true);
  }

  onPointerMove(event) {
    this.updateFromEvent(event);
    if (this.isPlanting) {
      event.preventDefault();
    }
  }

  onPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    this.isPlanting = true;
    this.pointerId = event.pointerId;
    this.updateFromEvent(event, true);
    this.canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  onPointerUp(event) {
    if (this.pointerId !== null && event.pointerId !== this.pointerId) {
      return;
    }

    this.isPlanting = false;
    this.pointerId = null;
    this.pointerController.setActive(false);
  }

  onPointerLeave() {
    if (!this.isPlanting) {
      this.pointerController.setVisible(false);
    }
  }

  onWindowBlur() {
    this.isPlanting = false;
    this.pointerId = null;
    this.pointerController.setActive(false);
  }
}

