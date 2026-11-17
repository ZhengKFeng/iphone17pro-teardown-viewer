import type { ComponentDefinition, ComponentMetadata, ExplosionStage, PartSpec, Vec3 } from '../core/types';

/**
 * Envelope dimensions. Height / width / depth are the only numbers taken from
 * a primary source (Apple tech specs, support.apple.com/125090, read
 * 2026-11-16: 150 mm × 71.9 mm × 8.75 mm, 204 g). Everything else in this file
 * is an APPROXIMATION chosen to give a coherent, believable assembly.
 */
export const PHONE = {
  width: 71.9, // verified (Apple)
  height: 150.0, // verified (Apple)
  depth: 8.75, // verified (Apple)
  massGrams: 204, // verified (Apple) – informational only
  cornerRadius: 11.5, // approximated
  wall: 2.0, // approximated side-wall thickness
  floor: 0.8, // approximated rear-shell thickness
  plateauHeight: 2.2, // approximated camera-plateau protrusion
} as const;

export const HW = PHONE.width / 2;
export const HH = PHONE.height / 2;
/** z of the front (display) face and of the rear face. +Z points out of the back. */
export const Z_FRONT = -PHONE.depth / 2;
export const Z_REAR = PHONE.depth / 2;
/** Inner face of the rear shell. */
export const Z_FLOOR = Z_REAR - PHONE.floor;

/** Rear-camera lens centres on the plateau (approximated layout). */
export const LENS = {
  telephoto: [-22.5, 62] as [number, number],
  main: [-22.5, 45] as [number, number],
  ultrawide: [-8.5, 53.5] as [number, number],
  holeRadius: 6.4,
};

export const PLATEAU = { w: 66, h: 37, r: 9, cy: 53.5 };
export const REAR_GLASS = { w: 60, h: 86, r: 8, cy: -18 };

/**
 * Exploded-view layer offsets along Z (mm). Negative = towards the display
 * side, positive = towards the rear. The ordering mirrors the assembled
 * stacking order so linear interpolation can never make two stacked parts pass
 * through each other.
 */
export const LAYER = {
  frontGlass: -100,
  displayPanel: -86,
  displaySupport: -73,
  graphite: -64,
  chargeFlex: -48,
  coverScrews: -46,
  frontModules: -40,
  covers: -34,
  flex: -27,
  trayScrews: -24,
  battery: -14,
  board: -12,
  chips: -2,
  cameras: 4,
  tray: 6,
  shields: 8,
  tim: 13,
  vaporChamber: 18,
  coil: 30,
  magnets: 38,
  frame: 50,
  rearCover: 66,
  flash: 78,
  lensRings: 80,
} as const;

export const MAX_LAYER = 100;

/**
 * Outer layers start moving first, inner layers follow. Because every stage
 * ends at 1 and uses the same easing, a part that is further out is always at
 * least as far along as a part behind it – stacked parts keep their order.
 */
export function stageFor(dz: number): ExplosionStage {
  const start = 0.35 * (1 - Math.min(1, Math.abs(dz) / MAX_LAYER));
  return { start: Math.round(start * 1000) / 1000, end: 1 };
}

type DefineInput = ComponentMetadata & {
  /** Assembled position of the component origin. */
  at?: Vec3;
  /** Offset from assembled to exploded position (group-specific direction). */
  explode: Vec3;
  /** Optional exploded orientation (Euler XYZ, radians). */
  explodedRotation?: Vec3;
  parts: PartSpec[];
};

export function define(input: DefineInput): ComponentDefinition {
  const { at = [0, 0, 0], explode, explodedRotation = [0, 0, 0], parts, ...meta } = input;
  return {
    ...meta,
    assembled: { position: at, rotation: [0, 0, 0] },
    exploded: {
      position: [at[0] + explode[0], at[1] + explode[1], at[2] + explode[2]],
      rotation: explodedRotation,
    },
    stage: stageFor(explode[2]),
    visible: true,
    geometry: { type: 'procedural', parts },
  };
}

const RX90: Vec3 = [Math.PI / 2, 0, 0];

/**
 * A small machine screw. `axis` is the direction the head faces
 * ('-z' = towards the display, '-y' = out of the bottom edge).
 */
export function screw(x: number, y: number, z: number, axis: '-z' | '+z' | '-y', headR = 0.9, length = 1.6): PartSpec[] {
  const headH = 0.5;
  if (axis === '-y') {
    return [
      { name: 'Screw head', geom: { kind: 'cyl', r: headR, depth: headH, segments: 20 }, position: [x, y + headH / 2, z], rotation: RX90 },
      { name: 'Screw shank', geom: { kind: 'cyl', r: headR * 0.5, depth: length, segments: 12 }, position: [x, y + headH + length / 2, z], rotation: RX90 },
      { name: 'Drive recess', geom: { kind: 'cyl', r: headR * 0.45, depth: 0.08, segments: 5 }, material: 'cavity', position: [x, y - 0.03, z], rotation: RX90 },
    ];
  }
  const s = axis === '-z' ? 1 : -1; // direction from head towards shank
  return [
    { name: 'Screw head', geom: { kind: 'cyl', r: headR, depth: headH, segments: 20 }, position: [x, y, z + (s * headH) / 2] },
    { name: 'Screw shank', geom: { kind: 'cyl', r: headR * 0.5, depth: length, segments: 12 }, position: [x, y, z + s * (headH + length / 2)] },
    { name: 'Drive recess', geom: { kind: 'cyl', r: headR * 0.45, depth: 0.08, segments: 6 }, material: 'cavity', position: [x, y, z - s * 0.03] },
  ];
}
