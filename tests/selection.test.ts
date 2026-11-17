import { describe, expect, it } from 'vitest';
import { SelectionManager, initialSelection } from '../src/core/SelectionManager';
import { createModel } from '../src/data';
import { parseAsset, formatFromUrl, collectGeometries } from '../src/core/AssetLoader';

const { registry, tree } = createModel();
const ids = registry.ids();
const visible = (s: typeof initialSelection) => ids.filter((id) => SelectionManager.isVisible(s, id));

describe('selection manager', () => {
  it('shows everything by default', () => {
    expect(visible(initialSelection)).toEqual(ids);
  });

  it('isolates a single component and restores the full assembly', () => {
    let s = SelectionManager.isolate(initialSelection, ['battery']);
    expect(visible(s)).toEqual(['battery']);
    expect(s.selectedId).toBe('battery');
    s = SelectionManager.restoreAll(s);
    expect(visible(s)).toEqual(ids);
  });

  it('isolates a whole sub-assembly', () => {
    const group = tree.descendantComponents('thermal');
    const s = SelectionManager.isolate(initialSelection, group);
    expect(visible(s).sort()).toEqual([...group].sort());
  });

  it('hides and shows components; hiding the selection clears it', () => {
    let s = SelectionManager.select(initialSelection, 'front-glass');
    s = SelectionManager.setHidden(s, ['front-glass', 'display-panel'], true);
    expect(s.selectedId).toBeNull();
    expect(visible(s)).not.toContain('front-glass');
    expect(visible(s)).not.toContain('display-panel');
    expect(visible(s)).toHaveLength(ids.length - 2);
    s = SelectionManager.toggleHidden(s, ['front-glass']);
    expect(visible(s)).toContain('front-glass');
  });

  it('keeps the hidden set when leaving isolation, clears it on restoreAll', () => {
    let s = SelectionManager.setHidden(initialSelection, ['rear-glass'], true);
    s = SelectionManager.isolate(s, ['battery']);
    s = SelectionManager.exitIsolation(s);
    expect(visible(s)).not.toContain('rear-glass');
    s = SelectionManager.restoreAll(s);
    expect(visible(s)).toEqual(ids);
  });

  it('does not mutate the previous state', () => {
    const before = JSON.stringify(initialSelection);
    SelectionManager.setHidden(initialSelection, ['battery'], true);
    SelectionManager.isolate(initialSelection, ['battery']);
    expect(JSON.stringify(initialSelection)).toBe(before);
  });
});

describe('asset loader (future CAD import path)', () => {
  it('detects formats from file names', () => {
    expect(formatFromUrl('/models/frame.GLB')).toBe('glb');
    expect(formatFromUrl('/models/frame.stl?v=2')).toBe('stl');
    expect(formatFromUrl('/models/frame.obj')).toBe('obj');
    expect(formatFromUrl('/models/frame.step')).toBeNull();
  });

  it('parses an in-memory ASCII STL', async () => {
    const stl = `solid t
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 10 0 0
  vertex 0 10 0
 endloop
endfacet
endsolid t`;
    const obj = await parseAsset('stl', stl);
    const geos = collectGeometries(obj);
    expect(geos).toHaveLength(1);
    expect(geos[0].attributes.position.count).toBe(3);
  });

  it('parses an in-memory OBJ', async () => {
    const obj = await parseAsset('obj', 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
    expect(collectGeometries(obj)[0].attributes.position.count).toBe(3);
  });
});
