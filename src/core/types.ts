/**
 * Core data model. Everything in this file is plain data: no three.js objects,
 * no React. Geometry is described declaratively (GeomSpec) and only turned into
 * BufferGeometry by GeometryFactory, so a component's geometry source can later
 * be swapped for a CAD-derived mesh without touching rendering or UI code.
 *
 * Units: millimetres. Axes: +X = viewer's right when looking at the BACK of the
 * phone, +Y = top of the phone, +Z = out of the back (rear) face.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x, y, z, w

/** Rigid placement of a component. Rotation is intrinsic XYZ Euler, radians. */
export interface Transform {
  position: Vec3;
  rotation: Vec3;
}

/**
 * How trustworthy a component's existence / construction is.
 *  - verified:     stated on Apple's public tech-spec page
 *  - reported:     described by a public third-party teardown (iFixit)
 *  - approximated: plausible engineering guess; not confirmed by any source
 * Note: *all* dimensions and positions of internal parts are approximations
 * regardless of this flag; the flag describes the part's existence/construction.
 */
export type Provenance = 'verified' | 'reported' | 'approximated';

export type Hole =
  | { shape: 'circle'; x: number; y: number; r: number }
  | { shape: 'rect'; x: number; y: number; w: number; h: number; r?: number };

/** Declarative geometry primitives. All are centred on their local origin. */
export type GeomSpec =
  /** Rounded rectangle in XY extruded along Z (optionally bevelled / with holes). */
  | { kind: 'plate'; w: number; h: number; r?: number; depth: number; bevel?: number; holes?: Hole[] }
  /** Arbitrary polygon in XY extruded along Z (centred in Z only). */
  | { kind: 'poly'; points: [number, number][]; depth: number; bevel?: number }
  | { kind: 'box'; size: Vec3 }
  /** Cylinder with its axis along Z. */
  | { kind: 'cyl'; r: number; depth: number; segments?: number }
  /** Annulus extruded along Z. */
  | { kind: 'tube'; rOuter: number; rInner: number; depth: number }
  /** Annular sector extruded along Z; angles in radians, CCW from +X. */
  | { kind: 'arc'; rOuter: number; rInner: number; start: number; end: number; depth: number }
  /** Flat Archimedean spiral winding (custom BufferGeometry), in the XY plane. */
  | { kind: 'spiral'; rInner: number; rOuter: number; turns: number; wire: number }
  /** Flat ribbon swept along a smooth path (custom BufferGeometry). */
  | { kind: 'ribbon'; path: Vec3[]; width: number; thickness: number; widthDir?: Vec3 };

export interface PartSpec {
  name?: string;
  geom: GeomSpec;
  /** Material key; falls back to the component's primary material. */
  material?: string;
  position?: Vec3;
  rotation?: Vec3;
}

export type AssetFormat = 'glb' | 'stl' | 'obj';

/**
 * Where a component's geometry comes from. The default demo uses only
 * 'procedural'. 'asset' is the extension point for CAD-derived meshes
 * (STEP must be tessellated to GLB/STL/OBJ first – see README).
 */
export type GeometrySource =
  | { type: 'procedural'; parts: PartSpec[] }
  | { type: 'asset'; format: AssetFormat; url: string; scale?: number; rotation?: Vec3; offset?: Vec3 };

export interface MaterialDefinition {
  key: string;
  /** Human-readable material name shown in the inspector. */
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  opacity?: number;
  clearcoat?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

/** Descriptive metadata shown in the UI (no geometry, no transforms). */
export interface ComponentMetadata {
  id: string;
  name: string;
  /** Id of the parent node in the assembly tree. */
  assembly: string;
  /** Short classification, e.g. "Structural enclosure". */
  classification: string;
  /** Key of the primary material in the material library. */
  material: string;
  /** Free-text material note (alloy, coating, ...). */
  materialNote?: string;
  purpose: string;
  description: string;
  provenance: Provenance;
  provenanceNote: string;
  /** Show a floating label in engineering mode. */
  label?: boolean;
}

export interface ExplosionStage {
  /** Global progress at which this component starts moving, in [0, 1). */
  start: number;
  /** Global progress at which it reaches its exploded pose, in (start, 1]. */
  end: number;
}

export interface ComponentDefinition extends ComponentMetadata {
  assembled: Transform;
  exploded: Transform;
  stage: ExplosionStage;
  /** Default visibility flag. Runtime visibility lives in the store. */
  visible: boolean;
  geometry: GeometrySource;
}

export interface AssemblyNode {
  id: string;
  name: string;
  parent: string | null;
  description?: string;
}
