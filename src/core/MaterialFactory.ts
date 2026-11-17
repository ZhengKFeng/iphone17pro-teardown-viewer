import * as THREE from 'three';
import type { MaterialDefinition } from './types';

export type MaterialMode = 'product' | 'engineering';

const SELECT_COLOR = new THREE.Color('#2f9bff');

/**
 * MaterialFactory: turns MaterialDefinition data into three.js materials for
 * the two rendering modes. Each component gets its own material instances so
 * highlighting one part never bleeds into another.
 */
export const MaterialFactory = {
  create(def: MaterialDefinition, mode: MaterialMode, groupColor: string): THREE.MeshStandardMaterial {
    const transparent = def.opacity !== undefined && def.opacity < 1;
    let mat: THREE.MeshStandardMaterial;
    if (mode === 'engineering') {
      // Neutral, matte, colour-coded by sub-assembly. Openings stay dark.
      const color = def.key === 'cavity' ? '#30343b' : groupColor;
      mat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.05,
        roughness: 0.82,
        transparent,
        opacity: transparent ? 0.3 : 1,
        polygonOffset: true, // let boundary edges win the depth test
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
    } else if (def.clearcoat !== undefined) {
      mat = new THREE.MeshPhysicalMaterial({
        color: def.color,
        metalness: def.metalness,
        roughness: def.roughness,
        clearcoat: def.clearcoat,
        clearcoatRoughness: 0.08,
        transparent,
        opacity: def.opacity ?? 1,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: def.color,
        metalness: def.metalness,
        roughness: def.roughness,
        transparent,
        opacity: def.opacity ?? 1,
      });
    }
    if (mode === 'product' && def.emissive) {
      mat.emissive.set(def.emissive);
      mat.emissiveIntensity = def.emissiveIntensity ?? 1;
    }
    mat.userData.baseEmissive = mat.emissive.clone();
    mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
    return mat;
  },

  /** level: 0 = none, 1 = hovered, 2 = selected. */
  highlight(mat: THREE.MeshStandardMaterial, level: 0 | 1 | 2): void {
    const base = mat.userData.baseEmissive as THREE.Color;
    if (level === 0) {
      mat.emissive.copy(base);
      mat.emissiveIntensity = mat.userData.baseEmissiveIntensity as number;
    } else {
      mat.emissive.copy(SELECT_COLOR);
      mat.emissiveIntensity = level === 2 ? 0.55 : 0.22;
    }
  },
};
