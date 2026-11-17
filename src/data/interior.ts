import type { ComponentDefinition, PartSpec, Vec3 } from '../core/types';
import { LAYER, LENS, REAR_GLASS, define, screw } from './dimensions';

const RX90: Vec3 = [Math.PI / 2, 0, 0];

const APPLE_SPECS = 'Apple iPhone 17 Pro tech specs (support.apple.com/125090)';
const IFIXIT = 'iFixit iPhone 17 Pro teardown (ifixit.com/News/113388)';
const APPROX = 'Shape, size and position are approximations.';

/* ------------------------------------------------------------------ */
/* Power                                                               */
/* ------------------------------------------------------------------ */

const battery = define({
  id: 'battery',
  name: 'Battery pack',
  assembly: 'power',
  classification: 'Energy storage',
  material: 'batteryCan',
  materialNote: 'Lithium-ion cell in a protective metal shell.',
  purpose: 'Stores energy for the whole device.',
  description:
    'Single lithium-ion cell in a metal shell, bonded to a removable tray with electrically debonding adhesive (releases when a voltage is applied) instead of pull tabs.',
  provenance: 'reported',
  provenanceNote: `Metal shell, tray mounting and debonding adhesive reported by ${IFIXIT}. Outline (60 × 82 × 4.6 mm) is an approximation sized to a plausible ~15 Wh cell; capacity is not modelled.`,
  label: true,
  at: [0, -15, -0.15],
  explode: [0, 0, LAYER.battery],
  parts: [
    { name: 'Cell enclosure', geom: { kind: 'plate', w: 60, h: 82, r: 2.5, depth: 4.6, bevel: 0.5 } },
    { name: 'Label', geom: { kind: 'plate', w: 46, h: 62, r: 1.5, depth: 0.04 }, material: 'batteryLabel', position: [0, -4, -2.31] },
    { name: 'Terminal block', geom: { kind: 'box', size: [9, 1.6, 1.2] }, material: 'plastic', position: [16, 41.8, -0.4] },
  ],
});

// Screw positions in tray-local coordinates (tray centre = battery centre).
const trayScrewXY: [number, number][] = [];
// Side positions skip the SIM-tray zone on the +X wall.
for (const y of [-36, -19, -3, 17, 36]) trayScrewXY.push([-32, y], [32, y]);
trayScrewXY.push([-20, 43], [-6, 43], [-10, -43.2], [10, -43.2]);

const trayParts: PartSpec[] = [{ name: 'Tray plate', geom: { kind: 'plate', w: 62, h: 84, r: 2, depth: 0.38 } }];
for (const [x, y] of trayScrewXY) {
  const side = Math.abs(x) === 32;
  trayParts.push({
    name: 'Mounting ear',
    geom: { kind: 'plate', w: side ? 3.2 : 3.6, h: side ? 3.6 : 3.2, r: 0.8, depth: 0.38 },
    position: side ? [x - Math.sign(x) * 0.4, y, 0] : [x, y - Math.sign(y) * 0.5, 0],
  });
}

const batteryTray = define({
  id: 'battery-tray',
  name: 'Battery tray',
  assembly: 'power',
  classification: 'Mechanical carrier',
  material: 'steel',
  materialNote: 'Thin metal tray (material assumed).',
  purpose: 'Carries the battery so it can be unscrewed and lifted out as a unit.',
  description:
    'Screw-mounted tray under the battery – the first screwed-in battery carrier in an iPhone. It sits between the battery and the vapor chamber.',
  provenance: 'reported',
  provenanceNote: `Tray held by fourteen Torx Plus screws reported by ${IFIXIT}. ${APPROX}`,
  at: [0, -15, 2.39],
  explode: [0, 0, LAYER.tray],
  parts: trayParts,
});

const trayScrews = define({
  id: 'battery-tray-screws',
  name: 'Battery tray screws (×14)',
  assembly: 'structure-fasteners',
  classification: 'Internal fastener',
  material: 'steelDark',
  materialNote: 'Torx Plus (4IP) machine screws.',
  purpose: 'Fasten the battery tray to the aluminium unibody.',
  description: 'Fourteen small Torx Plus screws around the perimeter of the battery tray.',
  provenance: 'reported',
  provenanceNote: `Count (14) and drive type reported by ${IFIXIT}. Screw positions are approximations.`,
  at: [0, -15, 1.7],
  explode: [0, 0, LAYER.trayScrews],
  parts: trayScrewXY.flatMap(([x, y]) => screw(x, y, 0, '-z', 0.85, 1.0)),
});

