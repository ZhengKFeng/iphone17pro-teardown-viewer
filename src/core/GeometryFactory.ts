import * as THREE from 'three';
import type { ComponentDefinition, GeomSpec, Hole, PartSpec, Vec3 } from './types';

/**
 * GeometryFactory turns declarative GeomSpec data into three.js BufferGeometry.
 * It has no knowledge of React, materials, selection or the UI. Results are
 * cached by spec so identical primitives (screws, holes, ...) share one buffer.
 */

const CURVE_SEGMENTS = 20;

function roundedRectPath<T extends THREE.Path>(path: T, w: number, h: number, r: number, cx = 0, cy = 0): T {
  const hw = w / 2;
  const hh = h / 2;
  const rr = Math.max(0, Math.min(r, hw, hh));
  if (rr <= 1e-6) {
    path.moveTo(cx - hw, cy - hh);
    path.lineTo(cx + hw, cy - hh);
    path.lineTo(cx + hw, cy + hh);
    path.lineTo(cx - hw, cy + hh);
    path.closePath();
    return path;
  }
  path.moveTo(cx - hw + rr, cy - hh);
  path.lineTo(cx + hw - rr, cy - hh);
  path.absarc(cx + hw - rr, cy - hh + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(cx + hw, cy + hh - rr);
  path.absarc(cx + hw - rr, cy + hh - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(cx - hw + rr, cy + hh);
  path.absarc(cx - hw + rr, cy + hh - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(cx - hw, cy - hh + rr);
  path.absarc(cx - hw + rr, cy - hh + rr, rr, Math.PI, Math.PI * 1.5, false);
  path.closePath();
  return path;
}

function holePath(h: Hole): THREE.Path {
  const p = new THREE.Path();
  if (h.shape === 'circle') {
    p.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true);
    return p;
  }
  return roundedRectPath(p, h.w, h.h, h.r ?? 0, h.x, h.y);
}

/** Extrude a shape along Z so the result spans exactly [-depth/2, +depth/2]. */
function extrudeCentered(shape: THREE.Shape, depth: number, bevel = 0): THREE.BufferGeometry {
  const b = Math.max(0, Math.min(bevel, depth / 2 - 1e-4));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b, // keep the outline inside the nominal dimensions
    bevelSegments: b > 0 ? 4 : 0,
    curveSegments: CURVE_SEGMENTS,
  });
  geo.translate(0, 0, -(depth - 2 * b) / 2);
  return geo;
}

function buildSpiral(rInner: number, rOuter: number, turns: number, wire: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const steps = Math.ceil(turns * 48);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = u * turns * Math.PI * 2;
    const r = rInner + (rOuter - rInner) * u;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return new THREE.TubeGeometry(curve, steps * 2, wire / 2, 6, false);
}

/**
 * Custom BufferGeometry: a rectangular-section ribbon swept along a smooth
 * path. `widthDir` is the (constant) direction of the ribbon's width.
 */
function buildRibbon(path: Vec3[], width: number, thickness: number, widthDir: Vec3 = [1, 0, 0]): THREE.BufferGeometry {
  // Polyline with filleted corners: straight runs stay exactly straight (a
  // spline would overshoot before each bend and poke through neighbours).
  const pts = path.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CurvePath<THREE.Vector3>();
  let cursor = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const corner = pts[i];
    if (i === pts.length - 1) {
      curve.add(new THREE.LineCurve3(cursor, corner.clone()));
      break;
    }
    const lenIn = corner.distanceTo(pts[i - 1]);
    const lenOut = corner.distanceTo(pts[i + 1]);
    const fillet = Math.min(1.0, lenIn * 0.45, lenOut * 0.45);
    const a = corner.clone().addScaledVector(pts[i - 1].clone().sub(corner).normalize(), fillet);
    const b = corner.clone().addScaledVector(pts[i + 1].clone().sub(corner).normalize(), fillet);
    curve.add(new THREE.LineCurve3(cursor, a));
    curve.add(new THREE.QuadraticBezierCurve3(a, corner.clone(), b));
    cursor = b;
  }
  const n = Math.min(600, Math.max(8, Math.ceil(curve.getLength() / 0.35)));
  const wd = new THREE.Vector3(...widthDir).normalize();
  const positions: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    curve.getPoint(u, p);
    curve.getTangent(u, t);
    // Width axis made perpendicular to the tangent; normal completes the frame.
    side.copy(wd).addScaledVector(t, -wd.dot(t));
    if (side.lengthSq() < 1e-8) side.set(0, 0, 1).addScaledVector(t, -t.z);
    side.normalize();
    nrm.crossVectors(t, side).normalize();
    const hw = width / 2;
    const ht = thickness / 2;
    const corners: [number, number][] = [
      [-hw, -ht],
      [hw, -ht],
      [hw, ht],
      [-hw, ht],
    ];
    for (const [a, b] of corners) {
      positions.push(p.x + side.x * a + nrm.x * b, p.y + side.y * a + nrm.y * b, p.z + side.z * a + nrm.z * b);
    }
    if (i < n) {
      const o = i * 4;
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        indices.push(o + k, o + k2, o + 4 + k2, o + k, o + 4 + k2, o + 4 + k);
      }
    }
  }
  // End caps
  const last = n * 4;
  indices.push(0, 2, 1, 0, 3, 2, last, last + 1, last + 2, last, last + 2, last + 3);
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geo = indexed.toNonIndexed(); // flat-shaded faces → crisp ribbon edges
  geo.computeVertexNormals();
  indexed.dispose();
  return geo;
}

