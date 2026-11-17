/**
 * SelectionManager: pure state transitions for selection, hiding and
 * isolation. It is framework-free; the zustand store delegates to it and the
 * tests exercise it directly.
 */

export interface SelectionState {
  selectedId: string | null;
  hoveredId: string | null;
  /** Ids explicitly hidden by the user. */
  hidden: Record<string, true>;
  /** When set, only these component ids are shown. */
  isolated: string[] | null;
}

export const initialSelection: SelectionState = {
  selectedId: null,
  hoveredId: null,
  hidden: {},
  isolated: null,
};

export const SelectionManager = {
  isVisible(s: SelectionState, id: string): boolean {
    if (s.isolated) return s.isolated.includes(id);
    return !s.hidden[id];
  },

  select(s: SelectionState, id: string | null): SelectionState {
    return s.selectedId === id ? s : { ...s, selectedId: id };
  },

  hover(s: SelectionState, id: string | null): SelectionState {
    return s.hoveredId === id ? s : { ...s, hoveredId: id };
  },

  /** Show only the given components (and select the first one). */
  isolate(s: SelectionState, ids: string[]): SelectionState {
    if (ids.length === 0) return s;
    return { ...s, isolated: [...ids], selectedId: ids.length === 1 ? ids[0] : s.selectedId };
  },

  /** Leave isolation but keep the user's hidden set. */
  exitIsolation(s: SelectionState): SelectionState {
    return s.isolated ? { ...s, isolated: null } : s;
  },

  /** Hide or show a set of components. Hiding the selection deselects it. */
  setHidden(s: SelectionState, ids: string[], hide: boolean): SelectionState {
    const hidden = { ...s.hidden };
    for (const id of ids) {
      if (hide) hidden[id] = true;
      else delete hidden[id];
    }
    const selectedId = hide && s.selectedId && ids.includes(s.selectedId) ? null : s.selectedId;
    return { ...s, hidden, selectedId };
  },

  toggleHidden(s: SelectionState, ids: string[]): SelectionState {
    const anyVisible = ids.some((id) => !s.hidden[id]);
    return this.setHidden(s, ids, anyVisible);
  },

  /** Restore the complete assembly: nothing hidden, nothing isolated. */
  restoreAll(s: SelectionState): SelectionState {
    return { ...s, hidden: {}, isolated: null };
  },
};
