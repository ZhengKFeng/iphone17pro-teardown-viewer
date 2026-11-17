import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { cameraController } from './core/CameraController';
import { model } from './data';
import { Viewer } from './scene/Viewer';
import { exportActions, focusComponent, focusVisible, resetCamera, sceneRefs, worldBox } from './scene/actions';
import { Playback } from './state/playback';
import { useStore } from './state/store';
import { AssemblyTreePanel } from './ui/AssemblyTreePanel';
import { ExplosionControls } from './ui/ExplosionControls';
import { InspectorPanel } from './ui/InspectorPanel';
import { CloseIcon, DownloadIcon, HomeIcon, InfoIcon, IsolateIcon, LayersIcon, TargetIcon } from './ui/icons';

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
        if (!(el instanceof HTMLInputElement && el.type === 'range' && e.code === 'Space')) return;
      }
      const s = useStore.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        Playback.toggle();
      } else if (e.key === 'Escape') {
        if (s.isolated) s.exitIsolation();
        else s.select(null);
      } else if (e.key === 'f' || e.key === 'F') {
        if (s.selectedId) focusComponent(s.selectedId);
        else focusVisible();
      } else if (e.key === 'r' || e.key === 'R') {
        resetCamera();
      } else if (e.key === 'i' || e.key === 'I') {
        if (s.selectedId) s.isolate([s.selectedId]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const item = (label: string, hint: string, fn: () => void | Promise<void>, testId: string) => (
    <button
      className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-white/10"
      data-testid={testId}
      onClick={() => {
        setOpen(false);
        void fn();
      }}
    >
      <span className="text-xs text-neutral-100">{label}</span>
      <span className="text-[10px] text-neutral-500">{hint}</span>
    </button>
  );
  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen((o) => !o)} data-testid="btn-export" title="Export">
        <DownloadIcon /> <span className="hidden md:inline">Export</span>
      </button>
      {open && (
        <div className="panel absolute right-0 top-10 z-50 w-56 p-1">
          {item('Screenshot (PNG)', 'Current view at screen resolution', exportActions.png, 'export-png')}
          {item('Scene (GLB)', 'Visible parts at the current explosion state', exportActions.glb, 'export-glb')}
          {item('Assembly manifest (JSON)', 'Hierarchy, metadata and transforms', exportActions.manifest, 'export-json')}
        </div>
      )}
    </div>
  );
}

function Header() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const toggle = useStore((s) => s.toggle);
  const treeOpen = useStore((s) => s.treeOpen);
  const inspectorOpen = useStore((s) => s.inspectorOpen);
  return (
    <header className="pointer-events-auto flex items-center gap-2 px-3 py-2">
      <button
        className={`btn btn-icon ${treeOpen ? 'btn-active' : ''}`}
        onClick={() => {
          if (!treeOpen && inspectorOpen && window.innerWidth < 720) toggle('inspectorOpen');
          toggle('treeOpen');
        }} title="Assembly tree" data-testid="btn-toggle-tree">
        <LayersIcon />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight text-white">
          iPhone 17 Pro <span className="font-normal text-neutral-400">· 3D teardown</span>
        </h1>
        <p className="hidden truncate text-[10px] text-neutral-500 sm:block">Procedural approximation · not manufacturer CAD</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="flex rounded-md border border-white/10 bg-white/5 p-0.5" role="tablist" aria-label="Rendering mode">
          {(['product', 'engineering'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              data-testid={`mode-${m}`}
              className={`h-7 rounded px-2.5 text-xs font-medium capitalize transition-colors ${mode === m ? 'bg-ember-500 text-ink-950' : 'text-neutral-300 hover:text-white'}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <button className="btn" onClick={resetCamera} title="Reset camera (R)" data-testid="btn-reset-camera">
          <HomeIcon /> <span className="hidden md:inline">Reset view</span>
        </button>
        <ExportMenu />
        <button
          className={`btn btn-icon ${inspectorOpen ? 'btn-active' : ''}`}
          onClick={() => {
            if (!inspectorOpen && treeOpen && window.innerWidth < 720) toggle('treeOpen');
            toggle('inspectorOpen');
          }} title="Inspector" data-testid="btn-toggle-inspector">
          <InfoIcon />
        </button>
      </div>
    </header>
  );
}

/** Compact selection bar shown when the inspector panel is closed (e.g. on phones). */
function SelectionChip() {
  const id = useStore((s) => s.selectedId);
  const inspectorOpen = useStore((s) => s.inspectorOpen);
  const isolated = useStore((s) => s.isolated);
  if (inspectorOpen || (!id && !isolated)) return null;
  const s = useStore.getState();
  return (
    <div className="panel pointer-events-auto flex max-w-full items-center gap-1.5 px-2 py-1.5" data-testid="selection-chip">
      <span className="min-w-0 truncate px-1 text-xs font-medium text-white">{id ? model.registry.get(id).name : 'Isolated view'}</span>
      {id && (
        <>
          <button className="btn btn-icon" title="Focus" onClick={() => focusComponent(id)}>
            <TargetIcon />
          </button>
          <button className="btn btn-icon" title="Details" onClick={() => s.toggle('inspectorOpen')}>
            <InfoIcon />
          </button>
        </>
      )}
      {isolated ? (
        <button className="btn btn-active" onClick={s.restoreAll}>
          Restore
        </button>
      ) : (
        id && (
          <button className="btn btn-icon" title="Isolate" onClick={() => s.isolate([id])}>
            <IsolateIcon />
          </button>
        )
      )}
      {id && (
        <button className="btn btn-icon" title="Deselect" onClick={() => s.select(null)}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();
  const treeOpen = useStore((s) => s.treeOpen);
  const inspectorOpen = useStore((s) => s.inspectorOpen);

  // Debug / automated-test hook (read-only handles; harmless in production).
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__teardown = { store: useStore, model, cameraController, Playback, sceneRefs, worldBox, gsap };
  }, []);

  return (
    <div className="relative h-full w-full select-none font-sans">
      <div className="absolute inset-0">
        <Viewer />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <Header />
        <div className="flex min-h-0 flex-1 items-start justify-between gap-2 px-3 pb-2">
          <div className="flex max-h-full min-h-0">{treeOpen && <AssemblyTreePanel />}</div>
          <div className="flex max-h-full min-h-0">{inspectorOpen && <InspectorPanel />}</div>
        </div>
        <div className="flex flex-col items-center gap-2 px-3 pb-3">
          <SelectionChip />
          <ExplosionControls />
        </div>
      </div>
    </div>
  );
}
