import type { ComponentDefinition, PartSpec, Vec3 } from '../core/types';
import { HH, HW, LAYER, LENS, PHONE, PLATEAU, REAR_GLASS, Z_FRONT, Z_REAR, define, screw } from './dimensions';

const RY90: Vec3 = [0, Math.PI / 2, 0];
const RX90: Vec3 = [Math.PI / 2, 0, 0];

const APPLE_SPECS = 'Apple iPhone 17 Pro tech specs (support.apple.com/125090)';
const IFIXIT = 'iFixit iPhone 17 Pro teardown (ifixit.com/News/113388)';
const APPROX = 'Shape, size and position are approximations.';

const lensHoles = [LENS.telephoto, LENS.main, LENS.ultrawide];

/* ------------------------------------------------------------------ */
/* Display assembly                                                    */
/* ------------------------------------------------------------------ */

const frontGlass = define({
  id: 'front-glass',
  name: 'Front cover glass',
  assembly: 'display-assembly',
  classification: 'Protective cover',
  material: 'glassFront',
  materialNote: 'Ceramic Shield 2 (glass-ceramic) per Apple.',
  purpose: 'Protects the display and forms the touch surface.',
  description:
    'Flat glass-ceramic cover bonded to the OLED panel. Modelled as a 0.66 mm rounded plate seated inside the frame opening, with an earpiece slot at the top edge.',
  provenance: 'verified',
  provenanceNote: `Material named by ${APPLE_SPECS}. Thickness, outline and corner radius are approximations.`,
  label: true,
  at: [0, 0, Z_FRONT + 0.33],
  explode: [0, 0, LAYER.frontGlass],
  parts: [
    { name: 'Cover glass', geom: { kind: 'plate', w: 67.5, h: 145.6, r: 8.8, depth: 0.66 } },
    { name: 'Earpiece slot', geom: { kind: 'plate', w: 9, h: 0.8, r: 0.4, depth: 0.04 }, material: 'mesh', position: [0, 71.6, -0.315] },
  ],
});

const displayPanel = define({
  id: 'display-panel',
  name: 'OLED display panel',
  assembly: 'display-assembly',
  classification: 'Display',
  material: 'oled',
  materialNote: '6.3-inch Super Retina XDR OLED, 2622 × 1206 px at 460 ppi (Apple).',
  purpose: 'Emissive display and touch sensing layer.',
  description:
    'OLED stack laminated under the cover glass. The pill-shaped Dynamic Island cut-out near the top hosts the front camera and Face ID optics.',
  provenance: 'verified',
  provenanceNote: `Display type and size from ${APPLE_SPECS}. Panel thickness and the cut-out geometry are approximations.`,
  label: true,
  at: [0, 0, -3.38],
  explode: [0, 0, LAYER.displayPanel],
  parts: [
    { name: 'Panel stack', geom: { kind: 'plate', w: 66.9, h: 145, r: 8.5, depth: 0.55 } },
    { name: 'Active area', geom: { kind: 'plate', w: 65.3, h: 143.4, r: 7.8, depth: 0.04 }, material: 'oledActive', position: [0, 0, -0.275] },
    { name: 'Dynamic Island cut-out', geom: { kind: 'plate', w: 20, h: 5.6, r: 2.8, depth: 0.04 }, material: 'cavity', position: [0, 64.5, -0.3] },
    { name: 'Front camera window', geom: { kind: 'cyl', r: 1.5, depth: 0.03 }, material: 'lensGlass', position: [6.5, 64.5, -0.32] },
  ],
});

const displaySupport = define({
  id: 'display-support',
  name: 'Display support plate',
  assembly: 'display-assembly',
  classification: 'Support structure',
  material: 'steel',
  materialNote: 'Thin stamped steel backing (assumed).',
  purpose: 'Stiffens the display module and shields it from the internals.',
  description:
    'Thin metal backing plate behind the OLED panel. It carries the display connector tab and gives the laminated display its bending stiffness.',
  provenance: 'approximated',
  provenanceNote: `A metal display backing is typical for iPhones; this one is not described by a public source. ${APPROX}`,
  at: [0, 0, -2.925],
  explode: [0, 0, LAYER.displaySupport],
  parts: [
    { name: 'Backing plate', geom: { kind: 'plate', w: 66.5, h: 144.6, r: 8.3, depth: 0.3 } },
    { name: 'Display driver tab', geom: { kind: 'plate', w: 7, h: 5, r: 0.6, depth: 0.08 }, material: 'flex', position: [26, 44, 0.19] },
  ],
});

/* ------------------------------------------------------------------ */
/* Enclosure                                                           */
/* ------------------------------------------------------------------ */

