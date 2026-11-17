import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createModel } from '../src/data';
import { ExplosionController, ease, localProgress, poseAt } from '../src/core/ExplosionController';
import { ComponentRegistry } from '../src/core/ComponentRegistry';
import { GeometryFactory } from '../src/core/GeometryFactory';
import type { ComponentDefinition } from '../src/core/types';
import { findNewCollisions } from '../src/core/CollisionProxy';

const { registry, explosion } = createModel();
const defs = registry.all();

function quatOf(rot: [number, number, number]): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ'));
}

describe('easing', () => {
  it('is exact at the ends, monotonic and clamped', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-3)).toBe(0);
    expect(ease(7)).toBe(1);
    let prev = 0;
    for (let i = 0; i <= 1000; i++) {
      const v = ease(i / 1000);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(localProgress(0.2, { start: 0.2, end: 1 })).toBe(0);
    expect(localProgress(0.6, { start: 0.2, end: 0.6 })).toBe(1);
  });
});

describe('explosion transforms', () => {
  it('progress 0 gives exactly the assembled transform', () => {
    for (const def of defs) {
      const pose = poseAt(def, 0);
      expect(pose.position).toEqual(def.assembled.position);
      const q = quatOf(def.assembled.rotation);
      expect(pose.quaternion).toEqual([q.x, q.y, q.z, q.w]);
    }
  });

  it('progress 1 gives exactly the exploded transform', () => {
    for (const def of defs) {
      const pose = poseAt(def, 1);
      expect(pose.position).toEqual(def.exploded.position);
      const q = quatOf(def.exploded.rotation);
      expect(pose.quaternion).toEqual([q.x, q.y, q.z, q.w]);
    }
  });

  it('clamps out-of-range progress', () => {
    for (const def of defs) {
      expect(poseAt(def, -0.5)).toEqual(poseAt(def, 0));
      expect(poseAt(def, 1.5)).toEqual(poseAt(def, 1));
    }
  });

  it('every component actually moves', () => {
    for (const def of defs) {
      const d = new THREE.Vector3(...def.exploded.position).distanceTo(new THREE.Vector3(...def.assembled.position));
      expect(d, def.id).toBeGreaterThan(1);
    }
  });

  it('interpolates continuously and monotonically', () => {
    const N = 400;
    for (const def of defs) {
      const a = new THREE.Vector3(...def.assembled.position);
      const total = a.distanceTo(new THREE.Vector3(...def.exploded.position));
      let prevDist = 0;
      let prev = a.clone();
      for (let i = 1; i <= N; i++) {
        const p = new THREE.Vector3(...poseAt(def, i / N).position);
        const dist = p.distanceTo(a);
        expect(dist).toBeGreaterThanOrEqual(prevDist - 1e-9); // never moves backwards
        // smoothstep's max slope is 1.5 over the stage window → bounded step size
        const maxStep = (1.5 * total) / (N * (def.stage.end - def.stage.start)) + 1e-9;
        expect(p.distanceTo(prev), def.id).toBeLessThanOrEqual(maxStep);
        prevDist = dist;
        prev = p;
      }
      expect(prevDist).toBeCloseTo(total, 9);
    }
  });

  it('moves along a straight line between the two poses', () => {
    for (const def of defs) {
      const a = new THREE.Vector3(...def.assembled.position);
      const dir = new THREE.Vector3(...def.exploded.position).sub(a).normalize();
      for (const t of [0.2, 0.5, 0.8]) {
        const p = new THREE.Vector3(...poseAt(def, t).position).sub(a);
        const off = p.clone().addScaledVector(dir, -p.dot(dir)).length();
        expect(off).toBeLessThan(1e-9);
      }
    }
  });

  it('interpolates orientation with unit quaternions (slerp)', () => {
    const base = registry.get('battery');
    const spun: ComponentDefinition = {
      ...base,
      id: 'spun',
      exploded: { position: [0, 0, 50], rotation: [0, Math.PI / 2, 0] },
      stage: { start: 0, end: 1 },
    };
    const mid = poseAt(spun, 0.5); // smoothstep(0.5) = 0.5 → 45° about Y
    const q = new THREE.Quaternion(...mid.quaternion);
    expect(q.length()).toBeCloseTo(1, 12);
    const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    expect(q.angleTo(expected)).toBeLessThan(1e-9);
    for (let i = 0; i <= 50; i++) {
      expect(new THREE.Quaternion(...poseAt(spun, i / 50).quaternion).length()).toBeCloseTo(1, 12);
    }
  });
});

