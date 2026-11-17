import type { TreeView } from '../core/AssemblyTree';
import { registry, tree } from '../data';
import { focusComponent } from '../scene/actions';
import { isVisible, useStore } from '../state/store';
import { ChevronIcon, EyeIcon, EyeOffIcon, IsolateIcon } from './icons';

function ComponentRow({ id, depth }: { id: string; depth: number }) {
  const def = registry.get(id);
  const selected = useStore((s) => s.selectedId === id);
  const hovered = useStore((s) => s.hoveredId === id);
  const visible = useStore((s) => isVisible(s, id));
  const { select, hover, toggleHidden, exitIsolation } = useStore.getState();
  return (
    <div
      data-testid={`tree-item-${id}`}
      className={`group flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-xs ${
        selected ? 'bg-sky-400/20 text-sky-100' : hovered ? 'bg-white/10 text-neutral-100' : 'text-neutral-300 hover:bg-white/5'
      } ${visible ? '' : 'opacity-45'}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => select(id)}
      onDoubleClick={() => focusComponent(id)}
      onMouseEnter={() => hover(id)}
      onMouseLeave={() => hover(null)}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${def.provenance === 'verified' ? 'bg-emerald-400' : def.provenance === 'reported' ? 'bg-amber-400' : 'bg-neutral-500'}`} />
      <span className="truncate">{def.name}</span>
      <button
        className="ml-auto shrink-0 rounded p-1 text-neutral-400 opacity-60 hover:bg-white/10 hover:text-white group-hover:opacity-100"
        title={visible ? 'Hide' : 'Show'}
        data-testid={`tree-eye-${id}`}
        onClick={(e) => {
          e.stopPropagation();
          if (useStore.getState().isolated) exitIsolation();
          else toggleHidden([id]);
        }}
      >
        {visible ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
      </button>
    </div>
  );
}

function NodeRow({ view, depth }: { view: TreeView; depth: number }) {
  const id = view.node.id;
  const open = useStore((s) => !!s.expanded[id]);
  const all = tree.descendantComponents(id);
  const visibleCount = useStore((s) => all.filter((c) => isVisible(s, c)).length);
  const { toggleExpanded, toggleHidden, isolate, setHidden, exitIsolation } = useStore.getState();
  return (
    <div>
      <div
        data-testid={`tree-node-${id}`}
        className="group flex h-7 cursor-pointer items-center gap-1 rounded-md pr-1 text-xs font-medium text-neutral-200 hover:bg-white/5"
        style={{ paddingLeft: 2 + depth * 14 }}
        onClick={() => toggleExpanded(id)}
      >
        <span className={`shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-90' : ''}`}>
          <ChevronIcon size={12} />
        </span>
        <span className="truncate">{view.node.name}</span>
        <span className="ml-1 shrink-0 font-mono text-[10px] text-neutral-500">
          {visibleCount === all.length ? all.length : `${visibleCount}/${all.length}`}
        </span>
        <button
          className="ml-auto shrink-0 rounded p-1 text-neutral-400 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100"
          title="Isolate this sub-assembly"
          data-testid={`tree-isolate-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            isolate(all);
          }}
        >
          <IsolateIcon size={13} />
        </button>
        <button
          className="shrink-0 rounded p-1 text-neutral-400 opacity-60 hover:bg-white/10 hover:text-white group-hover:opacity-100"
          title={visibleCount > 0 ? 'Hide sub-assembly' : 'Show sub-assembly'}
          data-testid={`tree-node-eye-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            if (useStore.getState().isolated) {
              exitIsolation();
              setHidden(all, false);
            } else toggleHidden(all);
          }}
        >
          {visibleCount > 0 ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
        </button>
      </div>
      {open && (
        <div>
          {view.children.map((c) => (
            <NodeRow key={c.node.id} view={c} depth={depth + 1} />
          ))}
          {view.componentIds.map((cid) => (
            <ComponentRow key={cid} id={cid} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AssemblyTreePanel() {
  const total = registry.size;
  const shown = useStore((s) => registry.ids().filter((id) => isVisible(s, id)).length);
  const restoreAll = useStore((s) => s.restoreAll);
  return (
    <div className="panel pointer-events-auto flex max-h-full w-72 max-w-[86vw] flex-col" data-testid="assembly-tree">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <div className="section-title">Assembly tree</div>
          <div className="text-[11px] text-neutral-400">
            {shown} of {total} components shown
          </div>
        </div>
        <button className="btn" disabled={shown === total} onClick={restoreAll} data-testid="btn-show-all" title="Restore the complete assembly">
          Show all
        </button>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        <NodeRow view={tree.view()} depth={0} />
      </div>
      <div className="flex items-center gap-3 border-t border-white/10 px-3 py-1.5 text-[10px] text-neutral-400">
        <span className="flex items-center gap-1">
          <i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Apple spec
        </span>
        <span className="flex items-center gap-1">
          <i className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Public teardown
        </span>
        <span className="flex items-center gap-1">
          <i className="h-1.5 w-1.5 rounded-full bg-neutral-500" /> Approximated
        </span>
      </div>
    </div>
  );
}