const frame = define({
  id: 'unibody-frame',
  name: 'Aluminium unibody frame',
  assembly: 'enclosure',
  classification: 'Structural enclosure',
  material: 'aluOrange',
  materialNote: 'Heat-forged, anodised aluminium (Cosmic Orange finish).',
  purpose: 'Primary structure: side walls and rear shell that every other part mounts to; also the final heat sink.',
  description:
    'One-piece aluminium tub: 2 mm side walls plus a thin rear shell with openings for the back glass and the three rear lenses. Internals are installed from the display side.',
  provenance: 'verified',
  provenanceNote: `"Aluminium unibody design" and outer dimensions from ${APPLE_SPECS}; forged/anodised construction per ${IFIXIT}. Wall thickness, corner radius and openings are approximations; button holes and antenna breaks are not modelled.`,
  label: true,
  explode: [0, 0, LAYER.frame],
  parts: [
    {
      name: 'Side walls',
      geom: {
        kind: 'plate',
        w: PHONE.width,
        h: PHONE.height,
        r: PHONE.cornerRadius,
        depth: PHONE.depth,
        bevel: 0.9,
        holes: [{ shape: 'rect', x: 0, y: 0, w: PHONE.width - 2 * PHONE.wall, h: PHONE.height - 2 * PHONE.wall, r: PHONE.cornerRadius - PHONE.wall }],
      },
    },
    {
      name: 'Rear shell',
      geom: {
        kind: 'plate',
        w: PHONE.width - 3.4,
        h: PHONE.height - 3.4,
        r: PHONE.cornerRadius - 1.7,
        depth: PHONE.floor,
        holes: [
          { shape: 'rect', x: 0, y: REAR_GLASS.cy, w: REAR_GLASS.w, h: REAR_GLASS.h, r: REAR_GLASS.r },
          ...lensHoles.map(([x, y]) => ({ shape: 'circle' as const, x, y, r: LENS.holeRadius })),
        ],
      },
      position: [0, 0, Z_REAR - PHONE.floor / 2],
    },
  ],
});

const rearGlass = define({
  id: 'rear-glass',
  name: 'Rear glass panel',
  assembly: 'enclosure',
  classification: 'Rear cover / RF window',
  material: 'glassRear',
  materialNote: 'Ceramic Shield back (Apple).',
  purpose: 'Radio-transparent window that lets MagSafe / Qi2 wireless charging pass through the metal body.',
  description:
    'Inset glass panel below the camera plateau. Unlike earlier Pro models it does not cover the whole back; it mainly gives access to the wireless-charging coil.',
  provenance: 'verified',
  provenanceNote: `"Ceramic Shield back" from ${APPLE_SPECS}; the small, coil-only back glass is described by ${IFIXIT}. Outline and thickness are approximations.`,
  label: true,
  at: [0, REAR_GLASS.cy, Z_REAR - PHONE.floor / 2],
  explode: [0, 0, LAYER.rearCover],
  parts: [{ name: 'Glass inlay', geom: { kind: 'plate', w: REAR_GLASS.w - 0.3, h: REAR_GLASS.h - 0.3, r: REAR_GLASS.r - 0.15, depth: PHONE.floor } }],
});

/* ------------------------------------------------------------------ */
/* Rear camera exterior                                                */
/* ------------------------------------------------------------------ */

const plateau = define({
  id: 'camera-plateau',
  name: 'Camera plateau',
  assembly: 'rear-camera-exterior',
  classification: 'Enclosure feature',
  material: 'aluOrange',
  materialNote: 'Anodised aluminium, integral with the unibody on the real device.',
  purpose: 'Raised full-width housing that makes room for the camera modules and part of the logic board.',
  description:
    'Full-width raised plateau across the top of the back. On the real phone it is part of the forged unibody; it is modelled as a separate piece only so the exploded view can show what sits beneath it.',
  provenance: 'reported',
  provenanceNote: `Plateau and its anodised sharp edge described by ${IFIXIT}. Height, outline and the separation from the frame are modelling choices.`,
  label: true,
  at: [0, PLATEAU.cy, Z_REAR + PHONE.plateauHeight / 2],
  explode: [0, 0, LAYER.rearCover],
  parts: [
    {
      name: 'Plateau',
      geom: {
        kind: 'plate',
        w: PLATEAU.w,
        h: PLATEAU.h,
        r: PLATEAU.r,
        depth: PHONE.plateauHeight,
        bevel: 0.45,
        holes: lensHoles.map(([x, y]) => ({ shape: 'circle' as const, x, y: y - PLATEAU.cy, r: LENS.holeRadius })),
      },
    },
  ],
});

