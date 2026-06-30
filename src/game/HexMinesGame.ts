import type { Coord, GameConfig, GameState, MapOptions, RevealResult, Tile } from "./types";

const DEFAULT_CONFIG: GameConfig = {
  rows: 12,
  cols: 6,
  mineCount: 10
};

export class HexMinesGame {
  private config: GameConfig;
  private readonly tiles: Tile[] = [];
  private state: GameState = "ready";
  private revealedSafeCount = 0;
  private holeCount = 0;
  private randomHoles = false;

  constructor(config?: Partial<GameConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.generateDefaultMap(this.config.mineCount);
  }

  public reset(): void {
    this.configureMap({
      rows: this.config.rows,
      cols: this.config.cols,
      mineCount: this.config.mineCount,
      holeCount: this.holeCount,
      randomHoles: this.randomHoles
    });
  }

  public generateDefaultMap(mineCount = DEFAULT_CONFIG.mineCount): void {
    this.configureMap({
      rows: DEFAULT_CONFIG.rows,
      cols: DEFAULT_CONFIG.cols,
      mineCount,
      holeCount: 0,
      randomHoles: false
    });
  }

  public generateSizedMap(rows: number, cols: number, mineCount: number): void {
    this.configureMap({ rows, cols, mineCount, holeCount: 0, randomHoles: false });
  }

  public generateRandomHoleMap(rows: number, cols: number, mineCount: number, holeCount: number): void {
    this.configureMap({ rows, cols, mineCount, holeCount, randomHoles: true });
  }

  public setMineCount(mineCount: number): void {
    this.config.mineCount = Math.max(1, Math.floor(mineCount));
    this.resetRoundState();
    this.placeMines();
    this.computeAdjacency();
    this.state = "ready";
    this.revealedSafeCount = 0;
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
    if (!tile || tile.isHole || tile.flagged || tile.revealed || this.state === "won" || this.state === "lost") {
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
    if (!tile || tile.isHole || tile.revealed || this.state === "won" || this.state === "lost") {
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
      .filter((id): id is number => id !== null)
      .filter((id) => !this.tiles[id].isHole);
  }

  private configureMap(options: MapOptions): void {
    this.config = {
      rows: Math.max(2, Math.floor(options.rows)),
      cols: Math.max(2, Math.floor(options.cols)),
      mineCount: Math.max(1, Math.floor(options.mineCount))
    };
    this.holeCount = Math.max(0, Math.floor(options.holeCount ?? 0));
    this.randomHoles = Boolean(options.randomHoles);

    this.tiles.length = 0;
    const totalTiles = this.config.rows * this.config.cols;
    for (let id = 0; id < totalTiles; id += 1) {
      const row = Math.floor(id / this.config.cols);
      const col = id % this.config.cols;
      this.tiles.push({
        id,
        row,
        col,
        isHole: false,
        hasMine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0
      });
    }

    if (this.randomHoles && this.holeCount > 0) {
      for (const holeId of this.pickCenterHoleIds(this.holeCount)) {
        this.tiles[holeId].isHole = true;
      }
    }

    this.resetRoundState();
    this.placeMines();
    this.computeAdjacency();
    this.state = "ready";
    this.revealedSafeCount = 0;
  }

  private resetRoundState(): void {
    for (const tile of this.tiles) {
      tile.hasMine = false;
      tile.revealed = false;
      tile.flagged = false;
      tile.adjacentMines = 0;
    }
  }

  private placeMines(): void {
    const ids = this.tiles.filter((tile) => !tile.isHole).map((tile) => tile.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    const count = Math.min(this.config.mineCount, Math.max(0, ids.length - 1));
    this.config.mineCount = count;
    for (let i = 0; i < count; i += 1) {
      this.tiles[ids[i]].hasMine = true;
    }
  }

  private computeAdjacency(): void {
    for (const tile of this.tiles) {
      if (tile.isHole) {
        tile.adjacentMines = 0;
        continue;
      }

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
      if (!tile || tile.isHole || tile.revealed || tile.flagged || tile.hasMine) {
        continue;
      }

      tile.revealed = true;
      this.revealedSafeCount += 1;
      changed.push(id);

      if (tile.adjacentMines === 0) {
        for (const neighborId of this.getNeighborIds(tile.id)) {
          const neighbor = this.tiles[neighborId];
          if (!neighbor.isHole && !neighbor.revealed && !neighbor.flagged && !neighbor.hasMine) {
            queue.push(neighborId);
          }
        }
      }
    }

    return changed;
  }

  private checkWin(): boolean {
    const totalSafeTiles = this.tiles.reduce((count, tile) => {
      if (!tile.hasMine && !tile.isHole) {
        return count + 1;
      }
      return count;
    }, 0);

    return this.revealedSafeCount >= totalSafeTiles;
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

  private pickCenterHoleIds(targetHoleCount: number): number[] {
    const maxHoles = Math.max(0, this.tiles.length - 1);
    const count = Math.min(targetHoleCount, maxHoles);
    if (count === 0) {
      return [];
    }

    const centerRow = Math.floor(this.config.rows / 2);
    const centerCol = Math.floor(this.config.cols / 2);
    const centerId = this.toId(centerRow, centerCol);
    if (centerId === null) {
      return [];
    }

    const selected = new Set<number>([centerId]);
    const frontier = new Set<number>(this.getNeighborCandidateIds(centerId));

    while (selected.size < count) {
      if (frontier.size === 0) {
        break;
      }

      const candidates = Array.from(frontier);
      const nextId = candidates[Math.floor(Math.random() * candidates.length)];
      frontier.delete(nextId);
      if (selected.has(nextId)) {
        continue;
      }

      selected.add(nextId);
      for (const neighborId of this.getNeighborCandidateIds(nextId)) {
        if (!selected.has(neighborId)) {
          frontier.add(neighborId);
        }
      }
    }

    return Array.from(selected);
  }

  private getNeighborCandidateIds(tileId: number): number[] {
    const tile = this.tiles[tileId];
    if (!tile) {
      return [];
    }

    return this.neighborCoords(tile.row, tile.col)
      .map((coord) => this.toId(coord.row, coord.col))
      .filter((id): id is number => id !== null);
  }
}
