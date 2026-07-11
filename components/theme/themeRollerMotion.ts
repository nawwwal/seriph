/**
 * ANIMATION STORYBOARD — Theme roller weights
 *
 * League Spartan variable `wght` 100–900. Weight is a continuous float
 * driven by |offset| — never stepped font-weight integers — so as the
 * drum rolls, type thickens/thins on the compositor-friendly variation axis.
 *
 * |offset| 0   → wght 900 (active, black)
 * |offset| ~1  → wght ~600
 * |offset| ~2  → wght 300 (far, thin)
 *
 * Applied every gesture frame (transition: none) so settle spring also
 * eases weight with position — seamless active handoff.
 */

export const DRUM = {
  rowPx: 42,
  viewRows: 5,
  tiltDeg: 16,
  perspectivePx: 380,
  widthRem: 12.5,
  scaleFar: 0.94,
  opacityFar: 0.42,
  sizeFarRem: 1.65,
  sizeNearRem: 1.85,
  weightNear: 900,
  weightFar: 300,
  opticalYPx: 2,
};

export const GESTURE = {
  pxPerFace: DRUM.rowPx,
  wheelIdleMs: 60,
  sampleWindow: 5,
};

export const ELASTIC = {
  projectSec: 0.16,
  flingFacesPerSec: 1.1,
  maxVelocity: 14,
  settle: {
    type: 'spring' as const,
    stiffness: 340,
    damping: 24,
    mass: 0.7,
  },
};

export const SETTLE = ELASTIC.settle;

export function clampVelocity(v: number): number {
  const m = ELASTIC.maxVelocity;
  return Math.max(-m, Math.min(m, v));
}

export function elasticSnapTarget(position: number, velocity: number): number {
  const v = clampVelocity(velocity);
  const projected = position + v * ELASTIC.projectSec;
  if (Math.abs(v) >= ELASTIC.flingFacesPerSec) {
    return v > 0 ? Math.ceil(projected - 1e-6) : Math.floor(projected + 1e-6);
  }
  return Math.round(projected);
}

export function centerness(offset: number): number {
  const d = Math.min(1, Math.abs(offset));
  const t = 1 - d;
  return t * t * (3 - 2 * t);
}

/** Continuous wght 900→300 by distance (no Math.round steps). */
export function weightForOffset(offset: number): number {
  const farness = Math.min(Math.abs(offset), 2) / 2;
  return DRUM.weightNear + (DRUM.weightFar - DRUM.weightNear) * farness;
}

export function faceStyle(offset: number) {
  const depth = Math.abs(offset);
  const c = centerness(offset);
  const opacity = Math.max(DRUM.opacityFar, 1 - depth * 0.26 + c * 0.12);
  const scale = DRUM.scaleFar + (1 - DRUM.scaleFar) * c;
  const y = offset * DRUM.rowPx + DRUM.opticalYPx;
  const tilt = offset * -DRUM.tiltDeg;
  const fontSize = DRUM.sizeFarRem + (DRUM.sizeNearRem - DRUM.sizeFarRem) * c;
  const wght = weightForOffset(offset);
  const paperPct = Math.round(c * 100);

  return {
    opacity: Math.min(1, opacity),
    transform: `translate3d(0, ${y}px, 0) rotateX(${tilt}deg) scale(${scale})`,
    color: `color-mix(in srgb, var(--paper) ${paperPct}%, var(--ink))`,
    fontSize: `${fontSize}rem`,
    /** Variable axis — smooth; fontWeight is fallback only */
    fontVariationSettings: `'wght' ${wght.toFixed(1)}`,
    fontWeight: Math.round(wght),
    zIndex: Math.round(c * 10) + 1,
  };
}