const coilCentre: [number, number] = [0, REAR_GLASS.cy];

const chargingCoil = define({
  id: 'wireless-coil',
  name: 'Wireless charging coil',
  assembly: 'power',
  classification: 'Inductive power receiver',
  material: 'copperWire',
  materialNote: 'Flat copper winding on a magnetic shielding sheet.',
  purpose: 'Receives power inductively (MagSafe / Qi2, up to 25 W per Apple).',
  description: 'Flat spiral coil bonded behind the rear glass, backed by a thin magnetic shield that keeps the field out of the battery.',
  provenance: 'verified',
  provenanceNote: `MagSafe / Qi2 wireless charging from ${APPLE_SPECS}; coil reached through the back glass per ${IFIXIT}. Turn count and diameters are approximations.`,
  label: true,
  at: [coilCentre[0], coilCentre[1], 3.3],
  explode: [0, 0, LAYER.coil],
  parts: [
    { name: 'Winding', geom: { kind: 'spiral', rInner: 11.5, rOuter: 21.5, turns: 12, wire: 0.34 }, position: [0, 0, 0.07] },
    { name: 'Shielding sheet', geom: { kind: 'tube', rOuter: 22.3, rInner: 10.5, depth: 0.1 }, material: 'ferrite', position: [0, 0, -0.2] },
    { name: 'Coil leads', geom: { kind: 'box', size: [3, 6, 0.12] }, material: 'flex', position: [0, -25.2, -0.19] },
  ],
});

const magnetParts: PartSpec[] = [];
const SEGMENTS = 16;
for (let i = 0; i < SEGMENTS; i++) {
  const gap = 0.05;
  const a0 = -Math.PI / 2 + 0.22 + (i * (Math.PI * 2 - 0.44)) / SEGMENTS;
  const a1 = a0 + (Math.PI * 2 - 0.44) / SEGMENTS - gap;
  magnetParts.push({ name: `Magnet segment ${i + 1}`, geom: { kind: 'arc', rInner: 23.6, rOuter: 27, start: a0, end: a1, depth: 0.45 } });
}
magnetParts.push({ name: 'Alignment magnet', geom: { kind: 'plate', w: 2.4, h: 7, r: 0.5, depth: 0.45 }, position: [0, -33.5, 0] });

const magnets = define({
  id: 'magsafe-magnets',
  name: 'MagSafe magnet array',
  assembly: 'power',
  classification: 'Magnetic alignment',
  material: 'magnet',
  purpose: 'Aligns and holds MagSafe chargers and accessories over the coil.',
  description: 'Ring of magnet segments around the charging coil with a separate alignment magnet below it.',
  provenance: 'verified',
  provenanceNote: `"Magnet array and alignment magnet" listed in ${APPLE_SPECS}. Segment count and radii are approximations.`,
  at: [coilCentre[0], coilCentre[1], 3.3],
  explode: [0, 0, LAYER.magnets],
  parts: magnetParts,
});

/* ------------------------------------------------------------------ */
/* Logic                                                               */
/* ------------------------------------------------------------------ */

const BOARD_Z = 0.6; // centre of the 0.8 mm board
const CHIP_Z0 = 1.0; // rear face of the board (chips face the vapor chamber)

const logicBoard = define({
  id: 'logic-board',
  name: 'Logic board (PCB assembly)',
  assembly: 'logic',
  classification: 'Printed circuit board',
  material: 'pcb',
  materialNote: 'High-density multilayer PCB.',
  purpose: 'Carries the processor, memory, storage, power management and radios.',
  description:
    'Compact board at the top of the phone, beside and below the rear cameras and edging into the camera plateau. Board-to-board sockets on the display side take the flex cables.',
  provenance: 'reported',
  provenanceNote: `Location above the battery, edging into the plateau, reported by ${IFIXIT}. Outline, thickness and chip orientation (towards the vapor chamber) are approximations.`,
  label: true,
  at: [0, 0, BOARD_Z],
  explode: [0, 0, LAYER.board],
  parts: [
    {
      name: 'PCB',
      geom: {
        kind: 'poly',
        points: [
          [-33, 29],
          [33, 29],
          [33, 62],
          [27, 71],
          [0, 71],
          [0, 37],
          [-33, 37],
        ],
        depth: 0.8,
      },
    },
    { name: 'Battery socket', geom: { kind: 'box', size: [5, 2.2, 0.3] }, material: 'gold', position: [16, 34, -0.55] },
    { name: 'Display socket', geom: { kind: 'box', size: [6, 2.2, 0.3] }, material: 'gold', position: [26, 34, -0.55] },
    { name: 'Charge-flex socket', geom: { kind: 'box', size: [4.5, 2.2, 0.3] }, material: 'gold', position: [-26, 32.5, -0.55] },
    { name: 'Camera socket', geom: { kind: 'box', size: [2.2, 5, 0.3] }, material: 'gold', position: [3.5, 53.5, -0.55] },
  ],
});

