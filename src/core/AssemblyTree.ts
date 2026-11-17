import type { AssemblyNode } from './types';
import type { ComponentRegistry } from './ComponentRegistry';

export interface TreeView {
  node: AssemblyNode;
  children: TreeView[];
  componentIds: string[];
}

/**
 * AssemblyTree: hierarchical relationships between sub-assemblies and
 * components. Nodes are sub-assemblies; components are leaves that reference
 * their parent node through `ComponentDefinition.assembly`.
 */
export class AssemblyTree {
  private readonly nodes = new Map<string, AssemblyNode>();
  private readonly childNodes = new Map<string, string[]>();
  readonly rootId: string;

  constructor(
    nodes: AssemblyNode[],
    private readonly registry: ComponentRegistry,
  ) {
    let root: string | null = null;
    for (const n of nodes) {
      if (this.nodes.has(n.id)) throw new Error(`Duplicate assembly node: ${n.id}`);
      this.nodes.set(n.id, n);
      if (n.parent === null) {
        if (root) throw new Error('Assembly tree must have exactly one root');
        root = n.id;
      }
    }
    if (!root) throw new Error('Assembly tree has no root');
    this.rootId = root;
    for (const n of nodes) {
      if (n.parent === null) continue;
      if (!this.nodes.has(n.parent)) throw new Error(`Node ${n.id} has unknown parent ${n.parent}`);
      const list = this.childNodes.get(n.parent) ?? [];
      list.push(n.id);
      this.childNodes.set(n.parent, list);
    }
  }

  node(id: string): AssemblyNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Unknown assembly node: ${id}`);
    return n;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  nodeIds(): string[] {
    return [...this.nodes.keys()];
  }

  children(id: string): AssemblyNode[] {
    return (this.childNodes.get(id) ?? []).map((c) => this.nodes.get(c)!);
  }

  /** Components attached directly to this node. */
  components(id: string): string[] {
    return this.registry.byAssembly(id).map((d) => d.id);
  }

  /** All components below this node (any depth). */
  descendantComponents(id: string): string[] {
    const out = [...this.components(id)];
    for (const c of this.children(id)) out.push(...this.descendantComponents(c.id));
    return out;
  }

  /** Node path from the root down to the component's parent node. */
  pathOf(componentId: string): AssemblyNode[] {
    const path: AssemblyNode[] = [];
    let cur: string | null = this.registry.get(componentId).assembly;
    const guard = new Set<string>();
    while (cur !== null) {
      if (guard.has(cur)) throw new Error(`Cycle in assembly tree at ${cur}`);
      guard.add(cur);
      const n = this.node(cur);
      path.unshift(n);
      cur = n.parent;
    }
    return path;
  }

  /** Id of the sub-assembly directly below Exterior/Interior (colour grouping). */
  groupOf(componentId: string): string {
    return this.registry.get(componentId).assembly;
  }

  view(id: string = this.rootId): TreeView {
    return {
      node: this.node(id),
      children: this.children(id).map((c) => this.view(c.id)),
      componentIds: this.components(id),
    };
  }

  /** Structural checks; returns a list of problems (empty = valid). */
  validate(): string[] {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const def of this.registry.all()) {
      if (!this.nodes.has(def.assembly)) {
        problems.push(`Component ${def.id} references unknown assembly ${def.assembly}`);
        continue;
      }
      try {
        const path = this.pathOf(def.id);
        if (path[0]?.id !== this.rootId) problems.push(`Component ${def.id} is not attached to the root`);
      } catch (e) {
        problems.push(String(e));
      }
      seen.add(def.id);
    }
    const reachable = this.descendantComponents(this.rootId);
    if (reachable.length !== this.registry.size) {
      problems.push(`Tree reaches ${reachable.length} components but registry has ${this.registry.size}`);
    }
    if (new Set(reachable).size !== reachable.length) problems.push('A component appears twice in the tree');
    for (const id of this.nodes.keys()) {
      if (id !== this.rootId && this.descendantComponents(id).length === 0) problems.push(`Assembly node ${id} is empty`);
    }
    return problems;
  }
}
