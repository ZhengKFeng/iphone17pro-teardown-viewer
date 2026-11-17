#!/usr/bin/env node
/**
 * End-to-end functional check + screenshot generator.
 *
 * Starts the Vite dev server, opens the app in headless Chrome (system
 * install, driven through puppeteer-core), exercises the real UI and writes
 * screenshots to docs/screenshots/.
 *
 *   npm run e2e                  # functional checks + screenshots
 *   npm run screenshots          # screenshots only
 *   CHROME_PATH=/path/to/chrome npm run e2e
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = resolve(ROOT, 'docs/screenshots');
const PORT = Number(process.env.E2E_PORT ?? 5199);
const URL = `http://127.0.0.1:${PORT}/`;
const SCREENSHOTS_ONLY = process.argv.includes('--screenshots-only');

const CHROME =
  process.env.CHROME_PATH ??
  ['/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Chromium found. Set CHROME_PATH.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function startServer() {
  const child = spawn(process.execPath, [resolve(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return child;
    } catch {
      /* not up yet */
    }
    if (child.exitCode !== null) throw new Error(`vite exited early:\n${log}`);
    await sleep(250);
  }
  child.kill();
  throw new Error(`vite did not start:\n${log}`);
}

/** Helpers evaluated inside the page. */
const inPage = {
  state: () => {
    const T = window.__teardown;
    const s = T.store.getState();
    return { explosion: s.explosion, playing: s.playing, selectedId: s.selectedId, isolated: s.isolated, hidden: Object.keys(s.hidden), mode: s.mode };
  },
  camera: () => window.__teardown.cameraController.state(),
  /** Max deviation between scene-object transforms and the pure pose function. */
  poseError: () => {
    const T = window.__teardown;
    const t = T.store.getState().explosion;
    let maxErr = 0;
    let mounted = 0;
    for (const def of T.model.registry.all()) {
      const obj = T.sceneRefs.root.getObjectByName(def.id);
      if (!obj) continue;
      mounted++;
      const pose = T.model.explosion.poseAt(def.id, t);
      for (let i = 0; i < 3; i++) maxErr = Math.max(maxErr, Math.abs(obj.position.getComponent(i) - pose.position[i]));
      const q = [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w];
      for (let i = 0; i < 4; i++) maxErr = Math.max(maxErr, Math.abs(q[i] - pose.quaternion[i]));
    }
    return { maxErr, mounted, t };
  },
  /** Exact comparison against the assembled transforms. */
  assembledExact: () => {
    const T = window.__teardown;
    const bad = [];
    for (const def of T.model.registry.all()) {
      const obj = T.sceneRefs.root.getObjectByName(def.id);
      if (!obj) continue;
      const p = def.assembled.position;
      if (obj.position.x !== p[0] || obj.position.y !== p[1] || obj.position.z !== p[2]) bad.push(def.id);
      if (obj.quaternion.x !== 0 || obj.quaternion.y !== 0 || obj.quaternion.z !== 0 || obj.quaternion.w !== 1) bad.push(`${def.id}(rot)`);
    }
    return bad;
  },
  /** Screen position (CSS px) of a component's centre, and whether its box is on screen. */
  project: (id) => {
    const T = window.__teardown;
    const box = T.worldBox(id);
    const canvas = T.sceneRefs.canvas;
    const rect = canvas.getBoundingClientRect();
    const camera = T.__cam();
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push([x, y, z]);
    const centre = box.min.clone().add(box.max).multiplyScalar(0.5).project(camera);
    let inside = true;
    for (const c of corners) {
      const v = centre.clone().set(c[0], c[1], c[2]).project(camera);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) inside = false;
    }
    return { x: rect.left + ((centre.x + 1) / 2) * rect.width, y: rect.top + ((1 - centre.y) / 2) * rect.height, inside };
  },
};