function lensCover(id: string, name: string, pos: [number, number], optic: string): ComponentDefinition {
  return define({
    id,
    name,
    assembly: 'rear-camera-exterior',
    classification: 'Lens cover and protective ring',
    material: 'aluOrangeDark',
    materialNote: 'Metal trim ring with a sapphire-crystal lens cover (cover material assumed).',
    purpose: 'Protects the lens stack and seals the camera opening.',
    description: `Raised protective ring and cover glass over the ${optic}.`,
    provenance: 'approximated',
    provenanceNote: `The camera itself is listed in ${APPLE_SPECS}; ring diameter, height and which lens sits in which position are approximations.`,
    at: [pos[0], pos[1], Z_REAR + PHONE.plateauHeight + 0.7],
    explode: [0, 0, LAYER.lensRings],
    parts: [
      { name: 'Protective ring', geom: { kind: 'tube', rOuter: 7.7, rInner: 6.2, depth: 1.4 } },
      { name: 'Lens cover glass', geom: { kind: 'cyl', r: 6.2, depth: 0.4, segments: 48 }, material: 'lensGlass', position: [0, 0, 0.3] },
      { name: 'Aperture ring', geom: { kind: 'tube', rOuter: 4.5, rInner: 4.0, depth: 0.04 }, material: 'steelDark', position: [0, 0, 0.52] },
      { name: 'Aperture', geom: { kind: 'cyl', r: 2.6, depth: 0.04, segments: 32 }, material: 'cavity', position: [0, 0, 0.52] },
    ],
  });
}

const lensTele = lensCover('lens-cover-telephoto', 'Telephoto lens cover', LENS.telephoto, '48MP Fusion Telephoto camera');
const lensMain = lensCover('lens-cover-main', 'Main lens cover', LENS.main, '48MP Fusion Main camera');
const lensUltra = lensCover('lens-cover-ultrawide', 'Ultra Wide lens cover', LENS.ultrawide, '48MP Fusion Ultra Wide camera');

const flashLidar = define({
  id: 'flash-lidar',
  name: 'Flash, LiDAR and rear microphone',
  assembly: 'rear-camera-exterior',
  classification: 'Illumination and sensing windows',
  material: 'flash',
  purpose: 'LED flash for illumination, LiDAR scanner for depth, and a rear microphone port.',
  description: 'Three small windows on the right-hand side of the plateau: flash diffuser, microphone hole and LiDAR scanner window.',
  provenance: 'approximated',
  provenanceNote: `Window sizes and positions are approximations based on public product imagery.`,
  at: [22, PLATEAU.cy, Z_REAR + PHONE.plateauHeight + 0.08],
  explode: [0, 0, LAYER.flash],
  parts: [
    { name: 'Flash diffuser', geom: { kind: 'cyl', r: 3.3, depth: 0.16, segments: 40 }, position: [0, 9.5, 0] },
    { name: 'Rear microphone port', geom: { kind: 'cyl', r: 0.55, depth: 0.16, segments: 16 }, material: 'cavity', position: [0, 0, 0] },
    { name: 'LiDAR window', geom: { kind: 'cyl', r: 3.0, depth: 0.16, segments: 40 }, material: 'lensGlass', position: [0, -9.5, 0] },
  ],
});

/* ------------------------------------------------------------------ */
/* Buttons and external connectors                                     */
/* ------------------------------------------------------------------ */

function sideButton(
  id: string,
  name: string,
  side: 1 | -1,
  y: number,
  length: number,
  purpose: string,
  opts: { proud?: number; material?: string; note?: string } = {},
): ComponentDefinition {
  const proud = opts.proud ?? 0.5;
  const depth = 1.4;
  return define({
    id,
    name,
    assembly: 'controls-io',
    classification: 'External control',
    material: opts.material ?? 'aluOrange',
    materialNote: opts.note ?? 'Anodised aluminium key cap, colour-matched to the frame.',
    purpose,
    description: `${name} on the ${side === 1 ? 'left' : 'right'} edge (as seen from the display side). The hole through the frame wall is not modelled.`,
    provenance: 'verified',
    provenanceNote: `Listed in ${APPLE_SPECS}. Size and position along the edge are approximations.`,
    at: [side * (HW + proud - depth / 2), y, 0],
    explode: [side * 16, 0, LAYER.frame],
    parts: [{ name: 'Key cap', geom: { kind: 'plate', w: 2.6, h: length, r: 1.2, depth }, rotation: RY90 }],
  });
}

const actionButton = sideButton('action-button', 'Action button', 1, 39, 6.5, 'User-assignable shortcut button.');
const volumeUp = sideButton('volume-up', 'Volume up button', 1, 25, 11, 'Raises volume; also a camera shutter.');
const volumeDown = sideButton('volume-down', 'Volume down button', 1, 11, 11, 'Lowers volume.');
const powerButton = sideButton('side-button', 'Side button', -1, 22, 17, 'Sleep/wake, Siri and power functions.');
const cameraControl = sideButton('camera-control', 'Camera Control', -1, -22, 13, 'Touch- and force-sensitive camera control surface.', {
  proud: 0.12,
  material: 'aluOrangeDark',
  note: 'Flush capacitive control with a hard crystal cover (cover material assumed).',
});

