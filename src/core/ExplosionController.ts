import * as THREE from 'three';
import type { ComponentDefinition, ExplosionStage, Quat, Vec3 } from './types';
import type { ComponentRegistry } from './ComponentRegistry';

/**
 * ExplosionController: maps the normalised parameter explosionProgress ∈ [0, 1]
 * to a rigid transform for every component.
 *
 * The transform is a *pure function* of the progress value – nothing is
 * accumulated frame to frame – so scrubbing, reversing and replaying can never
 * drift: progress 0 always yields exactly the assembled pose and progress 1
 * exactly the exploded pose.
 */

export interface Pose {
  position: Vec3;
  quaternion: Quat;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Smoothstep easing: C1-continuous, monotonic, e(0) = 0, e(1) = 1. */
export function ease(x: number): number {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

/** Per-component eased progress given the global progress and its stage. */
export function localProgress(t: number, stage: ExplosionStage): number {
  const c = clamp01(t);
  if (c <= stage.start) return 0;
  if (c >= stage.end) return 1;
  return ease((c - stage.start) / (stage.end - stage.start));
}

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _e = new THREE.Euler();

function eulerToQuat(r: Vec3, target: THREE.Quaternion): THREE.Quaternion {
  return target.setFromEuler(_e.set(r[0], r[1], r[2], 'XYZ'));
}

/** Pose of one component at global progress t. */
export function poseAt(def: ComponentDefinition, t: number): Pose {
  const k = localProgress(t, def.stage);
  const a = def.assembled;
  const b = def.exploded;
  eulerToQuat(a.rotation, _qa);
  if (k === 0) {
    return { position: [a.position[0], a.position[1], a.position[2]], quaternion: [_qa.x, _qa.y, _qa.z, _qa.w] };
  }
  eulerToQuat(b.rotation, _qb);
  if (k === 1) {
    return { position: [b.position[0], b.position[1], b.position[2]], quaternion: [_qb.x, _qb.y, _qb.z, _qb.w] };
  }
  _qa.slerp(_qb, k);
  return {
    position: [
      a.position[0] + (b.position[0] - a.position[0]) * k,
      a.position[1] + (b.position[1] - a.position[1]) * k,
      a.position[2] + (b.position[2] - a.position[2]) * k,
    ],
    quaternion: [_qa.x, _qa.y, _qa.z, _qa.w],
  };
}

export class ExplosionController {
  constructor(private readonly registry: ComponentRegistry) {}

  poseAt(id: string, t: number): Pose {
    return poseAt(this.registry.get(id), t);
  }

  /** Write the pose for progress t onto a scene object (idempotent). */
  apply(object: THREE.Object3D, id: string, t: number): void {
    const pose = this.poseAt(id, t);
    object.position.set(pose.position[0], pose.position[1], pose.position[2]);
    object.quaternion.set(pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3]);
  }

  /** All poses at progress t, keyed by component id. */
  snapshot(t: number): Record<string, Pose> {
    const out: Record<string, Pose> = {};
    for (const def of this.registry.all()) out[def.id] = poseAt(def, t);
    return out;
  }
}