function chip(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  purpose: string,
  description: string,
  provenance: 'verified' | 'approximated',
  note: string,
  label = false,
): ComponentDefinition {
  return define({
    id,
    name,
    assembly: 'logic',
    classification: 'Electronic package',
    material: 'chip',
    purpose,
    description,
    provenance,
    provenanceNote: note,
    label,
    at: [x, y, CHIP_Z0 + t / 2],
    explode: [0, 0, LAYER.chips],
    parts: [
      { name: 'Package body', geom: { kind: 'box', size: [w, h, t] } },
      { name: 'Package marking', geom: { kind: 'box', size: [w * 0.7, h * 0.7, 0.03] }, material: 'chipMark', position: [0, 0, t / 2 + 0.01] },
    ],
  });
}

const soc = chip(
  'soc-a19-pro',
  'A19 Pro system-on-chip',
  12,
  60,
  12,
  12,
  0.9,
  'Main application processor (CPU, GPU, Neural Engine) with stacked memory.',
  'The primary heat source of the phone. Its heat is conducted through a thermal interface into the vapor chamber.',
  'verified',
  `A19 Pro chip listed in ${APPLE_SPECS}. Package size and position on the board are approximations.`,
  true,
);
const nand = chip(
  'nand-storage',
  'NAND flash storage',
  25.5,
  60,
  9,
  12,
  0.8,
  'Non-volatile storage for the system and user data.',
  'Flash storage package placed next to the processor.',
  'approximated',
  `Storage capacities are listed by Apple; the package, its size and position are approximations.`,
);
const pmic = chip(
  'power-management-ic',
  'Power management IC',
  11,
  45,
  7,
  7,
  0.7,
  'Generates and sequences the supply rails; manages charging.',
  'Power-management package with its surrounding passives (passives not modelled).',
  'approximated',
  `Generic placement; ${APPROX}`,
);
const modem = chip(
  'cellular-modem',
  'Cellular modem and transceiver',
  23,
  45,
  10,
  9,
  0.8,
  'Baseband processing and RF transceiver for cellular connectivity.',
  'Modem / transceiver package beside the power-management section.',
  'approximated',
  `Generic placement; ${APPROX}`,
);

const rfFrontEnd = define({
  id: 'rf-front-end',
  name: 'RF front-end and wireless modules',
  assembly: 'logic',
  classification: 'Electronic packages',
  material: 'chip',
  purpose: 'Power amplifiers, filters and the Wi-Fi / Bluetooth / UWB radios.',
  description: 'A row of smaller radio packages along the lower strip of the logic board.',
  provenance: 'approximated',
  provenanceNote: `Generic placement; count, ${APPROX.toLowerCase()}`,
  at: [0, 33, CHIP_Z0 + 0.3],
  explode: [0, 0, LAYER.chips],
  parts: [
    { name: 'Wi-Fi / Bluetooth module', geom: { kind: 'box', size: [8, 5, 0.6] }, position: [-18, 0, 0] },
    { name: 'RF power amplifier', geom: { kind: 'box', size: [6, 5, 0.6] }, position: [-8, 0, 0] },
    { name: 'UWB module', geom: { kind: 'box', size: [4, 4, 0.6] }, position: [-29, 0, 0] },
    { name: 'RF filter bank', geom: { kind: 'box', size: [5, 4.5, 0.6] }, position: [-1, 0, 0] },
  ],
});

