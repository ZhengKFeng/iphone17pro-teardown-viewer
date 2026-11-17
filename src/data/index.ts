import { AssemblyTree } from '../core/AssemblyTree';
import { ComponentRegistry } from '../core/ComponentRegistry';
import { ExplosionController } from '../core/ExplosionController';
import { assemblyNodes } from './assembly';
import { exteriorComponents } from './exterior';
import { interiorComponents } from './interior';

/** Build a fresh, independent model (registry + tree + explosion controller). */
export function createModel() {
  const registry = new ComponentRegistry([...exteriorComponents, ...interiorComponents]);
  const tree = new AssemblyTree(assemblyNodes, registry);
  const explosion = new ExplosionController(registry);
  return { registry, tree, explosion };
}

/** The application's default model instance. */
export const model = createModel();
export const { registry, tree, explosion } = model;

export { PHONE } from './dimensions';
export { MATERIALS, getMaterial, ENGINEERING_COLORS } from './materials';
