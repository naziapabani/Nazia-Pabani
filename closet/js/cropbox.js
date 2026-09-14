// A draggable, resizable selection box over a photo. Used both for tagging a
// garment by hand and for fixing a region the detector got slightly wrong.
// Regions are normalized (0–1) so they survive any display size.

const MIN_SIZE = 0.04;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createCropBox(host, { region, onChange } = {}) {
  host.classList.add('cropbox-host');

  const overlay = document.createElement('div');
  overlay.className = 'cropbox-overlay';

  const box = document.createElement('div');
  box.className = 'cropbox';
  box.innerHTML = ['nw', 'ne', 'sw', 'se'].map((corner) => `<span class="cropbox-handle ${corner}" data-corner="${corner}"></span>`).join('');
  overlay.appendChild(box);
  host.appendChild(overlay);

  let current = normalize(region) || { x: 0.25, y: 0.2, width: 0.5, height: 0.45 };
  let drag = null;

  function normalize(r) {
    if (!r) return null;
    const x = Number(r.x), y = Number(r.y), width = Number(r.width), height = Number(r.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    if (width < MIN_SIZE || height < MIN_SIZE) return null;
    return { x: clamp01(x), y: clamp01(y), width: Math.min(width, 1 - clamp01(x)), height: Math.min(height, 1 - clamp01(y)) };
  }

  function paint() {
    box.style.left = `${current.x * 100}%`;
    box.style.top = `${current.y * 100}%`;
    box.style.width = `${current.width * 100}%`;
    box.style.height = `${current.height * 100}%`;
  }

  function pointFromEvent(event) {
    const rect = overlay.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  function emit() {
    paint();
    onChange?.({ ...current });
  }

  overlay.addEventListener('pointerdown', (event) => {
    const point = pointFromEvent(event);
    const corner = event.target.dataset?.corner;
    overlay.setPointerCapture(event.pointerId);

    if (corner) {
      drag = { mode: 'resize', corner, origin: current };
    } else if (event.target === box) {
      drag = { mode: 'move', grab: { x: point.x - current.x, y: point.y - current.y } };
    } else {
      // Dragging on bare photo starts a brand-new box.
      drag = { mode: 'draw', anchor: point };
      current = { x: point.x, y: point.y, width: MIN_SIZE, height: MIN_SIZE };
      paint();
    }
    event.preventDefault();
  });

  overlay.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = pointFromEvent(event);

    if (drag.mode === 'move') {
      current = {
        ...current,
        x: clamp01(Math.min(point.x - drag.grab.x, 1 - current.width)),
        y: clamp01(Math.min(point.y - drag.grab.y, 1 - current.height)),
      };
    } else if (drag.mode === 'draw') {
      const x = Math.min(drag.anchor.x, point.x);
      const y = Math.min(drag.anchor.y, point.y);
      current = {
        x, y,
        width: Math.max(MIN_SIZE, Math.abs(point.x - drag.anchor.x)),
        height: Math.max(MIN_SIZE, Math.abs(point.y - drag.anchor.y)),
      };
    } else if (drag.mode === 'resize') {
      const { corner, origin } = drag;
      const right = origin.x + origin.width;
      const bottom = origin.y + origin.height;
      let { x, y } = origin;
      let width = origin.width;
      let height = origin.height;

      if (corner.includes('w')) { x = Math.min(point.x, right - MIN_SIZE); width = right - x; }
      if (corner.includes('e')) { width = Math.max(MIN_SIZE, point.x - origin.x); }
      if (corner.includes('n')) { y = Math.min(point.y, bottom - MIN_SIZE); height = bottom - y; }
      if (corner.includes('s')) { height = Math.max(MIN_SIZE, point.y - origin.y); }

      current = {
        x: clamp01(x),
        y: clamp01(y),
        width: Math.min(width, 1 - clamp01(x)),
        height: Math.min(height, 1 - clamp01(y)),
      };
    }
    paint();
    event.preventDefault();
  });

  function endDrag(event) {
    if (!drag) return;
    drag = null;
    if (overlay.hasPointerCapture?.(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
    emit();
  }
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  paint();

  return {
    getRegion: () => ({ ...current }),
    setRegion(next) {
      const normalized = normalize(next);
      if (normalized) { current = normalized; paint(); }
    },
    destroy() {
      overlay.remove();
      host.classList.remove('cropbox-host');
    },
  };
}