function shieldCan(id: string, name: string, cx: number, cy: number, w: number, h: number, covers: string): ComponentDefinition {
  return define({
    id,
    name,
    assembly: 'logic',
    classification: 'EMI shielding cover',
    material: 'shield',
    purpose: `Electromagnetic shielding over ${covers}; also a thermal bridge to the vapor chamber.`,
    description: 'Thin drawn metal can soldered to the board over the packages it protects.',
    provenance: 'approximated',
    provenanceNote: `Shield cans are standard practice; this one's outline is an approximation.`,
    at: [cx, cy, CHIP_Z0],
    explode: [0, 0, LAYER.shields],
    parts: [
      { name: 'Can walls', geom: { kind: 'plate', w, h, r: 0.8, depth: 1.1, holes: [{ shape: 'rect', x: 0, y: 0, w: w - 0.5, h: h - 0.5, r: 0.6 }] }, position: [0, 0, 0.55] },
      { name: 'Can lid', geom: { kind: 'plate', w, h, r: 0.8, depth: 0.15 }, position: [0, 0, 1.175] },
    ],
  });
}

const shieldAp = shieldCan('shield-processor', 'Processor shield', 18, 60, 26, 14, 'the processor and storage');
const shieldRf = shieldCan('shield-power-rf', 'Power / RF shield', 17.75, 45, 23.5, 11, 'the power-management and modem packages');

/* ------------------------------------------------------------------ */
/* Thermal                                                             */
/* ------------------------------------------------------------------ */

const thermalPads = define({
  id: 'thermal-interface',
  name: 'Thermal interface pads',
  assembly: 'thermal',
  classification: 'Thermal interface component',
  material: 'tim',
  materialNote: 'Compliant thermally conductive gap filler (assumed).',
  purpose: 'Fill the air gap between the shield cans and the vapor chamber so heat can cross it.',
  description: 'Soft pads compressed between the hot packages and the vapor chamber.',
  provenance: 'approximated',
  provenanceNote: `A thermal interface between chips and vapor chamber is physically required but not described publicly. ${APPROX}`,
  at: [0, 0, 2.425],
  explode: [0, 0, LAYER.tim],
  parts: [
    { name: 'Processor pad', geom: { kind: 'plate', w: 13, h: 13, r: 0.8, depth: 0.35 }, position: [12, 60, 0] },
    { name: 'Power / RF pad', geom: { kind: 'plate', w: 10, h: 8, r: 0.8, depth: 0.35 }, position: [20, 45, 0] },
  ],
});

const vaporChamber = define({
  id: 'vapor-chamber',
  name: 'Vapor chamber',
  assembly: 'thermal',
  classification: 'Heat-spreading structure',
  material: 'copper',
  materialNote: 'Sealed copper envelope with an internal wick lattice and a small water charge.',
  purpose: 'Spreads processor heat over a large area and into the aluminium unibody.',
  description:
    'Two-phase heat spreader: water evaporates at the hot processor end, condenses over the cooler battery-side area and wicks back. It lies under the battery tray, between the chips and the battery.',
  provenance: 'reported',
  provenanceNote: `Copper vapor chamber under the battery tray, modular rather than glued, reported by ${IFIXIT}; copper enclosure also mentioned in ${APPLE_SPECS}. Outline and thickness are approximations.`,
  label: true,
  at: [0, 0, 2.81],
  explode: [0, 0, LAYER.vaporChamber],
  parts: [
    {
      name: 'Chamber envelope',
      geom: {
        kind: 'poly',
        points: [
          [-28, -54],
          [28, -54],
          [28, 26],
          [32, 26],
          [32, 62],
          [26, 70],
          [2, 70],
          [2, 26],
          [-28, 26],
        ],
        depth: 0.38,
      },
    },
    ...[-40, -20, 0, 14].flatMap((y): PartSpec[] =>
      [-18, 0, 18].map((x) => ({
        name: 'Condenser dimple',
        geom: { kind: 'cyl', r: 2.2, depth: 0.05, segments: 24 },
        material: 'copperWire',
        position: [x, y, -0.2],
      })),
    ),
  ],
});

const graphite = define({
  id: 'graphite-sheet',
  name: 'Graphite heat-spreader sheet',
  assembly: 'thermal',
  classification: 'Heat-spreading structure',
  material: 'graphite',
  purpose: 'Evens out hot spots behind the display.',
  description: 'Thin, highly in-plane-conductive graphite film on the back of the display support plate.',
  provenance: 'approximated',
  provenanceNote: `Graphite films are common behind phone displays; not confirmed for this model. ${APPROX}`,
  at: [0, -14, -2.725],
  explode: [0, 0, LAYER.graphite],
  parts: [{ name: 'Graphite film', geom: { kind: 'plate', w: 60, h: 100, r: 3, depth: 0.1 } }],
});

