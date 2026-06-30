import type { Coord, GameConfig, GameState, RevealResult, Tile } from "./types";

const DEFAULT_CONFIG: GameConfig = {
  rows: 12,
  cols: 6,
  mineCount: 10
};

export class HexMinesGame {
  private readonly config: GameConfig;
  private readonly tiles: Tile[] = [];
  private state: GameState = "ready";
  private revealedSafeCount = 0;

  constructor(config?: Partial<GameConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.reset();
  }

  public reset(): void {
    this.tiles.length = 0;
    this.state = "ready";
    this.revealedSafeCount = 0;

    const totalTiles = this.config.rows * this.config.cols;
    for (let id = 0; id < totalTiles; id += 1) {
      const row = Math.floor(id / this.config.cols);
      const col = id % this.config.cols;
      this.tiles.push({
        id,
        row,
        col,
        hasMine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0
      });
    }

    this.placeMines();
    this.computeAdjacency();
  }

  public getState(): GameState {
    return this.state;
  }

  public getTiles(): Tile[] {
    return this.tiles;
  }

  public getConfig(): GameConfig {
    return this.config;
  }

  public reveal(tileId: number): RevealResult {
    const tile = this.tiles[tileId];
    if (!tile || tile.flagged || tile.revealed || this.state === "won" || this.state === "lost") {
      return { changedTileIds: [], clickedMine: false, won: this.state === "won" };
    }

    if (this.state === "ready") {
      this.state = "playing";
    }

    if (tile.hasMine) {
      tile.revealed = true;
      this.state = "lost";
      return { changedTileIds: [tile.id], clickedMine: true, won: false };
    }

    const changed = this.floodReveal(tile.id);
    const won = this.checkWin();
    if (won) {
      this.state = "won";
    }

    return { changedTileIds: changed, clickedMine: false, won };
  }

  public toggleFlag(tileId: number): boolean {
    const tile = this.tiles[tileId];
    if (!tile || tile.revealed || this.state === "won" || this.state === "lost") {
      return false;
    }

    if (this.state === "ready") {
      this.state = "playing";
    }

    tile.flagged = !tile.flagged;

    if (this.checkWin()) {
      this.state = "won";
    }

    return true;
  }

  public getNeighborIds(tileId: number): number[] {
    const tile = this.tiles[tileId];
    if (!tile) {
      return [];
    }

    return this.neighborCoords(tile.row, tile.col)
      .map((coord) => this.toId(coord.row, coord.col))
      .filter((id): id is number => id !== null);
  }

  private placeMines(): void {
    const ids = this.tiles.map((tile) => tile.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    const count = Math.min(this.config.mineCount, ids.length - 1);
    for (let i = 0; i < count; i += 1) {
      this.tiles[ids[i]].hasMine = true;
    }
  }

  private computeAdjacency(): void {
    for (const tile of this.tiles) {
      const neighbors = this.getNeighborIds(tile.id);
      tile.adjacentMines = neighbors.reduce((count, id) => {
        return this.tiles[id].hasMine ? count + 1 : count;
      }, 0);
    }
  }

  private floodReveal(startTileId: number): number[] {
    const queue: number[] = [startTileId];
    const changed: number[] = [];

    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) {
        break;
      }

      const tile = this.tiles[id];
      if (!tile || tile.revealed || tile.flagged || tile.hasMine) {
        continue;
      }

      tile.revealed = true;
      this.revealedSafeCount += 1;
      changed.push(id);

      if (tile.adjacentMines === 0) {
        for (const neighborId of this.getNeighborIds(tile.id)) {
          const neighbor = this.tiles[neighborId];
          if (!neighbor.revealed && !neighbor.flagged && !neighbor.hasMine) {
            queue.push(neighborId);
          }
        }
      }
    }

    return changed;
  }

  private checkWin(): boolean {
    const totalSafeTiles = this.tiles.length - this.config.mineCount;
    if (this.revealedSafeCount >= totalSafeTiles) {
      return true;
    }

    const allMinesFlagged = this.tiles.every((tile) => {
      if (tile.hasMine) {
        return tile.flagged;
      }
      return !tile.flagged;
    });

    return allMinesFlagged;
  }

  private toId(row: number, col: number): number | null {
    if (row < 0 || row >= this.config.rows || col < 0 || col >= this.config.cols) {
      return null;
    }

    return row * this.config.cols + col;
  }

  private neighborCoords(row: number, col: number): Coord[] {
    const offsetsForEvenRow: Coord[] = [
      { row: -1, col: -1 },
      { row: -1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 0 }
    ];

    const offsetsForOddRow: Coord[] = [
      { row: -1, col: 0 },
      { row: -1, col: 1 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ];

    const offsets = row % 2 === 0 ? offsetsForEvenRow : offsetsForOddRow;
    return offsets.map((offset) => ({ row: row + offset.row, col: col + offset.col }));
  }
}
