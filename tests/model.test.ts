import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createModel } from '../src/data';
import { PHONE, LENS } from '../src/data/dimensions';
import { MATERIALS } from '../src/data/materials';
import { GeometryFactory } from '../src/core/GeometryFactory';
import { poseAt } from '../src/core/ExplosionController';

const { registry, tree } = createModel();

describe('component registry', () => {
  it('has unique ids and complete metadata', () => {
    const ids = registry.ids();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(45);
    for (const def of registry.all()) {
      expect(def.id).toMatch(/^[a-z0-9-]+$/);
      expect(def.name.length).toBeGreaterThan(2);
      expect(tree.hasNode(def.assembly)).toBe(true);
      expect(MATERIALS[def.material], `${def.id} material`).toBeDefined();
      expect(def.description.length).toBeGreaterThan(20);
      expect(def.purpose.length).toBeGreaterThan(10);
      expect(def.provenanceNote.length).toBeGreaterThan(10);
      expect(typeof def.visible).toBe('boolean');
      expect(def.assembled.position).toHaveLength(3);
      expect(def.exploded.position).toHaveLength(3);
      expect(def.stage.start).toBeGreaterThanOrEqual(0);
      expect(def.stage.end).toBeLessThanOrEqual(1);
      expect(def.stage.start).toBeLessThan(def.stage.end);
      if (def.geometry.type === 'procedural') {
        for (const part of def.geometry.parts) {
          if (part.material) expect(MATERIALS[part.material], `${def.id} part material`).toBeDefined();
        }
      }
    }
  });

  it('contains every component class required by the brief', () => {
    const required = [
      'front-glass', 'display-panel', 'display-support', 'unibody-frame', 'rear-glass', 'camera-plateau',
      'camera-telephoto', 'camera-main', 'camera-ultrawide',
      'lens-cover-telephoto', 'lens-cover-main', 'lens-cover-ultrawide',
      'action-button', 'volume-up', 'volume-down', 'side-button', 'camera-control', 'usb-c-opening',
      'bottom-openings', 'pentalobe-screws',
      'battery', 'logic-board', 'soc-a19-pro', 'shield-processor', 'thermal-interface', 'vapor-chamber',
      'usb-c-assembly', 'speaker-module', 'haptic-motor', 'wireless-coil', 'flex-charging', 'flex-display',
      'camera-bracket', 'connector-cowling', 'bracket-screws', 'battery-tray-screws',
    ];
    for (const id of required) expect(registry.has(id), id).toBe(true);
  });

  it('never claims verified provenance without citing a source', () => {
    for (const def of registry.all()) {
      if (def.provenance !== 'approximated') expect(def.provenanceNote).toMatch(/Apple|iFixit/);
    }
  });
});

describe('assembly hierarchy', () => {
  it('is structurally valid', () => {
    expect(tree.validate()).toEqual([]);
  });

  it('attaches every component to Exterior or Interior under the root', () => {
    for (const def of registry.all()) {
      const path = tree.pathOf(def.id).map((n) => n.id);
      expect(path[0]).toBe('iphone-17-pro');
      expect(['exterior', 'interior']).toContain(path[1]);
      expect(path[path.length - 1]).toBe(def.assembly);
    }
    const ext = tree.descendantComponents('exterior');
    const int = tree.descendantComponents('interior');
    expect(ext.length + int.length).toBe(registry.size);
    expect(ext.filter((id) => int.includes(id))).toEqual([]);
    expect(ext).toContain('unibody-frame');
    expect(int).toContain('battery');
  });
});

describe('procedural geometry', () => {
  it('builds finite, non-empty geometry for every part', () => {
    for (const def of registry.all()) {
      expect(def.geometry.type).toBe('procedural');
      if (def.geometry.type !== 'procedural') continue;
      expect(def.geometry.parts.length).toBeGreaterThan(0);
      for (const part of def.geometry.parts) {
        const g = GeometryFactory.get(part.geom);
        expect(g.attributes.position.count, `${def.id}/${part.name}`).toBeGreaterThan(8);
        const b = g.boundingBox!;
        for (const v of [...b.min.toArray(), ...b.max.toArray()]) expect(Number.isFinite(v)).toBe(true);
        const pos = g.attributes.position.array as ArrayLike<number>;
        for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) throw new Error(`NaN vertex in ${def.id}`);
      }
    }
  });

  it('caches identical specs', () => {
    const a = GeometryFactory.get({ kind: 'cyl', r: 1, depth: 2 });
    const b = GeometryFactory.get({ kind: 'cyl', r: 1, depth: 2 });
    expect(a).toBe(b);
  });

  it('assembled envelope matches the published outer dimensions', () => {
    const frame = registry.get('unibody-frame');
    const box = GeometryFactory.componentBox(frame);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(PHONE.width, 1);
    expect(size.y).toBeCloseTo(PHONE.height, 1);
    expect(size.z).toBeCloseTo(PHONE.depth, 1);
  });

  it('keeps every assembled component inside the device envelope', () => {
    // Envelope = body + camera plateau/lens rings on the back; buttons may sit 1 mm proud.
    const env = new THREE.Box3(
      new THREE.Vector3(-PHONE.width / 2 - 1, -PHONE.height / 2 - 0.2, -PHONE.depth / 2 - 0.01),
      new THREE.Vector3(PHONE.width / 2 + 1, PHONE.height / 2 + 0.01, PHONE.depth / 2 + PHONE.plateauHeight + 1.5),
    );
    for (const def of registry.all()) {
      const box = GeometryFactory.componentBox(def).translate(new THREE.Vector3(...def.assembled.position));
      expect(env.containsBox(box), `${def.id} ${JSON.stringify(box)}`).toBe(true);
    }
  });

  it('keeps interior parts inside the cavity (between display stack and rear shell)', () => {
    const zMin = -PHONE.depth / 2 + 1.5; // behind glass + panel + support
    const zMaxBody = PHONE.depth / 2 - PHONE.floor + 0.01;
    const xMax = PHONE.width / 2 - PHONE.wall + 0.01;
    const yMax = PHONE.height / 2 - PHONE.wall + 0.01;
    const through = new Set(['camera-telephoto', 'camera-main', 'camera-ultrawide']); // barrels pass the rear shell
    for (const id of tree.descendantComponents('interior')) {
      const def = registry.get(id);
      const box = GeometryFactory.componentBox(def).translate(new THREE.Vector3(...def.assembled.position));
      expect(box.min.z, `${id} zmin`).toBeGreaterThanOrEqual(zMin);
      if (!through.has(id)) expect(box.max.z, `${id} zmax`).toBeLessThanOrEqual(zMaxBody);
      expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), `${id} x`).toBeLessThanOrEqual(xMax);
      expect(Math.max(Math.abs(box.min.y), Math.abs(box.max.y)), `${id} y`).toBeLessThanOrEqual(yMax);
    }
  });

  it('aligns camera modules with their lens covers and rear-shell holes', () => {
    for (const key of ['telephoto', 'main', 'ultrawide'] as const) {
      const cam = poseAt(registry.get(`camera-${key}`), 0).position;
      const cover = poseAt(registry.get(`lens-cover-${key}`), 0).position;
      expect(cam[0]).toBe(LENS[key][0]);
      expect(cam[1]).toBe(LENS[key][1]);
      expect(cover[0]).toBe(cam[0]);
      expect(cover[1]).toBe(cam[1]);
    }
  });
});