/* ------------------------------------------------------------------ */
/* Camera system                                                       */
/* ------------------------------------------------------------------ */

function cameraModule(
  id: string,
  name: string,
  pos: [number, number],
  body: [number, number],
  barrelR: number,
  spec: string,
  extra: string,
): ComponentDefinition {
  return define({
    id,
    name,
    assembly: 'camera-system',
    classification: 'Camera module',
    material: 'steelDark',
    materialNote: 'Metal-shielded module with a glass/plastic lens stack.',
    purpose: `Rear camera: ${spec}.`,
    description: `${extra} The lens barrel passes through the rear shell into the camera plateau.`,
    provenance: 'verified',
    provenanceNote: `Camera listed in ${APPLE_SPECS}; ${IFIXIT} describes the three rear modules as easily swappable. Module size and which position each camera occupies are approximations.`,
    label: true,
    at: [pos[0], pos[1], 1.6],
    explode: [0, 0, LAYER.cameras],
    parts: [
      { name: 'Module housing', geom: { kind: 'plate', w: body[0], h: body[1], r: 1.2, depth: 3.8, bevel: 0.25 } },
      { name: 'Lens barrel', geom: { kind: 'cyl', r: barrelR, depth: 2.9, segments: 40 }, material: 'plastic', position: [0, 0, 3.35] },
      { name: 'Front element', geom: { kind: 'cyl', r: barrelR * 0.62, depth: 0.1, segments: 40 }, material: 'lensGlass', position: [0, 0, 4.82] },
    ],
  });
}

const camTele = cameraModule(
  'camera-telephoto',
  'Telephoto camera module',
  LENS.telephoto,
  [14, 14],
  5.6,
  '48MP Fusion Telephoto, 100 mm (4×), ƒ/2.8',
  'Folded-optics telephoto camera.',
);
const camMain = cameraModule('camera-main', 'Main camera module', LENS.main, [13, 13], 5.8, '48MP Fusion Main, 24 mm, ƒ/1.78', 'Primary wide camera with sensor-shift stabilisation.');
const camUltra = cameraModule(
  'camera-ultrawide',
  'Ultra Wide camera module',
  LENS.ultrawide,
  [12, 12],
  5.2,
  '48MP Fusion Ultra Wide, 13 mm, ƒ/2.2, 120° field of view',
  'Ultra-wide camera, also used for macro.',
);

const trueDepth = define({
  id: 'front-camera-module',
  name: 'Front camera and Face ID module',
  assembly: 'camera-system',
  classification: 'Camera / sensor module',
  material: 'steelDark',
  purpose: '18MP Center Stage front camera plus the infrared projector and camera used for Face ID.',
  description: 'Sensor bar behind the Dynamic Island cut-out of the display.',
  provenance: 'verified',
  provenanceNote: `18MP Center Stage front camera and Face ID listed in ${APPLE_SPECS}. ${APPROX}`,
  at: [0, 61, -1.75],
  explode: [0, 0, LAYER.frontModules],
  parts: [
    { name: 'Sensor bracket', geom: { kind: 'plate', w: 26, h: 8, r: 1.5, depth: 1.7 } },
    { name: 'Front camera', geom: { kind: 'cyl', r: 2.6, depth: 0.5, segments: 32 }, material: 'lensGlass', position: [6.5, 0, -0.6] },
    { name: 'IR camera', geom: { kind: 'cyl', r: 1.8, depth: 0.5, segments: 32 }, material: 'lensGlass', position: [-1, 0, -0.6] },
    { name: 'Dot projector', geom: { kind: 'box', size: [3.4, 3.4, 0.5] }, material: 'plastic', position: [-7.5, 0, -0.6] },
  ],
});

/* ------------------------------------------------------------------ */
/* Audio and haptics                                                   */
/* ------------------------------------------------------------------ */

