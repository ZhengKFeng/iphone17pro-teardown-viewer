import { create } from 'zustand';
import { SelectionManager, initialSelection, type SelectionState } from '../core/SelectionManager';
import { clamp01 } from '../core/ExplosionController';

export type RenderMode = 'product' | 'engineering';
export type PlayDirection = 'forward' | 'reverse' | null;

export interface AppState extends SelectionState {
  /** explosionProgress ∈ [0, 1]: 0 = assembled, 1 = fully exploded. */
  explosion: number;
  playing: PlayDirection;
  speed: number;

  mode: RenderMode;
  wireframe: boolean;
  labels: boolean;
  axes: boolean;
  ambientOcclusion: boolean;
  autoFrame: boolean;

  expanded: Record<string, boolean>;
  treeOpen: boolean;
  inspectorOpen: boolean;

  setExplosion: (t: number) => void;
  setPlaying: (p: PlayDirection) => void;
  setSpeed: (s: number) => void;
  setMode: (m: RenderMode) => void;
  toggle: (key: 'wireframe' | 'labels' | 'axes' | 'ambientOcclusion' | 'autoFrame' | 'treeOpen' | 'inspectorOpen') => void;
  toggleExpanded: (nodeId: string) => void;

  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  isolate: (ids: string[]) => void;
  exitIsolation: () => void;
  setHidden: (ids: string[], hide: boolean) => void;
  toggleHidden: (ids: string[]) => void;
  restoreAll: () => void;
}

const wide = typeof window === 'undefined' ? true : window.innerWidth >= 1024;

const pickSelection = (s: AppState): SelectionState => ({
  selectedId: s.selectedId,
  hoveredId: s.hoveredId,
  hidden: s.hidden,
  isolated: s.isolated,
});

export const useStore = create<AppState>((set) => ({
  ...initialSelection,
  explosion: 0,
  playing: null,
  speed: 1,

  mode: 'product',
  wireframe: false,
  labels: true,
  axes: true,
  ambientOcclusion: true,
  autoFrame: true,

  expanded: { 'iphone-17-pro': true, exterior: true, interior: true },
  treeOpen: wide,
  inspectorOpen: wide,

  setExplosion: (t) => set({ explosion: clamp01(t) }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setMode: (mode) => set({ mode }),
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<AppState>),
  toggleExpanded: (nodeId) => set((s) => ({ expanded: { ...s.expanded, [nodeId]: !s.expanded[nodeId] } })),

  select: (id) => set((s) => SelectionManager.select(pickSelection(s), id)),
  hover: (id) => set((s) => SelectionManager.hover(pickSelection(s), id)),
  isolate: (ids) => set((s) => SelectionManager.isolate(pickSelection(s), ids)),
  exitIsolation: () => set((s) => SelectionManager.exitIsolation(pickSelection(s))),
  setHidden: (ids, hide) => set((s) => SelectionManager.setHidden(pickSelection(s), ids, hide)),
  toggleHidden: (ids) => set((s) => SelectionManager.toggleHidden(pickSelection(s), ids)),
  restoreAll: () => set((s) => SelectionManager.restoreAll(pickSelection(s))),
}));

export const isVisible = (s: AppState, id: string) => SelectionManager.isVisible(s, id);