const simTray = define({
  id: 'sim-tray',
  name: 'SIM tray',
  assembly: 'controls-io',
  classification: 'External connector / tray',
  material: 'aluOrange',
  purpose: 'Holds a nano-SIM card (models sold with a physical SIM slot).',
  description: 'Removable tray on the left edge. eSIM-only variants omit it; it is shown here for the dual SIM (nano-SIM + eSIM) variant.',
  provenance: 'verified',
  provenanceNote: `Dual SIM (nano-SIM and eSIM) listed in ${APPLE_SPECS}. Position and tray depth are approximations.`,
  at: [HW - 2.95, -8, 0],
  explode: [20, 0, LAYER.frame],
  parts: [
    { name: 'Tray face', geom: { kind: 'plate', w: 2.2, h: 14.5, r: 1.1, depth: 0.9 }, rotation: RY90, position: [2.55, 0, 0] },
    { name: 'Tray body', geom: { kind: 'box', size: [3.6, 12.5, 0.7] }, material: 'steel', position: [0.3, 0, 0] },
  ],
});

const usbOpening = define({
  id: 'usb-c-opening',
  name: 'USB-C port opening',
  assembly: 'controls-io',
  classification: 'External connector',
  material: 'cavity',
  materialNote: 'Opening machined in the aluminium frame.',
  purpose: 'External opening for the USB-C connector (charging and data).',
  description: 'Pill-shaped port opening in the bottom edge. Shown as a dark inlay; the real through-hole in the frame is not cut.',
  provenance: 'verified',
  provenanceNote: `USB-C connector listed in ${APPLE_SPECS}. Opening size is an approximation.`,
  at: [0, -HH + 0.1, 0],
  explode: [0, -18, LAYER.frame],
  parts: [{ name: 'Port opening', geom: { kind: 'plate', w: 8.6, h: 2.9, r: 1.45, depth: 0.3 }, rotation: RX90 }],
});

const grilleParts: PartSpec[] = [];
for (let i = 0; i < 5; i++) {
  grilleParts.push({ name: `Speaker port ${i + 1}`, geom: { kind: 'cyl', r: 0.75, depth: 0.3, segments: 16 }, rotation: RX90, position: [10.6 + i * 3, 0, 0] });
}
for (let i = 0; i < 4; i++) {
  grilleParts.push({ name: `Microphone port ${i + 1}`, geom: { kind: 'cyl', r: 0.75, depth: 0.3, segments: 16 }, rotation: RX90, position: [-10.6 - i * 3, 0, 0] });
}

const bottomOpenings = define({
  id: 'bottom-openings',
  name: 'Speaker and microphone openings',
  assembly: 'controls-io',
  classification: 'Acoustic openings',
  material: 'cavity',
  materialNote: 'Drilled ports in the aluminium frame, backed by acoustic mesh.',
  purpose: 'Sound outlet for the bottom speaker and inlet for the bottom microphones.',
  description: 'Rows of small ports either side of the USB-C opening on the bottom edge.',
  provenance: 'approximated',
  provenanceNote: 'Port count, diameter and spacing are approximations based on public product imagery.',
  at: [0, -HH + 0.1, 0],
  explode: [0, -12, LAYER.frame],
  parts: grilleParts,
});

/* ------------------------------------------------------------------ */
/* Exterior fasteners                                                  */
/* ------------------------------------------------------------------ */

const pentalobes = define({
  id: 'pentalobe-screws',
  name: 'Bottom pentalobe screws (×2)',
  assembly: 'exterior-fasteners',
  classification: 'External fastener',
  material: 'steel',
  materialNote: 'Stainless steel, pentalobe (P2) drive.',
  purpose: 'Secure the display assembly to the frame at the bottom edge.',
  description: 'Two security screws flanking the USB-C port. Removing them is the first step of opening the phone.',
  provenance: 'reported',
  provenanceNote: `Pentalobe (P2) screws at the bottom reported by ${IFIXIT}. Position and length are approximations.`,
  at: [0, -HH - 0.1, 0],
  explode: [0, -24, LAYER.frame],
  parts: [...screw(-7.3, 0, 0, '-y', 0.85, 3), ...screw(7.3, 0, 0, '-y', 0.85, 3)],
});

export const exteriorComponents: ComponentDefinition[] = [
  frontGlass,
  displayPanel,
  displaySupport,
  frame,
  rearGlass,
  plateau,
  lensTele,
  lensMain,
  lensUltra,
  flashLidar,
  actionButton,
  volumeUp,
  volumeDown,
  powerButton,
  cameraControl,
  simTray,
  usbOpening,
  bottomOpenings,
  pentalobes,
];