describe('reassembly', () => {
  it('returns every component to its exact original transform after scrubbing', () => {
    const objects = new Map(defs.map((d) => [d.id, new THREE.Object3D()]));
    const apply = (t: number) => objects.forEach((o, id) => explosion.apply(o, id, t));

    apply(0);
    const original = new Map([...objects].map(([id, o]) => [id, { p: o.position.clone(), q: o.quaternion.clone() }]));

    // Forward, back, and a few thousand arbitrary scrubs – like a user dragging the slider.
    for (let i = 0; i <= 500; i++) apply(i / 500);
    for (let i = 500; i >= 0; i--) apply(i / 500);
    let seed = 12345;
    for (let i = 0; i < 3000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      apply(seed / 0xffffffff);
    }
    apply(1);
    apply(0);

    for (const [id, o] of objects) {
      const ref = original.get(id)!;
      expect(o.position.equals(ref.p), `${id} position drifted`).toBe(true); // bit-exact
      expect(o.quaternion.equals(ref.q), `${id} rotation drifted`).toBe(true);
      expect(o.position.toArray()).toEqual(registry.get(id).assembled.position);
    }
  });

  it('is path independent: same progress → same pose, whichever direction it is reached from', () => {
    const ctl = new ExplosionController(new ComponentRegistry(defs));
    for (const t of [0.1, 0.37, 0.5, 0.93]) {
      const forward = ctl.snapshot(t);
      ctl.snapshot(1);
      const backward = ctl.snapshot(t);
      expect(backward).toEqual(forward);
    }
  });
});

describe('exploded-view readability', () => {
  const ORDER = ['front-glass', 'display-panel', 'display-support', 'graphite-sheet', 'battery', 'battery-tray', 'vapor-chamber', 'wireless-coil', 'unibody-frame', 'rear-glass'];

  it('creates no new interpenetration at any point of the animation', () => {
    // Occupancy-cell proxies (3 mm cells) – far tighter than whole-part boxes,
    // so L-shaped boards, the hollow frame and holes are represented properly.
    const problems = findNewCollisions(defs, 40, 3);
    // Known modelling limitation: the SIM tray slides out sideways through a
    // slot that is not cut into the procedural frame wall.
    const known = (p: string) => p.startsWith('unibody-frame × sim-tray');
    expect(problems.filter((p) => !known(p))).toEqual([]);
  });

  it('preserves the front-to-back stacking order of the main layers', () => {
    for (let s = 0; s <= 50; s++) {
      const dz = ORDER.map((id) => {
        const def = registry.get(id);
        return poseAt(def, s / 50).position[2] - def.assembled.position[2];
      });
      for (let i = 1; i < dz.length; i++) expect(dz[i], `${ORDER[i - 1]} → ${ORDER[i]} @ ${s / 50}`).toBeGreaterThanOrEqual(dz[i - 1]);
    }
  });

  it('fully separates the main layers when exploded', () => {
    const box = (id: string) => {
      const def = registry.get(id);
      return GeometryFactory.componentBox(def).translate(new THREE.Vector3(...poseAt(def, 1).position));
    };
    for (let i = 1; i < ORDER.length; i++) {
      const gap = box(ORDER[i]).min.z - box(ORDER[i - 1]).max.z;
      expect(gap, `${ORDER[i - 1]} → ${ORDER[i]}`).toBeGreaterThan(3);
    }
  });
});
