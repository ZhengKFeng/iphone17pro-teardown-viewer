import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer, OrbitControls } from '@react-three/drei';
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { cameraController, type OrbitLike } from '../core/CameraController';
import { PHONE, registry } from '../data';
import { useStore } from '../state/store';
import { ComponentObject } from './ComponentObject';
import { sceneRefs } from './actions';

const FLOOR_Y = -PHONE.height / 2 - 14;
const HOME: [number, number, number] = (() => {
  const v = new THREE.Vector3(0.62, 0.3, 0.72).normalize().multiplyScalar(cameraController.homeDistance);
  return [v.x, v.y, v.z];
})();

function PhoneAssembly() {
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    sceneRefs.root = root.current;
    return () => {
      sceneRefs.root = null;
    };
  }, []);
  return (
    <group ref={root} name="iPhone17Pro-procedural">
      {registry.all().map((def) => (
        <ComponentObject key={def.id} def={def} />
      ))}
    </group>
  );
}

/** Connects OrbitControls + camera to the CameraController. */
function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  useEffect(() => {
    sceneRefs.canvas = gl.domElement;
  }, [gl]);

  useEffect(() => {
    if (!controls) return;
    const t = useStore.getState().explosion;
    cameraController.attach(camera, controls, t);
    // Initial framing: portrait screens need more distance than the default camera.
    cameraController.setView('home', t, 0.01);
    return () => cameraController.detach();
  }, [camera, controls]);

  // Shift the picture up a little so the phone is centred in the area above the control bar.
  useLayoutEffect(() => {
    const lift = Math.round(Math.min(56, size.height * 0.06));
    camera.setViewOffset(size.width, size.height, 0, lift, size.width, size.height);
    return () => camera.clearViewOffset();
  }, [camera, size.width, size.height]);

  useFrame(() => {
    const s = useStore.getState();
    cameraController.syncExplosion(s.explosion, s.autoFrame);
  });
  return null;
}

function StudioLighting({ engineering }: { engineering: boolean }) {
  return (
    <>
      <ambientLight intensity={engineering ? 0.9 : 0.45} />
      <directionalLight
        castShadow
        position={[140, 260, 190]}
        intensity={engineering ? 1.5 : 1.9}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.45}
        shadow-camera-left={-190}
        shadow-camera-right={190}
        shadow-camera-top={190}
        shadow-camera-bottom={-190}
        shadow-camera-near={50}
        shadow-camera-far={800}
      />
      <directionalLight position={[-200, 60, -160]} intensity={engineering ? 0.6 : 0.45} color={engineering ? '#ffffff' : '#bcd4ff'} />
      {/* Procedural studio environment: soft boxes only, no downloaded HDRI. */}
      <Environment resolution={256} frames={1} environmentIntensity={engineering ? 1 : 1.35}>
        <color attach="background" args={[engineering ? '#55585d' : '#3c3d41']} />
        <Lightformer form="rect" intensity={engineering ? 1.2 : 3.4} position={[0, 420, 120]} target={[0, 0, 0]} scale={[620, 320, 1]} />
        <Lightformer form="rect" intensity={engineering ? 0.8 : 2.4} position={[460, 90, 260]} target={[0, 0, 0]} scale={[260, 460, 1]} />
        <Lightformer form="rect" intensity={engineering ? 0.6 : 1.3} position={[-460, 40, 180]} target={[0, 0, 0]} scale={[220, 420, 1]} color="#fff0e2" />
        <Lightformer form="rect" intensity={engineering ? 0.6 : 1.7} position={[-60, 120, -480]} target={[0, 0, 0]} scale={[520, 300, 1]} color="#cfe0ff" />
        <Lightformer form="ring" intensity={engineering ? 0.3 : 1.1} position={[160, -260, 320]} target={[0, 0, 0]} scale={160} />
      </Environment>
    </>
  );
}

function Floor({ engineering }: { engineering: boolean }) {
  return (
    <group position={[0, FLOOR_Y, 0]} userData={{ helper: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[1600, 1600]} />
        <shadowMaterial transparent opacity={engineering ? 0.22 : 0.42} />
      </mesh>
      {engineering && <gridHelper args={[480, 48, '#4a525c', '#2c3138']} position={[0, 0.05, 0]} raycast={() => null} />}
    </group>
  );
}

/** World coordinate triad (engineering mode). X red, Y green, Z blue. */
function AxisTriad() {
  const L = 34;
  const axes: { dir: [number, number, number]; rot: [number, number, number]; color: string; label: string }[] = [
    { dir: [1, 0, 0], rot: [0, 0, -Math.PI / 2], color: '#ff5d5d', label: 'X' },
    { dir: [0, 1, 0], rot: [0, 0, 0], color: '#5ddc7a', label: 'Y' },
    { dir: [0, 0, 1], rot: [Math.PI / 2, 0, 0], color: '#5aa2ff', label: 'Z (rear)' },
  ];
  return (
    <group position={[-PHONE.width / 2 - 34, FLOOR_Y + 0.5, 0]} userData={{ helper: true }}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[1.5, 16, 12]} />
        <meshBasicMaterial color="#e6e9ee" />
      </mesh>
      {axes.map((a) => (
        <group key={a.label}>
          <group rotation={a.rot}>
            <mesh position={[0, L / 2, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.55, 0.55, L, 10]} />
              <meshBasicMaterial color={a.color} />
            </mesh>
            <mesh position={[0, L + 3, 0]} raycast={() => null}>
              <coneGeometry args={[1.8, 6, 14]} />
              <meshBasicMaterial color={a.color} />
            </mesh>
          </group>
          <Html position={[a.dir[0] * (L + 12), a.dir[1] * (L + 12), a.dir[2] * (L + 12)]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <span className="axis-label" style={{ color: a.color }}>
              {a.label}
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}

/**
 * Scene clear colour. With the post-processing chain the background passes
 * through ACES tone mapping (which darkens it); without it the clear colour is
 * shown as-is. Values are chosen so both paths land on the same charcoal.
 */
function background(engineering: boolean, ao: boolean): string {
  if (engineering) return ao ? '#353a41' : '#24282d';
  return ao ? '#2b2d31' : '#1d1f23';
}

function Scene() {
  const mode = useStore((s) => s.mode);
  const axes = useStore((s) => s.axes);
  const ao = useStore((s) => s.ambientOcclusion);
  const engineering = mode === 'engineering';
  return (
    <>
      <color attach="background" args={[background(engineering, ao)]} />
      <StudioLighting engineering={engineering} />
      <PhoneAssembly />
      <Floor engineering={engineering} />
      {engineering && axes && <AxisTriad />}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.9}
        zoomSpeed={0.9}
        panSpeed={0.9}
        minDistance={25}
        maxDistance={1500}
        // defaults: left-drag rotate, wheel zoom, right-drag pan; touch: 1 finger rotate, 2 fingers zoom + pan
      />
      <CameraRig />
      {ao && (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <N8AO aoRadius={7} distanceFalloff={1} intensity={engineering ? 1.6 : 2.4} quality="medium" />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}

export function Viewer() {
  const hovered = useStore((s) => s.hoveredId !== null);
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      camera={{ fov: 32, near: 2, far: 6000, position: HOME }}
      onPointerMissed={(e) => {
        if (e.button === 0) useStore.getState().select(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Scene />
    </Canvas>
  );
}