/** Move the real slider element (React-controlled input) and wait for the scene to render it. */
async function setSlider(page, value) {
  await page.evaluate((v) => {
    const el = document.querySelector('[data-testid="explosion-slider"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await frames(page);
}

/** Wait for n rendered animation frames (robust on slow software-GL machines). */
async function frames(page, n = 2) {
  await page.evaluate((count) => new Promise((res) => {
    let i = 0;
    const tick = () => (++i >= count ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), n);
}

const idle = (page) => waitFor(page, () => window.__teardown.store.getState().playing === null && !window.__teardown.cameraController.tween, 120000);

async function waitFor(page, fn, timeout = 120000, arg) {
  await page.waitForFunction(fn, { timeout, polling: 100 }, arg);
}

/** Let camera damping / tweens finish, then wait for rendered frames. */
async function settle(page, ms = 400) {
  await sleep(ms);
  await waitFor(page, () => !window.__teardown.cameraController.tween);
  await frames(page, 3);
}

async function shot(page, name) {
  await settle(page, 300);
  await frames(page, 2);
  await page.screenshot({ path: resolve(SHOTS, name) });
  console.log(`  shot  docs/screenshots/${name}`);
}

async function ready(page) {
  await waitFor(page, () => window.__teardown && window.__teardown.cameraController.attached && window.__teardown.sceneRefs.root, 180000);
  await page.evaluate(() => {
    const T = window.__teardown;
    T.__cam = () => T.cameraController.camera;
    // Tweens follow wall-clock time even when frames are slow (headless software GL).
    T.gsap.ticker.lagSmoothing(0);
  });
  await sleep(1500);
  await frames(page, 3);
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  console.log(`Starting dev server on ${URL}`);
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 600000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--window-size=1440,900'],
    defaultViewport: { width: 1100, height: 680, deviceScaleFactor: 1 },
  });

  const consoleErrors = [];
  const consoleWarnings = [];
  const externalRequests = [];
  const failedRequests = [];

  const wire = (page) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warn' || msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('request', (req) => {
      const u = req.url();
      if (!u.startsWith(URL) && !u.startsWith('data:') && !u.startsWith('blob:')) externalRequests.push(u);
    });
    page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText}`));
  };

  try {
    const page = await browser.newPage();
    wire(page);
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 180000 });
    await ready(page);
    const total = await page.evaluate(() => window.__teardown.model.registry.size);

    if (!SCREENSHOTS_ONLY) {
      /* ---------------- startup ---------------- */
      console.log('\nStartup');
      const counts = await page.evaluate(() => {
        const T = window.__teardown;
        const ids = T.model.registry.ids();
        const mounted = ids.filter((id) => T.sceneRefs.root.getObjectByName(id));
        let meshes = 0;
        T.sceneRefs.root.traverse((o) => o.isMesh && meshes++);
        const directChildren = T.sceneRefs.root.children.map((c) => c.name);
        return { total: ids.length, mounted: mounted.length, meshes, childrenOk: ids.every((id) => directChildren.includes(id)), treeProblems: T.model.tree.validate() };
      });
      check('all components are mounted in the scene', counts.mounted === counts.total, `${counts.mounted}/${counts.total} components, ${counts.meshes} meshes`);
      check('every component hangs off the assembly root and the tree validates', counts.childrenOk && counts.treeProblems.length === 0, counts.treeProblems.join('; '));
      const frame0 = await page.evaluate(inPage.project, 'unibody-frame');
      check('complete phone is inside the viewport at startup', frame0.inside);
      const pixels = await page.evaluate(() => {
        const c = window.__teardown.sceneRefs.canvas;
        const tmp = document.createElement('canvas');
        tmp.width = c.width;
        tmp.height = c.height;
        const ctx = tmp.getContext('2d');
        ctx.drawImage(c, 0, 0);
        const d = ctx.getImageData(0, 0, tmp.width, tmp.height).data;
        let orange = 0;
        for (let i = 0; i < d.length; i += 16) if (d[i] > 140 && d[i] > d[i + 1] * 1.35 && d[i + 1] > d[i + 2] * 1.2) orange++;
        return { orange, total: d.length / 16 };
      });
      check('orange phone body is rendered', pixels.orange / pixels.total > 0.03, `${((100 * pixels.orange) / pixels.total).toFixed(1)}% of canvas pixels are orange`);

      /* ---------------- slider ---------------- */
      console.log('\nExplosion slider');
      let ok = true;
      let worst = 0;
      const seq = [0.1, 0.25, 0.333, 0.5, 0.75, 0.9, 1, 0.6, 0.2, 0.05];
      for (const v of seq) {
        await setSlider(page, v);
        const e = await page.evaluate(inPage.poseError);
        worst = Math.max(worst, e.maxErr);
        if (Math.abs(e.t - v) > 1e-9 || e.maxErr > 1e-9) ok = false;
      }
      check('slider drives explosionProgress continuously and the scene follows', ok, `${seq.length} positions, max transform error ${worst.toExponential(1)}`);
      await setSlider(page, 0);
      const bad0 = await page.evaluate(inPage.assembledExact);
      check('slider back to 0 restores every original transform exactly', bad0.length === 0, bad0.join(', '));

      /* ---------------- playback ---------------- */
      console.log('\nPlayback');
      await page.click('[data-testid="speed-0.25"]');
      await page.click('[data-testid="btn-play"]');
      const samples = await page.evaluate(
        () =>
          new Promise((res) => {
            const out = [];
            const tick = () => {
              out.push(window.__teardown.store.getState().explosion);
              if (out.length >= 5) res(out);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
      const increasing = samples.every((v, i) => i === 0 || v >= samples[i - 1]) && samples[samples.length - 1] > samples[0];
      check('automated teardown advances monotonically', increasing, samples.map((v) => v.toFixed(3)).join(' → '));
      await page.click('[data-testid="btn-play"]'); // pause
      const paused1 = (await page.evaluate(inPage.state)).explosion;
      await frames(page, 2);
      const paused2 = await page.evaluate(inPage.state);
      check('pause holds the current state', paused2.explosion === paused1 && paused2.playing === null && paused1 > 0 && paused1 < 1, `held at ${(paused1 * 100).toFixed(1)}%`);
      await page.click('[data-testid="speed-4"]');
      await page.click('[data-testid="btn-play"]'); // resume
      await waitFor(page, () => window.__teardown.store.getState().explosion === 1 && window.__teardown.store.getState().playing === null);
      await frames(page);
      const e1 = await page.evaluate(inPage.poseError);
      check('teardown finishes at exactly 100% with the exploded transforms', e1.t === 1 && e1.maxErr === 0, `max error ${e1.maxErr}`);

      await page.click('[data-testid="speed-0.5"]');
      await page.click('[data-testid="btn-reverse"]');
      await waitFor(page, () => window.__teardown.store.getState().explosion < 1);
      const mid = await page.evaluate(inPage.state);
      check('reverse playback runs', mid.playing === 'reverse' && mid.explosion < 1, `${(mid.explosion * 100).toFixed(1)}%`);
      await page.click('[data-testid="speed-4"]');
      await waitFor(page, () => window.__teardown.store.getState().explosion === 0 && window.__teardown.store.getState().playing === null);
      await frames(page);
      const bad1 = await page.evaluate(inPage.assembledExact);
      check('reassembly returns every component to its original transform (bit-exact)', bad1.length === 0, bad1.join(', '));

      // interleaved scrubbing + play + reverse, then reset
      await setSlider(page, 0.37);
      await page.click('[data-testid="btn-play"]');
      await frames(page, 1);
      await page.click('[data-testid="btn-reverse"]');
      await frames(page, 1);
      await setSlider(page, 0.81);
      await page.click('[data-testid="btn-reset-assembly"]');
      await waitFor(page, () => window.__teardown.store.getState().explosion === 0 && window.__teardown.store.getState().playing === null);
      await frames(page);
      const bad2 = await page.evaluate(inPage.assembledExact);
      check('reset after interleaved play / reverse / scrub is drift-free', bad2.length === 0, bad2.join(', '));
      await page.click('[data-testid="speed-1"]');

      /* ---------------- camera ---------------- */
      console.log('\nCamera');
      await page.click('[data-testid="btn-reset-camera"]');
      await settle(page, 1200);
      const cx = 550;
      const cy = 300;
      const c0 = await page.evaluate(inPage.camera);
      await page.mouse.move(cx + 120, cy + 160);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(cx + 260, cy + 200, { steps: 8 });
      await page.mouse.up({ button: 'left' });
      await settle(page);
      const c1 = await page.evaluate(inPage.camera);
      const moved = Math.hypot(c1.position[0] - c0.position[0], c1.position[1] - c0.position[1], c1.position[2] - c0.position[2]);
      check('left-drag rotates (camera orbits; distance and target kept)', moved > 20 && Math.abs(c1.distance - c0.distance) < 0.5 && Math.hypot(...c1.target) < 1e-6, `camera moved ${moved.toFixed(0)} mm`);

      await page.mouse.move(cx + 120, cy + 160);
      await page.mouse.wheel({ deltaY: -400 });
      await settle(page);
      const c2 = await page.evaluate(inPage.camera);
      check('mouse wheel zooms', c2.distance < c1.distance - 5, `${c1.distance.toFixed(0)} → ${c2.distance.toFixed(0)} mm`);

      await page.mouse.move(cx + 120, cy + 160);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(cx + 190, cy + 110, { steps: 6 });
      await page.mouse.up({ button: 'right' });
      await settle(page);
      const c3 = await page.evaluate(inPage.camera);
      check('right-drag pans (orbit target moves)', Math.hypot(...c3.target) > 3, `target moved ${Math.hypot(...c3.target).toFixed(1)} mm`);

      await page.click('[data-testid="btn-reset-camera"]');
      await settle(page, 1300);
      const c4 = await page.evaluate(inPage.camera);
      const homeErr = Math.hypot(c4.position[0] - c0.position[0], c4.position[1] - c0.position[1], c4.position[2] - c0.position[2]);
      check('reset view restores the default camera', homeErr < 0.5 && Math.hypot(...c4.target) < 1e-3, `error ${homeErr.toFixed(3)} mm`);

      /* ---------------- selection ---------------- */
      console.log('\nSelection and isolation');
      const target = await page.evaluate(inPage.project, 'rear-glass');
      await page.mouse.click(target.x, target.y);
      await frames(page);
      const sel = await page.evaluate(inPage.state);
      const name = await page.$eval('[data-testid="inspector-name"]', (el) => el.textContent).catch(() => null);
      const assembly = await page.$eval('[data-testid="inspector-assembly"]', (el) => el.textContent).catch(() => '');
      const material = await page.$eval('[data-testid="inspector-material"]', (el) => el.textContent).catch(() => '');
      check('clicking a part in the 3D view selects it', sel.selectedId === 'rear-glass', `selected: ${sel.selectedId}`);
      check('inspector shows name, assembly classification and material', name === 'Rear glass panel' && /Exterior Assembly/.test(assembly) && /Ceramic Shield/.test(material), `${name} | ${assembly} | ${material}`);
      const hl = await page.evaluate(() => {
        const obj = window.__teardown.sceneRefs.root.getObjectByName('rear-glass');
        let emissive = 0;
        let edges = 0;
        obj.traverse((o) => {
          if (o.isMesh && o.material.emissiveIntensity) emissive = Math.max(emissive, o.material.emissiveIntensity * (o.material.emissive.r + o.material.emissive.g + o.material.emissive.b));
          if (o.isLineSegments) edges++;
        });
        return { emissive: +emissive.toFixed(2), edges, label: !!document.querySelector('.part-label--selected') };
      });
      check('selected geometry is highlighted (emissive tint, outline, label)', hl.emissive > 0.3 && hl.edges > 0 && hl.label, JSON.stringify(hl));

      // double-click → focus
      const before = await page.evaluate(inPage.camera);
      const lens = await page.evaluate(inPage.project, 'lens-cover-main');
      await page.mouse.click(lens.x, lens.y);
      await sleep(80);
      await page.mouse.click(lens.x, lens.y);
      await settle(page, 1300);
      const after = await page.evaluate(inPage.camera);
      const sel2 = await page.evaluate(inPage.state);
      check('double-click focuses the camera on the component', sel2.selectedId === 'lens-cover-main' && after.distance < before.distance * 0.6 && Math.abs(after.target[0] + 22.5) < 1 && Math.abs(after.target[1] - 45) < 1, `selected ${sel2.selectedId}, distance ${before.distance.toFixed(0)} → ${after.distance.toFixed(0)} mm, target ${after.target.map((v) => v.toFixed(1)).join(',')}`);
      await page.click('[data-testid="btn-reset-camera"]');
      await settle(page, 1300);

      // isolate through the tree + inspector
      await setSlider(page, 0.6);
      await page.click('[data-testid="tree-node-power"]');
      await page.click('[data-testid="tree-item-battery"]');
      await page.click('[data-testid="btn-isolate"]');
      await frames(page);
      const iso = await page.evaluate(() => {
        const T = window.__teardown;
        return T.model.registry.ids().filter((id) => T.sceneRefs.root.getObjectByName(id));
      });
      check('isolate shows only the selected component', iso.length === 1 && iso[0] === 'battery', iso.join(','));
      await page.click('[data-testid="btn-restore"]');
      await frames(page);
      const restored = await page.evaluate(inPage.poseError);
      check('restore brings back the complete assembly at the correct pose', restored.mounted === counts.total && restored.maxErr < 1e-9, `${restored.mounted}/${counts.total} components`);

      await page.click('[data-testid="tree-node-display-assembly"]');
      await page.click('[data-testid="tree-eye-front-glass"]');
      await frames(page);
      const hiddenNow = await page.evaluate(() => !window.__teardown.sceneRefs.root.getObjectByName('front-glass'));
      await page.click('[data-testid="btn-show-all"]');
      await frames(page);
      const backNow = await page.evaluate(() => !!window.__teardown.sceneRefs.root.getObjectByName('front-glass'));
      check('hide / show-all from the assembly tree works', hiddenNow && backNow);
      await page.keyboard.press('Escape');

      /* ---------------- engineering mode ---------------- */
      console.log('\nRendering modes');
      await page.click('[data-testid="mode-engineering"]');
      await frames(page, 3);
      const eng = await page.evaluate(() => {
        let lines = 0;
        window.__teardown.sceneRefs.root.traverse((o) => o.isLineSegments && lines++);
        return { edgeObjects: lines, labels: document.querySelectorAll('.part-label').length, axisLabels: document.querySelectorAll('.axis-label').length };
      });
      check('engineering mode shows component boundaries, labels and axes', eng.edgeObjects > 100 && eng.labels >= 10 && eng.axisLabels === 3, JSON.stringify(eng));
      await page.click('[data-testid="toggle-wireframe"]');
      await frames(page);
      const wf = await page.evaluate(() => {
        let n = 0;
        window.__teardown.sceneRefs.root.traverse((o) => o.isMesh && o.material.wireframe && n++);
        return n;
      });
      check('wireframe overlay toggles on', wf > 100, `${wf} overlay meshes`);
      await page.click('[data-testid="toggle-wireframe"]');
      await page.click('[data-testid="mode-product"]');
      await frames(page);

      /* ---------------- export ---------------- */
      console.log('\nExport');
      const exp = await page.evaluate(async () => {
        const T = window.__teardown;
        const { buildManifest, exportGLB } = await import('/src/core/SceneExporter.ts');
        const manifest = buildManifest(T.model.registry, T.model.tree, { explosionProgress: T.store.getState().explosion });
        const glb = await exportGLB(T.sceneRefs.root);
        const magic = new TextDecoder().decode(new Uint8Array(glb, 0, 4));
        return { components: manifest.components.length, glbBytes: glb.byteLength, magic };
      });
      check('scene exporter produces a manifest and a valid GLB', exp.components === counts.total && exp.magic === 'glTF' && exp.glbBytes > 100000, `${exp.components} components, ${(exp.glbBytes / 1e6).toFixed(1)} MB GLB`);
    }

    /* ---------------- screenshots (1440 × 900) ---------------- */
    console.log('\nScreenshots');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const prep = async (fn, arg) => {
      await page.evaluate(fn, arg);
      await frames(page, 2);
    };
    const resetState = () => {
      const s = window.__teardown.store.getState();
      s.restoreAll();
      s.select(null);
      s.setMode('product');
      if (s.treeOpen === false) s.toggle('treeOpen');
      if (s.inspectorOpen === false) s.toggle('inspectorOpen');
    };
    const view = async (t, preset = 'home') => {
      await setSlider(page, t);
      await page.evaluate((p) => window.__teardown.cameraController.setView(p, window.__teardown.store.getState().explosion, 0.05), preset);
      await settle(page, 300);
    };
    await prep(resetState);
    await view(0);
    await shot(page, '01-assembled-product.png');
    await view(0.45);
    await shot(page, '02-partial-explosion.png');
    await view(1);
    await shot(page, '03-exploded-product.png');
    await page.click('[data-testid="mode-engineering"]');
    await shot(page, '04-exploded-engineering.png');
    await page.click('[data-testid="toggle-wireframe"]');
    await shot(page, '07-engineering-wireframe.png');
    await page.click('[data-testid="toggle-wireframe"]');
    await page.click('[data-testid="mode-product"]');
    await prep(() => window.__teardown.store.getState().select('vapor-chamber'));
    await shot(page, '05-selected-component.png');
    await prep(() => {
      const s = window.__teardown.store.getState();
      s.select(null);
      s.isolate(window.__teardown.model.tree.descendantComponents('logic'));
    });
    await page.evaluate(() => {
      const T = window.__teardown;
      const box = T.worldBox('logic-board').union(T.worldBox('shield-processor'));
      T.cameraController.focusBox(box);
    });
    await shot(page, '06-isolated-logic-board.png');
    await prep(resetState);
    await view(0, 'front');
    await shot(page, '08-front-view.png');

    /* ---------------- mobile / touch ---------------- */
    console.log('\nMobile viewport');
    await page.close();
    const mobile = await browser.newPage();
    wire(mobile);
    await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await mobile.goto(URL, { waitUntil: 'networkidle0', timeout: 180000 });
    await ready(mobile);
    const mFrame = await mobile.evaluate(inPage.project, 'unibody-frame');
    check('phone fits a portrait mobile viewport', mFrame.inside);
    if (!SCREENSHOTS_ONLY) {
      const m0 = await mobile.evaluate(inPage.camera);
      const t1 = await mobile.touchscreen.touchStart(200, 300);
      for (let i = 1; i <= 8; i++) await t1.move(200 + i * 12, 300 + i * 3);
      await t1.end();
      await settle(mobile);
      const m1 = await mobile.evaluate(inPage.camera);
      const mMoved = Math.hypot(m1.position[0] - m0.position[0], m1.position[1] - m0.position[1], m1.position[2] - m0.position[2]);
      check('one-finger touch drag rotates', mMoved > 20 && Math.abs(m1.distance - m0.distance) < 0.5, `camera moved ${mMoved.toFixed(0)} mm`);
      const a = await mobile.touchscreen.touchStart(150, 380);
      const b = await mobile.touchscreen.touchStart(240, 380);
      for (let i = 1; i <= 8; i++) {
        await a.move(150 - i * 8, 380);
        await b.move(240 + i * 8, 380);
      }
      await a.end();
      await b.end();
      await settle(mobile);
      const m2 = await mobile.evaluate(inPage.camera);
      check('two-finger pinch zooms', m2.distance < m1.distance - 5, `${m1.distance.toFixed(0)} → ${m2.distance.toFixed(0)} mm`);
      await mobile.evaluate(() => window.__teardown.cameraController.setView('home', 0, 0.05));
      await settle(mobile, 300);
      const tap = await mobile.evaluate(inPage.project, 'rear-glass');
      await mobile.touchscreen.tap(tap.x, tap.y);
      await frames(mobile);
      const mSel = await mobile.evaluate(inPage.state);
      const chip = await mobile.$('[data-testid="selection-chip"]');
      check('tap selects a component on touch devices', mSel.selectedId === 'rear-glass' && !!chip, `selected: ${mSel.selectedId}`);
    }
    await setSlider(mobile, 0.8);
    await mobile.evaluate(() => window.__teardown.cameraController.setView('home', 0.8, 0.05));
    await shot(mobile, '09-mobile-exploded.png');

    /* ---------------- hygiene ---------------- */
    console.log('\nHygiene');
    check('no external network requests (no downloaded 3D assets, fonts or HDRIs)', externalRequests.length === 0, externalRequests.slice(0, 3).join(' '));
    check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' '));
    check('no browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    if (consoleWarnings.length) console.log(`  note  ${consoleWarnings.length} console warning(s): ${[...new Set(consoleWarnings)].slice(0, 4).join(' | ')}`);
    void total;
    void idle;
  } finally {
    await browser.close();
    server.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