const speaker = define({
  id: 'speaker-module',
  name: 'Bottom speaker module',
  assembly: 'audio-haptics',
  classification: 'Loudspeaker',
  material: 'plastic',
  materialNote: 'Polymer acoustic enclosure with a metal-capped driver.',
  purpose: 'Main loudspeaker; fires through the bottom-edge ports.',
  description: 'Sealed speaker box at the bottom of the phone, next to the USB-C assembly.',
  provenance: 'approximated',
  provenanceNote: `A bottom speaker is evident from the product; its enclosure is not described in the teardown text. ${APPROX}`,
  label: true,
  at: [20.5, -66, 0.3],
  explode: [0, 0, LAYER.battery],
  parts: [
    { name: 'Acoustic enclosure', geom: { kind: 'plate', w: 21, h: 11, r: 3, depth: 4.4 } },
    { name: 'Driver cap', geom: { kind: 'plate', w: 12, h: 7, r: 1.5, depth: 0.2 }, material: 'steel', position: [0, 0.5, -2.3] },
    { name: 'Port mesh', geom: { kind: 'box', size: [14, 0.3, 1.6] }, material: 'mesh', position: [0, -5.6, 0] },
  ],
});

const taptic = define({
  id: 'haptic-motor',
  name: 'Taptic Engine (haptic motor)',
  assembly: 'audio-haptics',
  classification: 'Linear resonant actuator',
  material: 'steelDark',
  purpose: 'Produces haptic feedback and vibration alerts.',
  description: 'Linear actuator: a sprung magnetic mass driven back and forth by coils inside a steel housing.',
  provenance: 'approximated',
  provenanceNote: `Haptic feedback is a product feature; the actuator's location and size are approximations.`,
  label: true,
  at: [-20, -65.5, 0.5],
  explode: [0, 0, LAYER.battery],
  parts: [
    { name: 'Actuator housing', geom: { kind: 'plate', w: 21, h: 10, r: 2.5, depth: 4.0 } },
    { name: 'Housing label', geom: { kind: 'plate', w: 14, h: 5, r: 0.8, depth: 0.04 }, material: 'batteryLabel', position: [0, 0, -2.01] },
  ],
});

const earpiece = define({
  id: 'earpiece-speaker',
  name: 'Earpiece speaker',
  assembly: 'audio-haptics',
  classification: 'Loudspeaker',
  material: 'plastic',
  purpose: 'Receiver for calls; second channel for stereo playback.',
  description: 'Small speaker at the top edge that fires through the slot in the cover glass.',
  provenance: 'approximated',
  provenanceNote: `Stereo speakers are a product feature; ${APPROX.toLowerCase()}`,
  at: [0, 69.75, -1.7],
  explode: [0, 0, LAYER.frontModules],
  parts: [
    { name: 'Speaker body', geom: { kind: 'plate', w: 18, h: 6.5, r: 1.5, depth: 1.8 } },
    { name: 'Diaphragm cap', geom: { kind: 'plate', w: 11, h: 3.6, r: 1, depth: 0.15 }, material: 'steel', position: [0, 0.3, -0.97] },
  ],
});

/* ------------------------------------------------------------------ */
/* I/O                                                                 */
/* ------------------------------------------------------------------ */

const usbAssembly = define({
  id: 'usb-c-assembly',
  name: 'USB-C charging connector assembly',
  assembly: 'io-connectivity',
  classification: 'Connector assembly',
  material: 'steel',
  materialNote: 'Stainless receptacle shell on a small flex/board carrier.',
  purpose: 'Wired charging and data; also carries the bottom microphones on the real device.',
  description: 'USB-C receptacle with its carrier. Replaceable, but buried under many screws according to the teardown.',
  provenance: 'reported',
  provenanceNote: `USB-C connector listed in ${APPLE_SPECS}; ${IFIXIT} notes that replacing it requires removing dozens of screws. ${APPROX}`,
  label: true,
  at: [0, -67, 0],
  explode: [0, 0, LAYER.battery],
  parts: [
    { name: 'Receptacle shell', geom: { kind: 'plate', w: 9, h: 3.2, r: 1.6, depth: 9.5 }, rotation: RX90, position: [0, -1.2, 0] },
    { name: 'Carrier board', geom: { kind: 'plate', w: 13, h: 11.5, r: 1, depth: 0.4 }, material: 'pcb', position: [0, 0.2, 1.7] },
    { name: 'Mounting ear', geom: { kind: 'box', size: [2.4, 2.4, 0.5] }, position: [-5.6, -3, -1.65] },
    { name: 'Mounting ear', geom: { kind: 'box', size: [2.4, 2.4, 0.5] }, position: [5.6, -3, -1.65] },
  ],
});

