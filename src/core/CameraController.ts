import * as THREE from 'three';
import gsap from 'gsap';

/** Minimal structural type of drei's OrbitControls (three-stdlib). */
export interface OrbitLike {
  target: THREE.Vector3;
  enableDamping: boolean;
  update: () => void;
  addEventListener: (type: 'start', listener: () => void) => void;
  removeEventListener: (type: 'start', listener: () => void) => void;
}

export type ViewPreset = 'home' | 'back' | 'front' | 'left' | 'right' | 'top';

const VIEW_DIRS: Record<ViewPreset, [number, number, number]> = {
  home: [0.62, 0.3, 0.72], // rear three-quarter: shows the orange back and the stack depth
  back: [0, 0, 1],
  front: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0.001],
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * CameraController: owns programmatic camera motion (reset, view presets,
 * focus-on-component, auto-framing while the assembly explodes). Manual
 * orbit / zoom / pan is handled by OrbitControls; any user gesture cancels a
 * running camera animation.
 */
export class CameraController {
  /** The attached camera (read-only use outside this class). */
  camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitLike | null = null;
  /** Running camera animation, if any. */
  tween: gsap.core.Tween | null = null;
  private lastT = 0;
  private readonly cancel = () => this.stop();

  /** Distance that frames the assembled phone. */
  readonly homeDistance = 345;

  attach(camera: THREE.PerspectiveCamera, controls: OrbitLike, t = 0): void {
    this.detach();
    this.camera = camera;
    this.controls = controls;
    this.lastT = t;
    controls.addEventListener('start', this.cancel);
  }

  detach(): void {
    this.stop();
    this.controls?.removeEventListener('start', this.cancel);
    this.camera = null;
    this.controls = null;
  }

  get attached(): boolean {
    return !!this.camera && !!this.controls;
  }

  /** How much further away the camera should be at explosion progress t. */
  static frameScale(t: number): number {
    return 1 + 0.75 * t;
  }

  /** Portrait viewports need extra distance to fit the same sphere. */
  private fitFactor(): number {
    const cam = this.camera;
    if (!cam) return 1;
    return cam.aspect < 1 ? Math.min(2.2, 0.62 / cam.aspect + 0.38) : 1;
  }

  stop(): void {
    this.tween?.kill();
    this.tween = null;
  }

  /** Smoothly move the camera and its orbit target. */
  animateTo(position: THREE.Vector3, target: THREE.Vector3, seconds = 0.9): void {
    const cam = this.camera;
    const controls = this.controls;
    if (!cam || !controls) return;
    this.stop();
    // Flush any leftover orbit / pan inertia so it cannot nudge the camera after the move.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    const p0 = cam.position.clone();
    const t0 = controls.target.clone();
    // Interpolate target linearly and the offset on a sphere for a natural arc.
    const o0 = p0.clone().sub(t0);
    const o1 = position.clone().sub(target);
    const r0 = o0.length();
    const r1 = o1.length();
    const q = new THREE.Quaternion().setFromUnitVectors(o0.clone().normalize(), o1.clone().normalize());
    const qk = new THREE.Quaternion();
    const identity = new THREE.Quaternion();
    const state = { k: 0 };
    this.tween = gsap.to(state, {
      k: 1,
      duration: seconds,
      ease: 'power2.inOut',
      onUpdate: () => {
        controls.target.lerpVectors(t0, target, state.k);
        qk.copy(identity).slerp(q, state.k);
        const dir = o0.clone().normalize().applyQuaternion(qk);
        cam.position.copy(controls.target).addScaledVector(dir, r0 + (r1 - r0) * state.k);
        controls.update();
      },
      onComplete: () => {
        this.tween = null;
        controls.target.copy(target);
        cam.position.copy(position);
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = damping;
      },
    });
  }

  /** Restore a preset view sized for the current explosion progress. */
  setView(preset: ViewPreset, t: number, seconds = 0.9): void {
    const dir = new THREE.Vector3(...VIEW_DIRS[preset]).normalize();
    if (preset === 'home') dir.applyAxisAngle(UP, CameraController.frameSwing(t));
    const dist = this.homeDistance * CameraController.frameScale(t) * this.fitFactor();
    this.animateTo(dir.multiplyScalar(dist), new THREE.Vector3(0, 0, 0), seconds);
  }

  reset(t: number): void {
    this.setView('home', t);
  }

  /** Frame a world-space bounding box, keeping the current viewing direction. */
  focusBox(box: THREE.Box3): void {
    const cam = this.camera;
    const controls = this.controls;
    if (!cam || !controls || box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const vfov = THREE.MathUtils.degToRad(cam.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
    const dist = Math.max(28, (sphere.radius * 1.35) / Math.sin(Math.min(vfov, hfov) / 2));
    const dir = cam.position.clone().sub(controls.target).normalize();
    this.animateTo(sphere.center.clone().addScaledVector(dir, dist), sphere.center.clone());
  }

  /** Extra azimuth (radians, about +Y) that turns the view side-on as the stack opens. */
  static frameSwing(t: number): number {
    return 0.5 * t;
  }

  /**
   * Auto-framing: as the assembly explodes along Z, pull the camera back and
   * swing it towards a side-on view so the layers read as a stack. Both are
   * applied as *relative* changes (distance ratio, azimuth delta), so the
   * user's own zoom and orbit are preserved and the motion reverses exactly.
   * Called every frame with the current progress.
   */
  syncExplosion(t: number, enabled: boolean): void {
    if (t === this.lastT) return;
    const ratio = CameraController.frameScale(t) / CameraController.frameScale(this.lastT);
    const swing = CameraController.frameSwing(t) - CameraController.frameSwing(this.lastT);
    this.lastT = t;
    if (!enabled || !this.camera || !this.controls || this.tween) return;
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(ratio).applyAxisAngle(UP, swing);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  /** Current camera state (used by tests and the manifest export). */
  state(): { position: number[]; target: number[]; distance: number } | null {
    if (!this.camera || !this.controls) return null;
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      distance: this.camera.position.distanceTo(this.controls.target),
    };
  }
}

export const cameraController = new CameraController();
