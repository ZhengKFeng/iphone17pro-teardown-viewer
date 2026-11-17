import * as THREE from 'three';
import type { ComponentDefinition } from './types';
import { GeometryFactory } from './GeometryFactory';
import { poseAt } from './ExplosionController';

/**
 * CollisionProxy: a coarse occupancy model used to check that the exploded
 * view never drives one part through another.
 *
 * Each part's surface triangles are binned into XY cells; a cell is occupied
 * only if a triangle really intersects it, and its Z range is taken from those
 * triangles. This represents hollow parts (the frame), holes and L-shaped
 * outlines much better than one bounding box per part. Because all parts are
 * thin shells of triangles this is a *surface* test: it detects surfaces
 * crossing, which is what matters for parts sliding past each other.
 */

export interface ProxyCell {
  componentId: string;
  box: THREE.Box3; // component-local
}

export function buildProxy(def: ComponentDefinition, cell: number): ProxyCell[] {
  if (def.geometry.type !== 'procedural') return [];
  const cells = new Map<string, THREE.Box3>();
  const tri = new THREE.Triangle();
  const triBox = new THREE.Box3();
  const cellBox = new THREE.Box3();
  const m = new THREE.Matrix4();
  for (const part of def.geometry.parts) {
    const geo = GeometryFactory.get(part.geom);
    GeometryFactory.partMatrix(part, m);
    const pos = geo.attributes.position;
    const index = geo.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      tri.a.fromBufferAttribute(pos, ia).applyMatrix4(m);
      tri.b.fromBufferAttribute(pos, ib).applyMatrix4(m);
      tri.c.fromBufferAttribute(pos, ic).applyMatrix4(m);
      triBox.makeEmpty().expandByPoint(tri.a).expandByPoint(tri.b).expandByPoint(tri.c);
      const x0 = Math.floor(triBox.min.x / cell);
      const x1 = Math.floor(triBox.max.x / cell);
      const y0 = Math.floor(triBox.min.y / cell);
      const y1 = Math.floor(triBox.max.y / cell);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          cellBox.min.set(cx * cell, cy * cell, triBox.min.z - 1e-6);
          cellBox.max.set((cx + 1) * cell, (cy + 1) * cell, triBox.max.z + 1e-6);
          if (x0 !== x1 || y0 !== y1) {
            if (!cellBox.intersectsTriangle(tri)) continue;
          }
          // Occupied region = cell ∩ triangle bounds
          const clipped = cellBox.clone().intersect(triBox);
          const key = `${cx},${cy}`;
          const existing = cells.get(key);
          if (existing) existing.union(clipped);
          else cells.set(key, clipped);
        }
      }
    }
  }
  return [...cells.values()].map((box) => ({ componentId: def.id, box }));
}

function overlaps(a: THREE.Box3, b: THREE.Box3, eps: number): boolean {
  return (
    a.min.x < b.max.x - eps &&
    a.max.x > b.min.x + eps &&
    a.min.y < b.max.y - eps &&
    a.max.y > b.min.y + eps &&
    a.min.z < b.max.z - eps &&
    a.max.z > b.min.z + eps
  );
}

/**
 * Sample the explosion at `steps` progress values and report component pairs
 * whose proxies overlap during the motion although those same cells did not
 * overlap in the assembled state. Returns human-readable descriptions.
 * (Assumes translation-only motion, which the assembled model uses; rotating
 * components are compared through their rotated bounding boxes.)
 */
export function findNewCollisions(defs: ComponentDefinition[], steps = 40, cell = 3, eps = 0.03): string[] {
  const proxies = defs.map((d) => buildProxy(d, cell));
  const bounds = proxies.map((cells) => cells.reduce((acc, c) => acc.union(c.box), new THREE.Box3()));
  const q = new THREE.Quaternion();
  const worldBoxes = (i: number, t: number, boxes: THREE.Box3[]): THREE.Box3[] => {
    const pose = poseAt(defs[i], t);
    q.set(...pose.quaternion);
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(...pose.position), q, new THREE.Vector3(1, 1, 1));
    return boxes.map((b) => b.clone().applyMatrix4(mat));
  };
  const base = defs.map((_, i) => worldBoxes(i, 0, proxies[i].map((c) => c.box)));
  const problems = new Map<string, string>();
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const hull = defs.map((_, i) => worldBoxes(i, t, [bounds[i]])[0]);
    const cache = new Map<number, THREE.Box3[]>();
    const cellsOf = (i: number) => {
      let c = cache.get(i);
      if (!c) cache.set(i, (c = worldBoxes(i, t, proxies[i].map((p) => p.box))));
      return c;
    };
    for (let i = 0; i < defs.length; i++) {
      for (let j = i + 1; j < defs.length; j++) {
        const key = `${defs[i].id} × ${defs[j].id}`;
        if (problems.has(key) || !overlaps(hull[i], hull[j], eps)) continue;
        const a = cellsOf(i);
        const b = cellsOf(j);
        search: for (let ka = 0; ka < a.length; ka++) {
          for (let kb = 0; kb < b.length; kb++) {
            if (overlaps(a[ka], b[kb], eps) && !overlaps(base[i][ka], base[j][kb], eps)) {
              problems.set(key, `${key} @ ${t.toFixed(3)}`);
              break search;
            }
          }
        }
      }
    }
  }
  return [...problems.values()];
}