/* ------------------------------------------------------------------ */
/* Interconnects (flexible printed circuits)                           */
/* ------------------------------------------------------------------ */

const FLEX_NOTE = `Flex cables necessarily connect these parts, but their routing is an approximation.`;

const chargeFlex = define({
  id: 'flex-charging',
  name: 'Charging / audio flex cable',
  assembly: 'interconnects',
  classification: 'Flexible ribbon cable',
  material: 'flex',
  purpose: 'Links the USB-C assembly, speaker and haptic motor at the bottom to the logic board at the top.',
  description: 'Long polyimide flex routed over the display side of the battery.',
  provenance: 'approximated',
  provenanceNote: FLEX_NOTE,
  label: true,
  explode: [0, 0, LAYER.chargeFlex],
  parts: [
    {
      name: 'Flex ribbon',
      geom: {
        kind: 'ribbon',
        width: 5,
        thickness: 0.1,
        widthDir: [1, 0, 0],
        path: [
          [-26, -60.5, -2.56],
          [-26, -40, -2.56],
          [-26, 0, -2.56],
          [-26, 26.6, -2.56],
          [-26, 28.2, -1.4],
          [-26, 29.8, -0.24],
          [-26, 33.2, -0.24],
        ],
      },
    },
    {
      name: 'Bottom branch',
      geom: {
        kind: 'ribbon',
        width: 4,
        thickness: 0.1,
        widthDir: [0, 1, 0],
        path: [
          [-23.6, -60.6, -2.56],
          [-12, -60.6, -2.56],
          [0, -60.6, -2.56],
          [4, -60.6, -2.56],
        ],
      },
    },
  ],
});

const batteryFlex = define({
  id: 'flex-battery',
  name: 'Battery flex cable',
  assembly: 'interconnects',
  classification: 'Flexible ribbon cable',
  material: 'flex',
  purpose: 'Connects the battery terminals to the logic board.',
  description: 'Short, wide flex with a board-to-board plug.',
  provenance: 'approximated',
  provenanceNote: FLEX_NOTE,
  explode: [0, 0, LAYER.flex],
  parts: [
    {
      name: 'Flex ribbon',
      geom: {
        kind: 'ribbon',
        width: 5,
        thickness: 0.1,
        widthDir: [1, 0, 0],
        path: [
          [16, 26.3, -0.9],
          [16, 27.6, -0.5],
          [16, 29.4, -0.24],
          [16, 35, -0.24],
        ],
      },
    },
  ],
});

const displayFlex = define({
  id: 'flex-display',
  name: 'Display flex cable',
  assembly: 'interconnects',
  classification: 'Flexible ribbon cable',
  material: 'flex',
  purpose: 'Carries display data, touch and power between the display module and the logic board.',
  description: 'Folded flex from the display driver tab down to its socket on the logic board.',
  provenance: 'approximated',
  provenanceNote: FLEX_NOTE,
  explode: [0, 0, LAYER.flex],
  parts: [
    {
      name: 'Flex ribbon',
      geom: {
        kind: 'ribbon',
        width: 6,
        thickness: 0.1,
        widthDir: [1, 0, 0],
        path: [
          [26, 45.5, -2.56],
          [26, 41.5, -2.56],
          [26, 40, -1.4],
          [26, 39.1, -0.3],
          [26, 37, -0.24],
          [26, 33, -0.24],
        ],
      },
    },
  ],
});

