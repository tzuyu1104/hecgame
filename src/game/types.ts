export interface Tile {
  id: number;
  row: number;
  col: number;
  hasMine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
}

export interface Coord {
  row: number;
  col: number;
}

export type GameState = "ready" | "playing" | "won" | "lost";

export interface GameConfig {
  rows: number;
  cols: number;
  mineCount: number;
}

export interface RevealResult {
  changedTileIds: number[];
  clickedMine: boolean;
  won: boolean;
}
