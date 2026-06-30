import type { Tile } from "./types";

export interface HexPoint {
  x: number;
  y: number;
}

export interface HexLayout {
  size: number;
  originX: number;
  originY: number;
}

export function tileCenter(tile: Tile, layout: HexLayout): HexPoint {
  const width = Math.sqrt(3) * layout.size;
  const x = layout.originX + tile.col * width + (tile.row % 2 === 1 ? width / 2 : 0);
  const y = layout.originY + tile.row * (layout.size * 1.5);
  return { x, y };
}

export function tilePolygon(tile: Tile, layout: HexLayout): HexPoint[] {
  const center = tileCenter(tile, layout);
  const points: HexPoint[] = [];

  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    points.push({
      x: center.x + layout.size * Math.cos(angle),
      y: center.y + layout.size * Math.sin(angle)
    });
  }

  return points;
}