const cameraFlex = define({
  id: 'flex-camera',
  name: 'Rear camera flex cables',
  assembly: 'interconnects',
  classification: 'Flexible ribbon cable',
  material: 'flex',
  purpose: 'Carry image-sensor data from the rear camera modules to the logic board.',
  description: 'Short flexes from the camera modules to a shared socket on the board.',
  provenance: 'approximated',
  provenanceNote: FLEX_NOTE,
  explode: [0, 0, LAYER.flex],
  parts: [
    {
      name: 'Ultra Wide camera flex',
      geom: {
        kind: 'ribbon',
        width: 4,
        thickness: 0.07,
        widthDir: [0, 1, 0],
        path: [
          [-6, 53.5, -0.35],
          [-2, 53.5, -0.35],
          [1, 53.5, -0.3],
          [4.4, 53.5, -0.24],
        ],
      },
    },
    {
      name: 'Main / Telephoto camera flex',
      geom: {
        kind: 'ribbon',
        width: 3,
        thickness: 0.07,
        widthDir: [1, 0, 0],
        path: [
          [-16.6, 60, -0.35],
          [-16.6, 53, -0.35],
          [-16.6, 46, -0.35],
        ],
      },
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Brackets and internal screws                                        */
/* ------------------------------------------------------------------ */

const cameraBracketScrews: [number, number][] = [
  [-29, 39.2],
  [-29, 69],
  [-2.6, 39.2],
  [-16, 69],
];
const cowlingScrews: [number, number][] = [
  [11.5, 34],
  [30.5, 34],
];
const usbScrews: [number, number][] = [
  [-5.6, -70],
  [5.6, -70],
];

const cameraBracket = define({
  id: 'camera-bracket',
  name: 'Rear camera bracket',
  assembly: 'structure-fasteners',
  classification: 'Mechanical bracket',
  material: 'steel',
  purpose: 'Clamps the three rear camera modules in place and grounds their shields.',
  description: 'Stamped steel bracket spanning the camera cluster on the display side.',
  provenance: 'reported',
  provenanceNote: `Torx Plus screws around the rear cameras reported by ${IFIXIT}; the bracket outline is an approximation.`,
  at: [-16, 53.85, -0.575],
  explode: [0, 0, LAYER.covers],
  parts: [
    {
      name: 'Bracket plate',
      geom: {
        kind: 'plate',
        w: 29,
        h: 32.3,
        r: 2,
        depth: 0.35,
        holes: [
          { shape: 'rect', x: -6.5, y: 8.15, w: 7, h: 7, r: 1 },
          { shape: 'rect', x: -6.5, y: -8.85, w: 7, h: 7, r: 1 },
          { shape: 'rect', x: 7.5, y: -0.35, w: 6, h: 6, r: 1 },
        ],
      },
    },
  ],
});

const cowling = define({
  id: 'connector-cowling',
  name: 'Connector cowling',
  assembly: 'structure-fasteners',
  classification: 'Mechanical bracket',
  material: 'steel',
  purpose: 'Holds the battery and display flex plugs seated in their sockets.',
  description: 'Small stamped cover screwed over the board-to-board connectors.',
  provenance: 'approximated',
  provenanceNote: `Connector covers are standard iPhone practice; this one's outline and position are approximations.`,
  at: [21, 34, -0.5],
  explode: [0, 0, LAYER.covers],
  parts: [{ name: 'Cowling plate', geom: { kind: 'plate', w: 22, h: 9, r: 1.2, depth: 0.3 } }],
});

const coverScrews = define({
  id: 'bracket-screws',
  name: 'Bracket and cowling screws (×8)',
  assembly: 'structure-fasteners',
  classification: 'Internal fastener',
  material: 'steelDark',
  materialNote: 'Tri-point, Phillips and Torx Plus machine screws on the real device.',
  purpose: 'Fasten the camera bracket, the connector cowling and the USB-C assembly.',
  description: 'Representative internal mounting screws. The real phone uses many more, in five drive types.',
  provenance: 'reported',
  provenanceNote: `Five drive types (tri-point, Phillips, standoff, pentalobe, Torx Plus) reported by ${IFIXIT}. Screw count and positions here are representative approximations.`,
  explode: [0, 0, LAYER.coverScrews],
  parts: [
    ...cameraBracketScrews.flatMap(([x, y]) => screw(x, y, -1.25, '-z', 0.8, 1.2)),
    ...cowlingScrews.flatMap(([x, y]) => screw(x, y, -1.15, '-z', 0.8, 1.2)),
    ...usbScrews.flatMap(([x, y]) => screw(x, y, -2.4, '-z', 0.8, 1.4)),
  ],
});

export const interiorComponents: ComponentDefinition[] = [
  battery,
  batteryTray,
  chargingCoil,
  magnets,
  logicBoard,
  soc,
  nand,
  pmic,
  modem,
  rfFrontEnd,
  shieldAp,
  shieldRf,
  thermalPads,
  vaporChamber,
  graphite,
  camTele,
  camMain,
  camUltra,
  trueDepth,
  speaker,
  taptic,
  earpiece,
  usbAssembly,
  chargeFlex,
  batteryFlex,
  displayFlex,
  cameraFlex,
  cameraBracket,
  cowling,
  coverScrews,
  trayScrews,
];
