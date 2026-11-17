import type { ComponentDefinition, ComponentMetadata } from './types';

/**
 * ComponentRegistry: the single source of truth for component definitions.
 * Components can be registered or replaced at runtime (e.g. swapping a
 * procedural part for a CAD-derived mesh) without touching the renderer.
 */
export class ComponentRegistry {
  private readonly map = new Map<string, ComponentDefinition>();
  private order: string[] = [];

  constructor(defs: ComponentDefinition[] = []) {
    for (const d of defs) this.register(d);
  }

  register(def: ComponentDefinition): void {
    if (this.map.has(def.id)) throw new Error(`Duplicate component id: ${def.id}`);
    if (!(def.stage.start >= 0 && def.stage.start < def.stage.end && def.stage.end <= 1)) {
      throw new Error(`Invalid explosion stage for ${def.id}`);
    }
    this.map.set(def.id, def);
    this.order.push(def.id);
  }

  /** Replace an existing definition (keeps ordering). */
  replace(def: ComponentDefinition): void {
    if (!this.map.has(def.id)) throw new Error(`Unknown component id: ${def.id}`);
    this.map.set(def.id, def);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  get(id: string): ComponentDefinition {
    const d = this.map.get(id);
    if (!d) throw new Error(`Unknown component id: ${id}`);
    return d;
  }

  all(): ComponentDefinition[] {
    return this.order.map((id) => this.map.get(id)!);
  }

  ids(): string[] {
    return [...this.order];
  }

  byAssembly(assemblyId: string): ComponentDefinition[] {
    return this.all().filter((d) => d.assembly === assemblyId);
  }

  metadata(id: string): ComponentMetadata {
    const { assembled: _a, exploded: _e, stage: _s, visible: _v, geometry: _g, ...meta } = this.get(id);
    return meta;
  }

  get size(): number {
    return this.map.size;
  }
}
