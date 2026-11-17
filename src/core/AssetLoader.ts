import * as THREE from 'three';
import type { AssetFormat } from './types';

/**
 * AssetLoader: extension point for replacing procedural geometry with
 * CAD-derived meshes. The default demo never calls it (no external assets).
 *
 * STEP files cannot be read by a browser directly – tessellate them first
 * (FreeCAD, CAD Assistant, Abaqus/CAE export, or occt-import-js) to GLB, STL
 * or OBJ, then reference the file from a component's `geometry` field:
 *   geometry: { type: 'asset', format: 'glb', url: '/models/battery.glb' }
 */

export function formatFromUrl(url: string): AssetFormat | null {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf') return 'glb';
  if (ext === 'stl') return 'stl';
  if (ext === 'obj') return 'obj';
  return null;
}

/** Parse an in-memory asset into an Object3D (loaders are code-split). */
export async function parseAsset(format: AssetFormat, data: ArrayBuffer | string): Promise<THREE.Object3D> {
  if (format === 'stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const geometry = new STLLoader().parse(data);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    return new THREE.Mesh(geometry);
  }
  if (format === 'obj') {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    return new OBJLoader().parse(text);
  }
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data;
  const gltf = await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '');
  return gltf.scene;
}

export async function loadAsset(format: AssetFormat, url: string): Promise<THREE.Object3D> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load asset ${url}: HTTP ${res.status}`);
  return parseAsset(format, format === 'obj' ? await res.text() : await res.arrayBuffer());
}

/** All mesh geometries of a loaded asset, with world transforms baked in. */
export function collectGeometries(root: THREE.Object3D): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) out.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
  });
  return out;
}
