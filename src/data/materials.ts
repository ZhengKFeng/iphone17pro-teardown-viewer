import type { MaterialDefinition } from '../core/types';

/**
 * Material library (pure data). Colours and PBR parameters are visual
 * approximations chosen for readability; they are not measured values.
 */
const list: MaterialDefinition[] = [
  { key: 'aluOrange', label: 'Anodised aluminium (Cosmic Orange)', color: '#f07a2c', metalness: 0.62, roughness: 0.4 },
  { key: 'aluOrangeDark', label: 'Anodised aluminium (darker orange trim)', color: '#d96a22', metalness: 0.7, roughness: 0.32 },
  { key: 'glassRear', label: 'Ceramic Shield back glass (matte, orange)', color: '#f29355', metalness: 0.05, roughness: 0.55, clearcoat: 0.2 },
  { key: 'glassFront', label: 'Ceramic Shield 2 cover glass', color: '#0c0e12', metalness: 0, roughness: 0.04, opacity: 0.42, clearcoat: 1 },
  { key: 'oled', label: 'OLED panel stack', color: '#07080b', metalness: 0.2, roughness: 0.18, clearcoat: 0.6 },
  { key: 'oledActive', label: 'OLED active area', color: '#101a2c', metalness: 0, roughness: 0.25, emissive: '#16305c', emissiveIntensity: 0.55 },
  { key: 'cavity', label: 'Opening / recess', color: '#050505', metalness: 0.1, roughness: 0.9 },
  { key: 'steel', label: 'Stainless steel', color: '#b9bec4', metalness: 1, roughness: 0.34 },
  { key: 'steelDark', label: 'Dark-finished steel', color: '#4a4e55', metalness: 0.95, roughness: 0.42 },
  { key: 'batteryCan', label: 'Steel battery enclosure', color: '#9ea4ab', metalness: 0.95, roughness: 0.4 },
  { key: 'batteryLabel', label: 'Printed battery label', color: '#17191c', metalness: 0.1, roughness: 0.6 },
  { key: 'copper', label: 'Copper', color: '#c9824f', metalness: 1, roughness: 0.32 },
  { key: 'copperWire', label: 'Copper litz winding', color: '#d08a4e', metalness: 0.9, roughness: 0.45 },
  { key: 'graphite', label: 'Graphite heat-spreader film', color: '#2b2d31', metalness: 0.35, roughness: 0.62 },
  { key: 'tim', label: 'Thermal interface pad', color: '#8fb6cc', metalness: 0, roughness: 0.85 },
  { key: 'pcb', label: 'Multilayer PCB (black solder mask)', color: '#14251c', metalness: 0.15, roughness: 0.6 },
  { key: 'chip', label: 'Moulded IC package', color: '#1d1e21', metalness: 0.2, roughness: 0.5 },
  { key: 'chipMark', label: 'Package lid', color: '#3a3c41', metalness: 0.7, roughness: 0.35 },
  { key: 'shield', label: 'Nickel-silver EMI shield', color: '#c4c2b8', metalness: 1, roughness: 0.38 },
  { key: 'plastic', label: 'Glass-filled polymer', color: '#1a1b1e', metalness: 0.05, roughness: 0.7 },
  { key: 'lensGlass', label: 'Optical glass / lens stack', color: '#0a1020', metalness: 0.3, roughness: 0.05, clearcoat: 1 },
  { key: 'sapphire', label: 'Sapphire crystal cover', color: '#141820', metalness: 0.1, roughness: 0.03, opacity: 0.6, clearcoat: 1 },
  { key: 'flash', label: 'Diffuser lens (LED flash)', color: '#f4ecd2', metalness: 0, roughness: 0.4, emissive: '#fff3c4', emissiveIntensity: 0.25 },
  { key: 'gold', label: 'Gold-plated contacts', color: '#d6b25a', metalness: 1, roughness: 0.3 },
  { key: 'magnet', label: 'Sintered NdFeB magnet', color: '#6b6f77', metalness: 0.9, roughness: 0.5 },
  { key: 'ferrite', label: 'Ferrite / nanocrystalline shield', color: '#232427', metalness: 0.2, roughness: 0.8 },
  { key: 'flex', label: 'Polyimide flexible printed circuit', color: '#7a5320', metalness: 0.25, roughness: 0.55 },
  { key: 'mesh', label: 'Acoustic mesh', color: '#2c2e33', metalness: 0.7, roughness: 0.6 },
];

export const MATERIALS: Record<string, MaterialDefinition> = Object.fromEntries(list.map((m) => [m.key, m]));

export function getMaterial(key: string): MaterialDefinition {
  const m = MATERIALS[key];
  if (!m) throw new Error(`Unknown material key: ${key}`);
  return m;
}

/** Neutral per-subassembly colours used by Engineering mode. */
export const ENGINEERING_COLORS: Record<string, string> = {
  'display-assembly': '#8ea6c4',
  enclosure: '#c9b79c',
  'rear-camera-exterior': '#b9a7c9',
  'controls-io': '#a9c2a0',
  'exterior-fasteners': '#d0d0d0',
  power: '#c4a48e',
  logic: '#8fbfa4',
  thermal: '#d4b483',
  'camera-system': '#a79bc9',
  'audio-haptics': '#9cc0c9',
  'io-connectivity': '#c9a0ad',
  interconnects: '#d1c38a',
  'structure-fasteners': '#b7bcc4',
};