function build(spec: GeomSpec): THREE.BufferGeometry {
  switch (spec.kind) {
    case 'plate': {
      const shape = roundedRectPath(new THREE.Shape(), spec.w, spec.h, spec.r ?? 0);
      for (const h of spec.holes ?? []) shape.holes.push(holePath(h));
      return extrudeCentered(shape, spec.depth, spec.bevel);
    }
    case 'poly': {
      const shape = new THREE.Shape(spec.points.map(([x, y]) => new THREE.Vector2(x, y)));
      return extrudeCentered(shape, spec.depth, spec.bevel);
    }
    case 'box':
      return new THREE.BoxGeometry(...spec.size);
    case 'cyl': {
      const g = new THREE.CylinderGeometry(spec.r, spec.r, spec.depth, spec.segments ?? 32);
      g.rotateX(Math.PI / 2);
      return g;
    }
    case 'tube': {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, spec.rOuter, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, spec.rInner, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(shape, { depth: spec.depth, bevelEnabled: false, curveSegments: 48 });
      g.translate(0, 0, -spec.depth / 2);
      return g;
    }
    case 'arc': {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, spec.rOuter, spec.start, spec.end, false);
      shape.absarc(0, 0, spec.rInner, spec.end, spec.start, true);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: spec.depth, bevelEnabled: false, curveSegments: 12 });
      g.translate(0, 0, -spec.depth / 2);
      return g;
    }
    case 'spiral':
      return buildSpiral(spec.rInner, spec.rOuter, spec.turns, spec.wire);
    case 'ribbon':
      return buildRibbon(spec.path, spec.width, spec.thickness, spec.widthDir);
  }
}

const geometryCache = new Map<string, THREE.BufferGeometry>();
const edgesCache = new Map<string, THREE.BufferGeometry>();

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);

export const GeometryFactory = {
  /** Build (or fetch from cache) the BufferGeometry for a spec. */
  get(spec: GeomSpec): THREE.BufferGeometry {
    const key = JSON.stringify(spec);
    let geo = geometryCache.get(key);
    if (!geo) {
      geo = build(spec);
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      geometryCache.set(key, geo);
    }
    return geo;
  },

  /** Feature edges for the technical (engineering) rendering. */
  edges(spec: GeomSpec): THREE.BufferGeometry {
    const key = JSON.stringify(spec);
    let e = edgesCache.get(key);
    if (!e) {
      e = new THREE.EdgesGeometry(this.get(spec), 28);
      edgesCache.set(key, e);
    }
    return e;
  },

  /** Local matrix of a part inside its component. */
  partMatrix(part: PartSpec, target = new THREE.Matrix4()): THREE.Matrix4 {
    const [px, py, pz] = part.position ?? [0, 0, 0];
    const [rx, ry, rz] = part.rotation ?? [0, 0, 0];
    _quat.setFromEuler(_euler.set(rx, ry, rz, 'XYZ'));
    return target.compose(new THREE.Vector3(px, py, pz), _quat, _one);
  },

  /** Axis-aligned boxes of each part, in component-local coordinates. */
  partBoxes(def: ComponentDefinition): THREE.Box3[] {
    if (def.geometry.type !== 'procedural') return [];
    const m = new THREE.Matrix4();
    return def.geometry.parts.map((part) => {
      const box = this.get(part.geom).boundingBox!.clone();
      return box.applyMatrix4(this.partMatrix(part, m));
    });
  },

  /** Bounding box of a whole component, in component-local coordinates. */
  componentBox(def: ComponentDefinition): THREE.Box3 {
    const box = new THREE.Box3();
    for (const b of this.partBoxes(def)) box.union(b);
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    return box;
  },

  triangleCount(def: ComponentDefinition): number {
    if (def.geometry.type !== 'procedural') return 0;
    let n = 0;
    for (const part of def.geometry.parts) {
      const g = this.get(part.geom);
      n += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
    return Math.round(n);
  },

  clearCache(): void {
    geometryCache.forEach((g) => g.dispose());
    edgesCache.forEach((g) => g.dispose());
    geometryCache.clear();
    edgesCache.clear();
  },
};
