import type { AssemblyNode } from '../core/types';

/** Assembly hierarchy (sub-assemblies only; components attach via `assembly`). */
export const assemblyNodes: AssemblyNode[] = [
  { id: 'iphone-17-pro', name: 'iPhone 17 Pro (procedural model)', parent: null, description: 'Complete device assembly.' },

  { id: 'exterior', name: 'Exterior Assembly', parent: 'iphone-17-pro', description: 'Everything visible from outside the closed phone.' },
  { id: 'display-assembly', name: 'Display assembly', parent: 'exterior' },
  { id: 'enclosure', name: 'Enclosure', parent: 'exterior' },
  { id: 'rear-camera-exterior', name: 'Rear camera exterior', parent: 'exterior' },
  { id: 'controls-io', name: 'Buttons and external connectors', parent: 'exterior' },
  { id: 'exterior-fasteners', name: 'External fasteners', parent: 'exterior' },

  { id: 'interior', name: 'Interior Assembly', parent: 'iphone-17-pro', description: 'Everything inside the enclosure.' },
  { id: 'power', name: 'Power system', parent: 'interior' },
  { id: 'logic', name: 'Logic board assembly', parent: 'interior' },
  { id: 'thermal', name: 'Thermal system', parent: 'interior' },
  { id: 'camera-system', name: 'Camera modules', parent: 'interior' },
  { id: 'audio-haptics', name: 'Audio and haptics', parent: 'interior' },
  { id: 'io-connectivity', name: 'Charging connector', parent: 'interior' },
  { id: 'interconnects', name: 'Flexible ribbon cables', parent: 'interior' },
  { id: 'structure-fasteners', name: 'Brackets and internal screws', parent: 'interior' },
];
