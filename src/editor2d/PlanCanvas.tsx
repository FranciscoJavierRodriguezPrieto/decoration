/**
 * Lienzo del plano (Konva). Solo dibuja y traduce gestos en acciones de la store:
 * toda la geometría sale de src/geometry y todos los cambios pasan por projectStore
 * (un paso de deshacer por gesto).
 */
import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text } from 'react-konva';
import { snapPoint, pointAtLength } from '../geometry/snap';
import { add, dist, roundHalf, scale, sub, type Vec2 } from '../geometry/vec';
import {
  centroid,
  doorSwing,
  interiorSide,
  levelBounds,
  levelVertices,
  moveVertex,
  openingQuad,
  openingSegment,
  wallLength,
  wallQuad,
} from '../geometry/walls';
import type { Item, Level, Opening, Wall } from '../model/project';
import { projectStore } from '../store/projectStore';
import { uiStore } from '../store/uiStore';
import { useUi } from '../store/hooks';
import { formatNumber } from '../ui/i18n';
import { FONT, PLAN } from './theme';
import { fitView, zoomAt, type View } from './viewport';

const flat = (pts: readonly Vec2[]): number[] => pts.flatMap((p) => [p.x, p.y]);

interface Props {
  level: Level;
  variantId: string;
  items: Item[];
  /** Ids de muebles que la variante hereda de la base. */
  inherited: ReadonlySet<string>;
  /** Cambia cuando hay que reencajar la vista (otro nivel u otro proyecto). */
  fitKey: string;
}

interface Preview {
  from: Vec2;
  to: Vec2;
}

interface WallDraft {
  start: Vec2 | null;
  cursor: Vec2 | null;
  typed: string;
}

