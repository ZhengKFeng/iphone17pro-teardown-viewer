import { useMemo } from 'react';
import * as THREE from 'three';
import { cameraController, type ViewPreset } from '../core/CameraController';
import { GeometryFactory } from '../core/GeometryFactory';
import type { Provenance } from '../core/types';
import { getMaterial, registry, tree } from '../data';
import { focusComponent } from '../scene/actions';
import { isVisible, useStore } from '../state/store';
import { EyeOffIcon, IsolateIcon, TargetIcon } from './icons';

const PROVENANCE: Record<Provenance, { label: string; cls: string }> = {
  verified: { label: 'Listed in Apple tech specs', cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' },
  reported: { label: 'Reported by public teardown', cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  approximated: { label: 'Approximated', cls: 'border-neutral-400/30 bg-white/5 text-neutral-300' },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="kv-label">{label}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-neutral-200">{children}</div>
    </div>
  );
}

function Toggle({ label, value, onChange, testId }: { label: string; value: boolean; onChange: () => void; testId?: string }) {
  return (
    <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-neutral-300 hover:bg-white/5" onClick={onChange} data-testid={testId} role="switch" aria-checked={value}>
      <span>{label}</span>
      <span className={`relative h-4 w-7 rounded-full transition-colors ${value ? 'bg-ember-500' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${value ? 'left-3.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function ComponentDetails({ id }: { id: string }) {
  const def = registry.get(id);
  const isolated = useStore((s) => s.isolated);
  const visible = useStore((s) => isVisible(s, id));
  const { isolate, restoreAll, setHidden } = useStore.getState();
  const path = tree.pathOf(id);
  const material = getMaterial(def.material);
  const info = useMemo(() => {
    const size = GeometryFactory.componentBox(def).getSize(new THREE.Vector3());
    const parts = def.geometry.type === 'procedural' ? def.geometry.parts.length : 0;
    return { size, parts, tris: GeometryFactory.triangleCount(def) };
  }, [def]);
  const prov = PROVENANCE[def.provenance];
  const isIsolated = !!isolated && isolated.length === 1 && isolated[0] === id;

  return (
    <div className="space-y-3" data-testid="inspector-details">
      <div>
        <div className="section-title">Selected component</div>
        <h2 className="mt-1 text-base font-semibold leading-tight text-white" data-testid="inspector-name">
          {def.name}
        </h2>
        <div className="mt-0.5 font-mono text-[10px] text-neutral-500">{def.id}</div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {isIsolated ? (
          <button className="btn btn-active" onClick={restoreAll} data-testid="btn-restore">
            <IsolateIcon /> Restore assembly
          </button>
        ) : (
          <button className="btn" onClick={() => isolate([id])} data-testid="btn-isolate">
            <IsolateIcon /> Isolate
          </button>
        )}
        <button className="btn" onClick={() => focusComponent(id)} data-testid="btn-focus" title="Focus camera (double-click the part)">
          <TargetIcon /> Focus
        </button>
        <button className="btn" onClick={() => setHidden([id], visible)} data-testid="btn-hide">
          <EyeOffIcon /> {visible ? 'Hide' : 'Show'}
        </button>
      </div>

      <Field label="Assembly">
        <span data-testid="inspector-assembly">{path.map((n) => n.name).join('  ›  ')}</span>
      </Field>
      <Field label="Classification">{def.classification}</Field>
      <Field label="Material">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm border border-white/20" style={{ background: material.color }} />
          <span data-testid="inspector-material">{material.label}</span>
        </span>
        {def.materialNote && <div className="text-neutral-400">{def.materialNote}</div>}
      </Field>
      <Field label="Purpose">{def.purpose}</Field>
      <Field label="Description">{def.description}</Field>
      <Field label="Data confidence">
        <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${prov.cls}`}>{prov.label}</span>
        <div className="mt-1 text-neutral-400">{def.provenanceNote}</div>
      </Field>
      <Field label="Model geometry (approximate)">
        <span className="font-mono text-[11px]">
          {info.size.x.toFixed(1)} × {info.size.y.toFixed(1)} × {info.size.z.toFixed(2)} mm
        </span>
        <span className="text-neutral-500">
          {' '}
          · {info.parts} primitives · {info.tris.toLocaleString()} triangles
        </span>
      </Field>
    </div>
  );
}

const VIEWS: { key: ViewPreset; label: string }[] = [
  { key: 'home', label: 'Iso' },
  { key: 'back', label: 'Back' },
  { key: 'front', label: 'Front' },
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'top', label: 'Top' },
];

function ViewOptions() {
  const mode = useStore((s) => s.mode);
  const s = useStore();
  return (
    <div className="space-y-2">
      <div className="section-title">View</div>
      <div className="grid grid-cols-6 gap-1">
        {VIEWS.map((v) => (
          <button key={v.key} className="btn px-0 text-[11px]" data-testid={`view-${v.key}`} onClick={() => cameraController.setView(v.key, useStore.getState().explosion)}>
            {v.label}
          </button>
        ))}
      </div>
      <div>
        <Toggle label="Ambient occlusion" value={s.ambientOcclusion} onChange={() => s.toggle('ambientOcclusion')} testId="toggle-ao" />
        <Toggle label="Auto-frame while exploding" value={s.autoFrame} onChange={() => s.toggle('autoFrame')} testId="toggle-autoframe" />
        {mode === 'engineering' && (
          <>
            <Toggle label="Component labels" value={s.labels} onChange={() => s.toggle('labels')} testId="toggle-labels" />
            <Toggle label="Wireframe overlay" value={s.wireframe} onChange={() => s.toggle('wireframe')} testId="toggle-wireframe" />
            <Toggle label="Coordinate axes" value={s.axes} onChange={() => s.toggle('axes')} testId="toggle-axes" />
          </>
        )}
      </div>
    </div>
  );
}

export function InspectorPanel() {
  const selectedId = useStore((s) => s.selectedId);
  return (
    <div className="panel pointer-events-auto flex max-h-full w-80 max-w-[90vw] flex-col" data-testid="inspector">
      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {selectedId ? (
          <ComponentDetails id={selectedId} />
        ) : (
          <div data-testid="inspector-empty">
            <div className="section-title">Inspector</div>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
              Click a part in the 3D view or in the assembly tree to inspect it. Double-click to focus the camera on it.
            </p>
            <ul className="mt-2 space-y-1 text-[11px] text-neutral-500">
              <li>Left-drag · rotate</li>
              <li>Wheel / pinch · zoom</li>
              <li>Right-drag / two-finger drag · pan</li>
              <li>Space · play / pause &nbsp; Esc · deselect &nbsp; F · focus &nbsp; R · reset view</li>
            </ul>
          </div>
        )}
        <div className="border-t border-white/10 pt-3">
          <ViewOptions />
        </div>
        <p className="border-t border-white/10 pt-2 text-[10px] leading-relaxed text-neutral-500">
          Educational procedural model. Only the outer dimensions (150 × 71.9 × 8.75 mm) come from Apple&apos;s published specifications; internal shapes, sizes and
          positions are approximations and do not represent Apple&apos;s CAD data.
        </p>
      </div>
    </div>
  );
}
