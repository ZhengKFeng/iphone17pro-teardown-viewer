import * as THREE from 'three';
import type { AssemblyTree } from './AssemblyTree';
import type { ComponentRegistry } from './ComponentRegistry';
import { poseAt } from './ExplosionController';
import { GeometryFactory } from './GeometryFactory';

/**
 * SceneExporter: serialises the current assembly state.
 *  - manifest(): JSON description (hierarchy, metadata, transforms) – no WebGL needed
 *  - glb():      binary glTF of the visible assembly at the current pose
 *  - png():      screenshot of the canvas
 */

export interface ManifestOptions {
  explosionProgress: number;
  hiddenIds?: string[];
}

export function buildManifest(registry: ComponentRegistry, tree: AssemblyTree, opts: ManifestOptions) {
  const hidden = new Set(opts.hiddenIds ?? []);
  return {
    schema: 'teardown-manifest/1',
    generator: 'iphone17pro-teardown (procedural approximation – not manufacturer CAD)',
    units: 'mm',
    axes: '+X right (viewed from the back), +Y top, +Z out of the back',
    explosionProgress: opts.explosionProgress,
    assemblies: tree.nodeIds().map((id) => {
      const n = tree.node(id);
      return { id: n.id, name: n.name, parent: n.parent };
    }),
    components: registry.all().map((def) => {
      const pose = poseAt(def, opts.explosionProgress);
      const box = GeometryFactory.componentBox(def);
      return {
        id: def.id,
        name: def.name,
        assembly: def.assembly,
        assemblyPath: tree.pathOf(def.id).map((n) => n.id),
        classification: def.classification,
        material: def.material,
        provenance: def.provenance,
        visible: !hidden.has(def.id),
        geometrySource: def.geometry.type,
        assembled: def.assembled,
        exploded: def.exploded,
        stage: def.stage,
        current: pose,
        localBounds: { min: box.min.toArray(), max: box.max.toArray() },
      };
    }),
  };
}

/** Export an Object3D subtree as binary glTF. Helper objects are stripped. */
export async function exportGLB(root: THREE.Object3D): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const clone = root.clone(true);
  const strip: THREE.Object3D[] = [];
  clone.traverse((o) => {
    if (o.userData.helper || (o as THREE.LineSegments).isLineSegments) strip.push(o);
  });
  strip.forEach((o) => o.parent?.remove(o));
  clone.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(clone, { binary: true, onlyVisible: true });
  return result as ArrayBuffer;
}

export function canvasToPNG(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export function download(data: Blob | string, filename: string): void {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 2000);
}