export function PlanCanvas({ level, variantId, items, inherited, fitKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<WallDraft>({ start: null, cursor: null, typed: '' });
  const tool = useUi((s) => s.tool);
  const selection = useUi((s) => s.selection);
  const grid = useUi((s) => s.grid);

  // Nivel que se dibuja: el real o, mientras se arrastra una esquina, la vista previa.
  const shown = useMemo(
    () => (preview ? moveVertex(level, preview.from, preview.to) : level),
    [level, preview],
  );
  const vertices = useMemo(() => levelVertices(level), [level]);
  const roomCenter = useMemo(
    () => centroid(level.rooms.flatMap((r) => r.polygon).concat(vertices)),
    [level, vertices],
  );

  // Tamaño del lienzo = tamaño del contenedor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    setView(fitView(levelBounds(level), size.width, size.height));
    // `level` se lee en el momento de encajar; no queremos reencajar en cada edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, fitKey]);

  useEffect(() => {
    if (size.width > 0) fit();
  }, [fit, size.width]);

  // Reencaje bajo demanda desde la barra de herramientas.
  useEffect(() => {
    const onFit = () => fit();
    window.addEventListener('planocasa:fit', onFit);
    return () => window.removeEventListener('planocasa:fit', onFit);
  }, [fit]);

  // Al cambiar de herramienta se cancela el muro en curso.
  useEffect(() => {
    setDraft({ start: null, cursor: null, typed: '' });
  }, [tool, level.id]);

  /** Puntero en coordenadas del plano (cm). */
  const pointer = (): Vec2 | null => stageRef.current?.getRelativePointerPosition() ?? null;
  const snapRadius = 10 / view.scale;

  // ---- Herramienta muro ---------------------------------------------------
  const commitWall = useCallback(
    (a: Vec2, b: Vec2) => {
      if (dist(a, b) < 1) return a;
      try {
        projectStore.getState().addWall(level.id, a, b);
      } catch {
        return a;
      }
      return b;
    },
    [level.id],
  );

  useEffect(() => {
    if (tool !== 'wall') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') {
        setDraft({ start: null, cursor: null, typed: '' });
        return;
      }
      if (/^[0-9.,]$/.test(e.key)) {
        setDraft((d) => (d.start ? { ...d, typed: d.typed + e.key.replace(',', '.') } : d));
        return;
      }
      if (e.key === 'Backspace') {
        setDraft((d) => ({ ...d, typed: d.typed.slice(0, -1) }));
        return;
      }
      if (e.key === 'Enter') {
        setDraft((d) => {
          const len = Number(d.typed);
          if (!d.start || !(len > 0)) return { ...d, typed: '' };
          const towards = d.cursor ?? add(d.start, { x: 1, y: 0 });
          const end = pointAtLength(d.start, towards, roundHalf(len));
          const next = commitWall(d.start, end);
          return { start: next, cursor: next, typed: '' };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, commitWall]);

  // ---- Eventos del lienzo -------------------------------------------------
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!p) return;
    setView((v) => zoomAt(v, p, e.evt.deltaY > 0 ? 1 / 1.12 : 1.12));
  };

  const onMouseMove = () => {
    if (tool !== 'wall') return;
    const p = pointer();
    if (!p) return;
    setDraft((d) => ({
      ...d,
      cursor: snapPoint(p, {
        grid,
        vertices,
        vertexRadius: snapRadius,
        ...(d.start ? { anchor: d.start } : {}),
      }),
    }));
  };

  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === 'wall') {
      if (e.evt.button === 2) {
        setDraft({ start: null, cursor: null, typed: '' });
        return;
      }
      const p = pointer();
      if (!p) return;
      const at = snapPoint(p, {
        grid,
        vertices,
        vertexRadius: snapRadius,
        ...(draft.start ? { anchor: draft.start } : {}),
      });
      if (!draft.start) {
        setDraft({ start: at, cursor: at, typed: '' });
      } else {
        const next = commitWall(draft.start, at);
        setDraft({ start: next, cursor: next, typed: '' });
      }
      return;
    }
    // Clic en vacío: deseleccionar.
    if (e.target === e.target.getStage()) uiStore.getState().select(null);
  };

  const onStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target !== e.target.getStage()) return;
    setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
  };

  // ---- Arrastres ----------------------------------------------------------
  const selectedWall =
    selection?.kind === 'wall' ? shown.walls.find((w) => w.id === selection.id) : undefined;

  const dragVertex = (from: Vec2, other: Vec2) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const raw = { x: e.target.x(), y: e.target.y() };
    const to = snapPoint(raw, {
      grid,
      vertices: vertices.filter((v) => dist(v, from) > 0.5),
      vertexRadius: snapRadius,
      anchor: other,
    });
    e.target.position(to);
    setPreview({ from, to });
  };

  const dropVertex = (from: Vec2) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const to = { x: e.target.x(), y: e.target.y() };
    setPreview(null);
    if (dist(from, to) >= 0.5) {
      try {
        projectStore.getState().moveVertex(level.id, from, to);
      } catch {
        /* sin cambios */
      }
    }
    e.target.position(from);
  };

  const dropItem = (item: Item) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const step = Math.max(1, Math.min(grid, 5));
    const x = roundHalf(Math.round(e.target.x() / step) * step);
    const y = roundHalf(Math.round(e.target.y() / step) * step);
    if (x !== item.x || y !== item.y) {
      try {
        projectStore.getState().editItemInVariant(variantId, item.id, { x, y });
      } catch {
        /* sin cambios */
      }
    }
    e.target.position({ x: item.x, y: item.y });
  };

  const px = (n: number) => n / view.scale; // n píxeles de pantalla en cm
  const selectable = tool === 'select';

  return (
    <div
      ref={containerRef}
      className={`plan-canvas plan-canvas--${tool}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable={selectable}
          onDragEnd={onStageDragEnd}
          onWheel={onWheel}
          onMouseMove={onMouseMove}
          onClick={onStageClick}
        >
          <Layer listening={false}>
            <GridLines view={view} width={size.width} height={size.height} />
          </Layer>

          {/* Estancias y zonas */}
          <Layer listening={false}>
            {shown.rooms.map((r) => {
              const c = centroid(r.polygon);
              return (
                <Group key={r.id}>
                  <Line points={flat(r.polygon)} closed fill={PLAN.room} />
                  <Text
                    x={c.x}
                    y={c.y}
                    text={r.name}
                    fontFamily={FONT}
                    fontSize={px(12)}
                    fill={PLAN.roomText}
                    align="center"
                    offsetX={px(60)}
                    width={px(120)}
                  />
                </Group>
              );
            })}
            {shown.zones.map((z) => (
              <Group key={z.id}>
                <Rect
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.d}
                  stroke={PLAN.zone}
                  strokeWidth={px(1)}
                  dash={[px(6), px(4)]}
                />
                <Text
                  x={z.x + px(4)}
                  y={z.y + z.d - px(16)}
                  text={z.label}
                  fontFamily={FONT}
                  fontSize={px(11)}
                  fill={PLAN.zone}
                />
              </Group>
            ))}
          </Layer>

          {/* Muebles (debajo de los muros para que el canto del muro quede limpio) */}
          <Layer>
            {[...items]
              .sort((a, b) => (a.category === 'alfombra' ? -1 : b.category === 'alfombra' ? 1 : 0))
              .map((it) => (
                <ItemShape
                  key={it.id}
                  item={it}
                  inherited={inherited.has(it.id)}
                  selected={selection?.kind === 'item' && selection.id === it.id}
                  draggable={selectable}
                  px={px}
                  onSelect={() =>
                    selectable && uiStore.getState().select({ kind: 'item', variantId, id: it.id })
                  }
                  onDragEnd={dropItem(it)}
                />
              ))}
          </Layer>

          {/* Muros, huecos y fijos */}
          <Layer>
            {shown.walls.map((w) => (
              <Line
                key={w.id}
                points={flat(wallQuad(w, shown.walls))}
                closed
                fill={selectedWall?.id === w.id ? PLAN.wallSelected : PLAN.wall[w.kind]}
                onClick={(e) => {
                  if (!selectable) return;
                  e.cancelBubble = true;
                  uiStore.getState().select({ kind: 'wall', levelId: level.id, id: w.id });
                }}
                onMouseEnter={(e) => selectable && setCursor(e, 'pointer')}
                onMouseLeave={(e) => setCursor(e, '')}
              />
            ))}
            {shown.openings.map((o) => {
              const w = shown.walls.find((x) => x.id === o.wallId);
              return w ? (
                <OpeningShape
                  key={o.id}
                  wall={w}
                  opening={o}
                  side={interiorSide(w, roomCenter)}
                  px={px}
                />
              ) : null;
            })}
            {shown.fixtures.map((f) => (
              <Rect
                key={f.id}
                x={f.x - f.w / 2}
                y={f.y - f.d / 2}
                width={f.w}
                height={f.d}
                fill={PLAN.fixture[f.kind]}
                opacity={0.85}
                listening={false}
              />
            ))}
          </Layer>

          {/* Cotas, asas y borrador */}
          <Layer>
            {shown.walls.map((w) => (
              <WallDimension
                key={w.id}
                wall={w}
                side={-interiorSide(w, roomCenter) as 1 | -1}
                px={px}
                strong={selectedWall?.id === w.id}
              />
            ))}
            {selectable &&
              selectedWall &&
              [
                [selectedWall.a, selectedWall.b],
                [selectedWall.b, selectedWall.a],
              ].map(([p, other], i) =>
                p && other ? (
                  <Circle
                    key={`${i}-${p.x}-${p.y}`}
                    x={p.x}
                    y={p.y}
                    radius={px(7)}
                    fill={PLAN.handle}
                    stroke={PLAN.selected}
                    strokeWidth={px(2)}
                    draggable
                    onDragMove={dragVertex(p, other)}
                    onDragEnd={dropVertex(p)}
                    onMouseEnter={(e) => setCursor(e, 'move')}
                    onMouseLeave={(e) => setCursor(e, '')}
                  />
                ) : null,
              )}
            {tool === 'wall' && <WallDraftShape draft={draft} px={px} />}
          </Layer>
        </Stage>
      )}
      {tool === 'wall' && draft.start && (
        <div className="plan-canvas__hint" role="status">
          {draft.typed ? `${draft.typed} cm ↵` : null}
        </div>
      )}
    </div>
  );
}

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const c = e.target.getStage()?.container();
  if (c) c.style.cursor = cursor;
}

// ---------------------------------------------------------------------------

function GridLines({ view, width, height }: { view: View; width: number; height: number }) {
  // Rejilla de 1 m (y de 10 cm si hay zoom suficiente), solo en la zona visible.
  const step = view.scale > 2 ? 10 : 100;
  const x0 = Math.floor(-view.x / view.scale / step) * step;
  const y0 = Math.floor(-view.y / view.scale / step) * step;
  const x1 = (width - view.x) / view.scale;
  const y1 = (height - view.y) / view.scale;
  const lines: number[][] = [];
  for (let x = x0; x <= x1; x += step) lines.push([x, y0, x, y1]);
  for (let y = y0; y <= y1; y += step) lines.push([x0, y, x1, y]);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} stroke={PLAN.grid} strokeWidth={1 / view.scale} />
      ))}
    </>
  );
}

function OpeningShape({
  wall,
  opening,
  side,
  px,
}: {
  wall: Wall;
  opening: Opening;
  side: 1 | -1;
  px: (n: number) => number;
}) {
  const quad = openingQuad(wall, opening);
  const [p0, p1] = openingSegment(wall, opening);
  const isWindow = opening.kind === 'ventana';
  const swing = isWindow || opening.kind === 'hueco' ? null : doorSwing(wall, opening, side);
  const half = scale(sub(quad[0] ?? p0, p0), 0.45);
  return (
    <Group listening={false}>
      <Line points={flat(quad)} closed fill={PLAN.opening} />
      {isWindow && (
        <>
          <Line
            points={flat([add(p0, half), add(p1, half)])}
            stroke={PLAN.window}
            strokeWidth={px(1.5)}
          />
          <Line
            points={flat([sub(p0, half), sub(p1, half)])}
            stroke={PLAN.window}
            strokeWidth={px(1.5)}
          />
          <Line points={flat([p0, p1])} stroke={PLAN.window} strokeWidth={px(1)} />
        </>
      )}
      {swing && (
        <>
          <Line
            points={flat([swing.hinge, swing.leafEnd])}
            stroke={PLAN.door}
            strokeWidth={px(1.5)}
          />
          <Shape
            stroke={PLAN.door}
            strokeWidth={px(1)}
            dash={[px(4), px(3)]}
            sceneFunc={(ctx, shape) => {
              const r = (d: number) => (d * Math.PI) / 180;
              ctx.beginPath();
              ctx.arc(
                swing.hinge.x,
                swing.hinge.y,
                swing.radius,
                r(swing.startDeg),
                r(swing.startDeg + swing.sweepDeg),
              );
              ctx.strokeShape(shape);
            }}
          />
        </>
      )}
    </Group>
  );
}

function WallDimension({
  wall,
  side,
  px,
  strong,
}: {
  wall: Wall;
  side: 1 | -1;
  px: (n: number) => number;
  strong: boolean;
}) {
  const len = wallLength(wall);
  if (len < 20 && !strong) return null;
  const d = sub(wall.b, wall.a);
  let ang = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang <= -90) ang += 180;
  const mid = scale(add(wall.a, wall.b), 0.5);
  const n = { x: (d.y / len) * side, y: (-d.x / len) * side };
  const off = wall.thickness / 2 + px(14);
  const p = add(mid, scale(n, off));
  const label = `${formatNumber(len, 1)}`;
  const w = px(80);
  return (
    <Text
      x={p.x}
      y={p.y}
      rotation={ang}
      offsetX={w / 2}
      offsetY={px(7)}
      width={w}
      align="center"
      text={label}
      fontFamily={FONT}
      fontSize={px(strong ? 13 : 11)}
      fontStyle={strong ? 'bold' : 'normal'}
      fill={strong ? PLAN.selected : PLAN.dimension}
      listening={false}
    />
  );
}

function ItemShape({
  item,
  inherited,
  selected,
  draggable,
  px,
  onSelect,
  onDragEnd,
}: {
  item: Item;
  inherited: boolean;
  selected: boolean;
  draggable: boolean;
  px: (n: number) => number;
  onSelect(): void;
  onDragEnd(e: Konva.KonvaEventObject<DragEvent>): void;
}) {
  const { w, d } = item;
  const color = item.color ?? '#d9d1c1';
  const isRug = item.category === 'alfombra';
  const band = Math.min(14, d * 0.22);
  const ext = item.extended && 'w' in item.extended ? item.extended : null;
  const stroke = selected ? PLAN.selected : PLAN.itemStroke;
  return (
    <Group
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable={draggable}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onMouseEnter={(e) => draggable && setCursor(e, 'grab')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      {ext && (
        <Rect
          x={-ext.w / 2}
          y={-d / 2}
          width={ext.w}
          height={ext.d}
          stroke={stroke}
          strokeWidth={px(1)}
          dash={[px(5), px(4)]}
          fill={color}
          opacity={0.25}
        />
      )}
      <Rect
        x={-w / 2}
        y={-d / 2}
        width={w}
        height={d}
        fill={color}
        opacity={isRug ? 0.55 : 0.92}
        stroke={stroke}
        strokeWidth={px(selected ? 2.5 : 1)}
        dash={inherited ? [px(3), px(2)] : undefined}
        cornerRadius={isRug ? 0 : Math.min(4, w / 10)}
      />
      {!isRug && item.category !== 'arbol' && (
        // Respaldo / trasera: banda oscura en el lado −Y local (CLAUDE.md §4).
        <Rect
          x={-w / 2}
          y={-d / 2}
          width={w}
          height={band}
          fill="#000"
          opacity={0.18}
          listening={false}
        />
      )}
      <Text
        // Texto siempre legible: si el mueble está girado más de 90°, se voltea.
        x={0}
        y={0}
        offsetX={w / 2}
        offsetY={Math.min(px(11), d / 3) / 2}
        rotation={item.rotation > 90 && item.rotation <= 270 ? 180 : 0}
        width={w}
        align="center"
        text={item.name}
        fontFamily={FONT}
        fontSize={Math.min(px(11), d / 3)}
        fill={PLAN.itemText}
        listening={false}
        ellipsis
        wrap="none"
      />
    </Group>
  );
}

function WallDraftShape({ draft, px }: { draft: WallDraft; px: (n: number) => number }) {
  if (!draft.cursor) return null;
  const c = draft.cursor;
  if (!draft.start) {
    return <Circle x={c.x} y={c.y} radius={px(4)} fill={PLAN.draft} listening={false} />;
  }
  const len = dist(draft.start, c);
  const mid = scale(add(draft.start, c), 0.5);
  return (
    <Group listening={false}>
      <Line
        points={flat([draft.start, c])}
        stroke={PLAN.draft}
        strokeWidth={10}
        opacity={0.5}
        lineCap="butt"
      />
      <Circle x={draft.start.x} y={draft.start.y} radius={px(4)} fill={PLAN.draft} />
      <Circle x={c.x} y={c.y} radius={px(4)} fill={PLAN.draft} />
      <Text
        x={mid.x + px(8)}
        y={mid.y + px(8)}
        text={`${formatNumber(len, 1)} cm`}
        fontFamily={FONT}
        fontSize={px(13)}
        fontStyle="bold"
        fill={PLAN.draft}
      />
    </Group>
  );
}
