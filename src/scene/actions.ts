import * as THREE from 'three';
import { cameraController } from '../core/CameraController';
import { poseAt } from '../core/ExplosionController';
import { GeometryFactory } from '../core/GeometryFactory';
import { buildManifest, canvasToPNG, download, exportGLB } from '../core/SceneExporter';
import { registry, tree } from '../data';
import { isVisible, useStore } from '../state/store';

/** Scene objects the UI needs to reach (set by the viewer once mounted). */
export const sceneRefs: { root: THREE.Object3D | null; canvas: HTMLCanvasElement | null } = { root: null, canvas: null };

/** World-space bounding box of a component at the current explosion progress. */
export function worldBox(id: string, t = useStore.getState().explosion): THREE.Box3 {
  const def = registry.get(id);
  const pose = poseAt(def, t);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pose.position), new THREE.Quaternion(...pose.quaternion), new THREE.Vector3(1, 1, 1));
  return GeometryFactory.componentBox(def).applyMatrix4(m);
}

export function focusComponent(id: string): void {
  cameraController.focusBox(worldBox(id));
}

export function focusVisible(): void {
  const s = useStore.getState();
  const box = new THREE.Box3();
  for (const id of registry.ids()) if (isVisible(s, id)) box.union(worldBox(id));
  cameraController.focusBox(box);
}

export function resetCamera(): void {
  cameraController.reset(useStore.getState().explosion);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export const exportActions = {
  png() {
    if (sceneRefs.canvas) download(canvasToPNG(sceneRefs.canvas), `teardown-${stamp()}.png`);
  },
  async glb() {
    if (!sceneRefs.root) return;
    const buffer = await exportGLB(sceneRefs.root);
    download(new Blob([buffer], { type: 'model/gltf-binary' }), `teardown-${stamp()}.glb`);
  },
  manifest() {
    const s = useStore.getState();
    const hiddenIds = registry.ids().filter((id) => !isVisible(s, id));
    const json = JSON.stringify(buildManifest(registry, tree, { explosionProgress: s.explosion, hiddenIds }), null, 2);
    download(new Blob([json], { type: 'application/json' }), `teardown-manifest-${stamp()}.json`);
  },
};
