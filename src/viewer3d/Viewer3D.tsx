/**
 * Visor 3D (fase 3, ESPECIFICACION §5): se genera al vuelo desde el modelo.
 * Nada de estado geométrico propio (CLAUDE.md §1.5): si cambia el proyecto,
 * se reconstruye la escena.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { Poly } from '../geometry/footprint';
import type { Vec2 } from '../geometry/vec';
import { areaCm2 } from '../geometry/polygon';
import { centroid } from '../geometry/walls';
import { levelBounds } from '../geometry/walls';
import type { Item, Level } from '../model/project';
import { useUi } from '../store/hooks';
import { uiStore, type View3DMode } from '../store/uiStore';
import { t } from '../ui/i18n';
import { planRotationToY } from './coords';
import { wallsToFade } from './cutaway';
import { fixtureBoxes, openingBoxes, type SceneBox } from './fixtures3d';
import { itemParts, type Part } from './furniture';
import { floorTexture } from './materials';
import { sunPosition } from './sun';
import { BODY_RADIUS, EYE_HEIGHT, moveWithCollision, walkDelta } from './walk';
import { boxFootprint, wallBoxes } from './walls3d';

const WALL_COLOR = '#f1ede5';
const BG = '#e9e4da';

interface Props {
  level: Level;
  variantId: string;
  items: readonly Item[];
}

export function Viewer3D({ level, variantId, items }: Props) {
  const mode = useUi((s) => s.view3d.mode);
  const hour = useUi((s) => s.view3d.hour);
  const north = useUi((s) => s.view3d.north);
  const bounds = useMemo(() => levelBounds(level), [level]);
  const center: Vec2 = bounds
    ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
    : { x: 0, y: 0 };
  const size = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 200) : 600;
  const ui = uiStore.getState();
  const [locked, setLocked] = useState(false);
  // En primera persona se empieza en el centro de la estancia más grande.
  const start = useMemo(() => {
    const biggest = [...level.rooms].sort((a, b) => areaCm2(b.polygon) - areaCm2(a.polygon))[0];
    return biggest ? centroid(biggest.polygon) : center;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.rooms]);

  return (
    <div className="viewer3d">
      <div className="viewer3d__bar" role="toolbar" aria-label={t('v3d.title')}>
        {(['orbita', 'primera', 'planta'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? 'tool tool--on' : 'tool'}
            aria-pressed={mode === m}
            onClick={() => ui.setView3d({ mode: m })}
          >
            {t(`v3d.${m}`)}
          </button>
        ))}
        <span className="plan__sep" aria-hidden />
        <label className="viewer3d__range">
          {t('v3d.hour', { h: formatHour(hour) })}
          <input
            type="range"
            min={6}
            max={21}
            step={0.25}
            value={hour}
            onChange={(e) => ui.setView3d({ hour: Number(e.target.value) })}
          />
        </label>
        <label className="viewer3d__range">
          {t('v3d.north', { deg: north })}
          <input
            type="range"
            min={0}
            max={345}
            step={15}
            value={north}
            onChange={(e) => ui.setView3d({ north: Number(e.target.value) })}
          />
        </label>
        <span className="plan__hint">{t(`v3d.hint.${mode}`)}</span>
      </div>
      <div className="viewer3d__canvas">
        <Canvas
          key={mode}
          shadows={{ type: THREE.PCFShadowMap }}
          orthographic={mode === 'planta'}
          dpr={[1, 2]}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          camera={
            mode === 'planta'
              ? {
                  position: [center.x, 2000, center.y],
                  zoom: 1,
                  near: 1,
                  far: 10000,
                  up: [0, 0, -1],
                }
              : {
                  position: [center.x, size * 0.9, center.y + size * 1.1],
                  fov: 45,
                  near: 5,
                  far: 20000,
                }
          }
          onPointerMissed={() => mode !== 'primera' && ui.select(null)}
        >
          <color attach="background" args={[BG]} />
          <Scene
            level={level}
            variantId={variantId}
            items={items}
            center={center}
            size={size}
            mode={mode}
            hour={hour}
            north={north}
            start={start}
            onLock={setLocked}
          />
        </Canvas>
        {mode === 'primera' && !locked && (
          <div className="viewer3d__overlay">{t('v3d.clickToWalk')}</div>
        )}
      </div>
    </div>
  );
}

const formatHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}:${String(mm).padStart(2, '0')}`;
};

function Scene({
  level,
  variantId,
  items,
  center,
  size,
  mode,
  hour,
  north,
  start,
  onLock,
}: Props & {
  start: Vec2;
  center: Vec2;
  size: number;
  mode: View3DMode;
  hour: number;
  north: number;
  onLock(locked: boolean): void;
}) {
  const walls = useMemo(() => wallBoxes(level), [level]);
  const openings = useMemo(() => openingBoxes(level), [level]);
  const fixtures = useMemo(() => fixtureBoxes(level), [level]);
  const [faded, setFaded] = useState<Set<string>>(new Set());
  const sun = useMemo(() => sunPosition(hour, north), [hour, north]);
  const selection = useUi((s) => s.selection);
  const selectedId = selection?.kind === 'item' ? selection.id : null;
  const blockers = useMemo(
    () => walls.filter((w) => w.part !== 'dintel').map(boxFootprint),
    [walls],
  );

  const sunPos: [number, number, number] = [
    center.x + sun.dir[0] * size * 2,
    Math.max(50, sun.dir[1] * size * 2),
    center.y + sun.dir[2] * size * 2,
  ];
  const daylight = Math.max(0, Math.min(1, sun.elevation / 25));

  return (
    <>
      <hemisphereLight args={['#fdfbf6', '#b8ab95', 1.15 - 0.4 * (1 - daylight)]} />
      <ambientLight intensity={mode === 'primera' ? 0.55 : 0.3} />
      <directionalLight
        position={sunPos}
        intensity={2.2 * daylight}
        color="#fff3df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={2}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={10}
        shadow-camera-far={size * 6}
      >
        <object3D attach="target" position={[center.x, 0, center.y]} />
      </directionalLight>
      <SunTarget center={center} />

      {level.rooms.map((r) => (
        <Floor key={r.id} polygon={r.polygon} material={r.floorMaterial} />
      ))}
      {level.rooms.length === 0 && <GroundFallback center={center} size={size} />}

      {walls.map((w) => (
        <mesh
          key={w.key}
          position={w.center}
          rotation={[0, w.rotY, 0]}
          castShadow
          receiveShadow
          renderOrder={faded.has(w.wallId) ? 2 : 0}
        >
          <boxGeometry args={w.size} />
          <meshStandardMaterial
            // Material nuevo al cambiar: three no recompila al cambiar `transparent`.
            key={faded.has(w.wallId) ? 'fade' : 'solid'}
            color={WALL_COLOR}
            roughness={0.95}
            transparent={faded.has(w.wallId)}
            opacity={faded.has(w.wallId) ? 0.12 : 1}
            depthWrite={!faded.has(w.wallId)}
          />
        </mesh>
      ))}

      {[...openings, ...fixtures].map((b) => (
        <FixedBox key={b.key} b={b} />
      ))}

      {mode === 'primera' && <Ceiling level={level} />}

      {items.map((it) => (
        <ItemMesh
          key={it.id}
          item={it}
          selected={it.id === selectedId}
          onSelect={() => uiStore.getState().select({ kind: 'item', variantId, id: it.id })}
        />
      ))}

      {mode === 'orbita' && (
        <Orbit
          center={center}
          walls={level.walls}
          onFade={(s) => setFaded((prev) => (sameSet(prev, s) ? prev : s))}
        />
      )}
      {mode === 'planta' && <TopView center={center} size={size} />}
      {mode === 'primera' && <Walk start={start} obstacles={blockers} onLock={onLock} />}
    </>
  );
}

const sameSet = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

function SunTarget({ center }: { center: Vec2 }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight) {
        o.target.position.set(center.x, 0, center.y);
        o.target.updateMatrixWorld();
      }
    });
  }, [scene, center.x, center.y]);
  return null;
}

function Floor({ polygon, material }: { polygon: readonly Vec2[]; material: string | undefined }) {
  const geom = useMemo(() => {
    const shape = new THREE.Shape(polygon.map((p) => new THREE.Vector2(p.x, -p.y)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [polygon]);
  const tex = useMemo(() => {
    const ft = floorTexture(material);
    if (!ft) return null;
    const map = ft.map.clone();
    map.needsUpdate = true;
    // UV de ShapeGeometry = coordenadas en cm: repetir cada `repeatCm`.
    map.repeat.set(1 / ft.repeatCm, 1 / ft.repeatCm);
    return map;
  }, [material]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom} receiveShadow position={[0, 0.1, 0]}>
      <meshStandardMaterial map={tex} color={tex ? '#ffffff' : '#d8c4a4'} roughness={0.8} />
    </mesh>
  );
}

function GroundFallback({ center, size }: { center: Vec2; size: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.y]} receiveShadow>
      <planeGeometry args={[size * 1.5, size * 1.5]} />
      <meshStandardMaterial color="#d8c4a4" />
    </mesh>
  );
}

function Ceiling({ level }: { level: Level }) {
  return (
    <>
      {level.rooms.map((r) => {
        const shape = new THREE.Shape(r.polygon.map((p) => new THREE.Vector2(p.x, -p.y)));
        return (
          <mesh key={r.id} rotation={[-Math.PI / 2, 0, 0]} position={[0, level.ceilingHeight, 0]}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color="#fbfaf7" side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </>
  );
}

function FixedBox({ b }: { b: SceneBox }) {
  const glass = b.kind === 'cristal';
  return (
    <mesh position={b.center} rotation={[0, b.rotY, 0]} castShadow={!glass} receiveShadow>
      <boxGeometry args={b.size} />
      <meshStandardMaterial
        color={b.color}
        transparent={glass}
        opacity={glass ? 0.35 : 1}
        roughness={glass || b.kind === 'espejo' ? 0.05 : 0.7}
        metalness={b.kind === 'espejo' ? 0.8 : 0}
        emissive={b.kind === 'luz' ? '#fff1c9' : '#000000'}
        emissiveIntensity={b.kind === 'luz' ? 0.8 : 0}
      />
    </mesh>
  );
}

function PartMesh({ p, selected }: { p: Part; selected: boolean }) {
  const geometry = (() => {
    switch (p.shape) {
      case 'box':
        return <boxGeometry args={p.size} />;
      case 'cylinder':
        return <cylinderGeometry args={[p.size[0], p.size[2], p.size[1], 28]} />;
      case 'cone':
        return <coneGeometry args={[p.size[0], p.size[1], 28]} />;
      case 'sphere':
        return <sphereGeometry args={[p.size[0], 20, 14]} />;
    }
  })();
  return (
    <mesh position={p.pos} castShadow={!p.ghost} receiveShadow>
      {geometry}
      <meshStandardMaterial
        color={p.color}
        roughness={p.glossy ? 0.25 : 0.85}
        transparent={p.ghost}
        opacity={p.ghost ? 0.35 : 1}
        depthWrite={!p.ghost}
        emissive={selected ? '#c4623d' : p.emissive ? p.color : '#000000'}
        emissiveIntensity={selected ? 0.25 : p.emissive ? 0.35 : 0}
      />
    </mesh>
  );
}

function ItemMesh({
  item,
  selected,
  onSelect,
}: {
  item: Item;
  selected: boolean;
  onSelect(): void;
}) {
  const parts = useMemo(() => itemParts(item), [item]);
  return (
    <group
      position={[item.x, item.z ?? 0, item.y]}
      rotation={[0, planRotationToY(item.rotation), 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {parts.map((p, i) => (
        <PartMesh key={i} p={p} selected={selected} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cámaras
// ---------------------------------------------------------------------------

function Orbit({
  center,
  walls,
  onFade,
}: {
  center: Vec2;
  walls: Level['walls'];
  onFade(s: Set<string>): void;
}) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.target.set(center.x, 60, center.y);
    c.enableDamping = true;
    c.maxPolarAngle = Math.PI / 2 - 0.05;
    c.minDistance = 80;
    c.maxDistance = 6000;
    const update = () => {
      const cam = { x: camera.position.x, y: camera.position.z };
      onFade(wallsToFade(walls, cam, { x: c.target.x, y: c.target.z }, 60));
    };
    c.addEventListener('change', update);
    c.update();
    update();
    const tick = () => {
      c.update();
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener('change', update);
      c.dispose();
    };
    // Solo al montar o cambiar de casa: no reiniciar la cámara en cada edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, center.x, center.y]);
  return null;
}

function TopView({ center, size }: { center: Vec2; size: number }) {
  const { camera, gl, size: viewport } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.position.set(center.x, 2000, center.y);
    cam.up.set(0, 0, -1);
    cam.lookAt(center.x, 0, center.y);
    cam.zoom = Math.min(viewport.width, viewport.height) / (size * 1.15);
    cam.updateProjectionMatrix();
    const c = new OrbitControls(cam, gl.domElement);
    c.target.set(center.x, 0, center.y);
    c.enableRotate = false;
    c.screenSpacePanning = true;
    c.update();
    return () => c.dispose();
  }, [camera, gl, center.x, center.y, size, viewport.width, viewport.height]);
  return null;
}

const KEYS: Record<string, [number, number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};

function Walk({
  start,
  obstacles,
  onLock,
}: {
  start: Vec2;
  obstacles: readonly Poly[];
  onLock(l: boolean): void;
}) {
  const { camera, gl } = useThree();
  const pressed = useRef(new Set<string>());
  const pos = useRef<Vec2>(start);
  const controls = useRef<PointerLockControls | null>(null);

  useEffect(() => {
    camera.position.set(start.x, EYE_HEIGHT, start.y);
    camera.rotation.set(0, 0, 0);
    pos.current = start;
    const c = new PointerLockControls(camera, gl.domElement);
    controls.current = c;
    const lock = () => c.lock();
    const onL = () => onLock(true);
    const onU = () => onLock(false);
    gl.domElement.addEventListener('click', lock);
    c.addEventListener('lock', onL);
    c.addEventListener('unlock', onU);
    const down = (e: KeyboardEvent) => {
      if (KEYS[e.code]) {
        pressed.current.add(e.code);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => pressed.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      gl.domElement.removeEventListener('click', lock);
      c.removeEventListener('lock', onL);
      c.removeEventListener('unlock', onU);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      c.dispose();
      onLock(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);

  useFrame((_, dt) => {
    let forward = 0;
    let right = 0;
    for (const k of pressed.current) {
      const [f, r] = KEYS[k] ?? [0, 0];
      forward += f;
      right += r;
    }
    if (forward === 0 && right === 0) return;
    const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
    const step = walkDelta(yaw, { forward, right }, Math.min(dt, 0.1) * 160);
    pos.current = moveWithCollision(pos.current, step, obstacles, BODY_RADIUS);
    camera.position.set(pos.current.x, EYE_HEIGHT, pos.current.y);
  });
  return null;
}
