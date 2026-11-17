import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { ComponentDefinition, PartSpec } from '../core/types';
import { GeometryFactory } from '../core/GeometryFactory';
import { MaterialFactory } from '../core/MaterialFactory';
import { collectGeometries, loadAsset } from '../core/AssetLoader';
import { ENGINEERING_COLORS, explosion, getMaterial } from '../data';
import { isVisible, useStore } from '../state/store';
import { focusComponent } from './actions';

const noRaycast = () => null;
const DOUBLE_CLICK_MS = 340;

interface RenderPart {
  key: string;
  geometry: THREE.BufferGeometry;
  edges: THREE.BufferGeometry | null;
  material: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

function proceduralParts(def: ComponentDefinition, parts: PartSpec[]): RenderPart[] {
  return parts.map((p, i) => ({
    key: `${def.id}-${i}`,
    geometry: GeometryFactory.get(p.geom),
    edges: GeometryFactory.edges(p.geom),
    material: p.material ?? def.material,
    position: p.position ?? [0, 0, 0],
    rotation: p.rotation ?? [0, 0, 0],
  }));
}

/** Resolve a component's geometry source into renderable parts. */
function useRenderParts(def: ComponentDefinition): RenderPart[] {
  const source = def.geometry;
  const procedural = useMemo(() => (source.type === 'procedural' ? proceduralParts(def, source.parts) : []), [def, source]);
  const [loaded, setLoaded] = useState<RenderPart[]>([]);
  useEffect(() => {
    if (source.type !== 'asset') return;
    let cancelled = false;
    loadAsset(source.format, source.url)
      .then((obj) => {
        if (cancelled) return;
        obj.scale.setScalar(source.scale ?? 1);
        if (source.rotation) obj.rotation.set(...source.rotation);
        if (source.offset) obj.position.set(...source.offset);
        setLoaded(
          collectGeometries(obj).map((geometry, i) => ({
            key: `${def.id}-asset-${i}`,
            geometry,
            edges: new THREE.EdgesGeometry(geometry, 28),
            material: def.material,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
          })),
        );
      })
      .catch((err) => console.error(`[teardown] could not load asset for ${def.id}`, err));
    return () => {
      cancelled = true;
    };
  }, [def, source]);
  return source.type === 'procedural' ? procedural : loaded;
}

function ComponentBody({ def }: { def: ComponentDefinition }) {
  const group = useRef<THREE.Group>(null);
  const lastT = useRef(-1);
  const lastClick = useRef(0);

  const mode = useStore((s) => s.mode);
  const wireframe = useStore((s) => s.wireframe && s.mode === 'engineering');
  const labelsOn = useStore((s) => s.labels && s.mode === 'engineering');
  const selected = useStore((s) => s.selectedId === def.id);
  const hovered = useStore((s) => s.hoveredId === def.id);

  const parts = useRenderParts(def);
  const groupColor = ENGINEERING_COLORS[def.assembly] ?? '#b8bcc2';

  const materials = useMemo(
    () => parts.map((p) => MaterialFactory.create(getMaterial(p.material), mode, groupColor)),
    [parts, mode, groupColor],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useEffect(() => {
    const level = selected ? 2 : hovered ? 1 : 0;
    materials.forEach((m) => MaterialFactory.highlight(m, level));
  }, [materials, selected, hovered]);

  // Pose is a pure function of explosionProgress; written only when it changes.
  useLayoutEffect(() => {
    if (!group.current) return;
    const t = useStore.getState().explosion;
    explosion.apply(group.current, def.id, t);
    lastT.current = t;
  }, [def]);
  useFrame(() => {
    const t = useStore.getState().explosion;
    if (t !== lastT.current && group.current) {
      explosion.apply(group.current, def.id, t);
      lastT.current = t;
    }
  });

  const labelAnchor = useMemo(() => GeometryFactory.componentBox(def).getCenter(new THREE.Vector3()), [def]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 5) return; // it was a drag, not a click
    const now = performance.now();
    const store = useStore.getState();
    const isDouble = now - lastClick.current < DOUBLE_CLICK_MS && store.selectedId === def.id;
    lastClick.current = isDouble ? 0 : now;
    store.select(def.id);
    if (isDouble) focusComponent(def.id);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useStore.getState().hover(def.id);
  };
  const onOut = () => {
    const s = useStore.getState();
    if (s.hoveredId === def.id) s.hover(null);
  };

  const showEdges = mode === 'engineering' || selected;
  const edgeColor = selected ? '#8fd0ff' : '#12161b';
  const showLabel = selected || (labelsOn && def.label);

  return (
    <group ref={group} name={def.id} userData={{ componentId: def.id }} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
      {parts.map((p, i) => {
        const mat = materials[i];
        const opaque = !mat.transparent;
        return (
          <group key={p.key} position={p.position} rotation={p.rotation}>
            <mesh geometry={p.geometry} material={mat} castShadow={opaque} receiveShadow={opaque} />
            {showEdges && p.edges && (
              <lineSegments geometry={p.edges} raycast={noRaycast} userData={{ helper: true }}>
                <lineBasicMaterial color={edgeColor} transparent opacity={selected ? 0.95 : 0.6} />
              </lineSegments>
            )}
            {wireframe && (
              <mesh geometry={p.geometry} raycast={noRaycast} userData={{ helper: true }}>
                <meshBasicMaterial color="#a9c4dc" wireframe transparent opacity={0.16} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
      {showLabel && (
        <Html position={labelAnchor} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`part-label ${selected ? 'part-label--selected' : ''}`}>{def.name}</div>
        </Html>
      )}
    </group>
  );
}

/** One component of the assembly. Hidden components are not mounted at all. */
export function ComponentObject({ def }: { def: ComponentDefinition }) {
  const visible = useStore((s) => isVisible(s, def.id));
  return visible ? <ComponentBody def={def} /> : null;
}
