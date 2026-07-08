import Phaser from "phaser";
import { HexMinesGame as GameLogic } from "../game/HexMinesGame";
import { tilePolygon, type HexLayout } from "../game/hexLayout";
import type { Tile } from "../game/types";

interface TileDisplay {
  shape: Phaser.GameObjects.Polygon;
  label: Phaser.GameObjects.Text;
  centerX: number;
  centerY: number;
}

const COLORS = {
  hidden: 0x8ca6c0,
  hiddenStroke: 0x5f7e98,
  revealed: 0xe6eff7,
  revealedStroke: 0xa8bfd4,
  mine: 0xdb3a34,
  mineStroke: 0x7f1d1d,
  flagged: 0xf4a259,
  flaggedStroke: 0x9a5d1b,
  hoverStroke: 0xf0b429,
  hole: 0x1f2937,
  holeStroke: 0x0f172a
};

export class HexMinesGame extends Phaser.Scene {
  private readonly logic = new GameLogic({ rows: 12, cols: 6, mineCount: 10 });
  private readonly displayByTileId = new Map<number, TileDisplay>();
  private layout: HexLayout = { size: 34, originX: 120, originY: 72 };
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private startMs = 0;
  private elapsedSeconds = 0;
  private hoveredTileId: number | null = null;
  // Debug state bar -- temporary debug option
  private debugTileId: number | null = null;

  constructor() {
    super("HexMinesScene");
  }

  public create(): void {
    this.input.mouse?.disableContextMenu();

    const gameContainer = document.getElementById("game-container");
    gameContainer?.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
      },
      { passive: false }
    );

    const restartButton = document.getElementById("restart");
    restartButton?.addEventListener("click", () => this.restartGame());
    // Debug: add listeners for debug row/col inputs -- temporary debug option
    const debugRowInput = document.getElementById("debug-tile-row") as HTMLInputElement | null;
    const debugColInput = document.getElementById("debug-tile-col") as HTMLInputElement | null;
    debugRowInput?.addEventListener("input", () => this.onDebugInputChange());
    debugColInput?.addEventListener("input", () => this.onDebugInputChange());

    this.bindControls();
    this.regenerateBoardFromLogic();
    this.updateHud("Ready");

    this.timerEvent = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => this.refreshTimer()
    });
  }

  private restartGame(): void {
    this.logic.reset();
    this.startMs = 0;
    this.elapsedSeconds = 0;
    this.updateHud("Ready");
    this.regenerateBoardFromLogic();
  }

  private bindControls(): void {
    const defaultMapButton = document.getElementById("default-map-btn") as HTMLButtonElement | null;
    const sizedMapButton = document.getElementById("sized-map-btn") as HTMLButtonElement | null;
    const randomMapButton = document.getElementById("random-map-btn") as HTMLButtonElement | null;
    const setMinesButton = document.getElementById("set-mines-btn") as HTMLButtonElement | null;

    defaultMapButton?.addEventListener("click", () => {
      const mines = this.readInputNumber("mines-input", 10, 1, 300);
      this.logic.generateDefaultMap(mines);
      this.startMs = 0;
      this.elapsedSeconds = 0;
      this.updateHud("Ready");
      this.syncInputsFromConfig();
      this.regenerateBoardFromLogic();
    });

    sizedMapButton?.addEventListener("click", () => {
      const rows = this.readInputNumber("rows-input", 12, 2, 40);
      const cols = this.readInputNumber("cols-input", 6, 2, 40);
      const mines = this.readInputNumber("mines-input", 10, 1, 300);
      this.logic.generateSizedMap(rows, cols, mines);
      this.startMs = 0;
      this.elapsedSeconds = 0;
      this.updateHud("Ready");
      this.syncInputsFromConfig();
      this.regenerateBoardFromLogic();
    });

    randomMapButton?.addEventListener("click", () => {
      const rows = this.readInputNumber("rows-input", 12, 2, 40);
      const cols = this.readInputNumber("cols-input", 6, 2, 40);
      const mines = this.readInputNumber("mines-input", 10, 1, 300);
      const holes = this.readInputNumber("holes-input", 8, 0, 300);
      this.logic.generateRandomHoleMap(rows, cols, mines, holes);
      this.startMs = 0;
      this.elapsedSeconds = 0;
      this.updateHud("Ready");
      this.syncInputsFromConfig();
      this.regenerateBoardFromLogic();
    });

    setMinesButton?.addEventListener("click", () => {
      const mines = this.readInputNumber("mines-input", 10, 1, 300);
      this.logic.setMineCount(mines);
      this.startMs = 0;
      this.elapsedSeconds = 0;
      this.updateHud("Ready");
      this.syncInputsFromConfig();
      this.redrawAll();
    });

    this.syncInputsFromConfig();
  }


  // Debug: called when debug row/col inputs change -- temporary debug option
  private onDebugInputChange(): void {
    const debugId = this.getDebugTileIdFromInputs();
    this.debugTileId = debugId;
    this.updateDebugBar(debugId);
  }

  private syncInputsFromConfig(): void {
    const config = this.logic.getConfig();
    this.writeInputNumber("rows-input", config.rows);
    this.writeInputNumber("cols-input", config.cols);
    this.writeInputNumber("mines-input", config.mineCount);
  }

  private readInputNumber(inputId: string, fallback: number, min: number, max: number): number {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) {
      return fallback;
    }

    const value = Number.parseInt(input.value, 10);
    if (Number.isNaN(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, value));
  }

  private writeInputNumber(inputId: string, value: number): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) {
      input.value = String(value);
    }
  }

  private regenerateBoardFromLogic(): void {
    this.clearBoard();
    this.hoveredTileId = null;
    // Debug: clear debug state on board regeneration -- temporary debug option
    this.debugTileId = null;
    this.updateDebugBar(null);
    this.updateLayoutForCurrentMap();
    this.drawBoard();
  }

  private clearBoard(): void {
    for (const display of this.displayByTileId.values()) {
      display.shape.destroy();
      display.label.destroy();
    }
    this.displayByTileId.clear();
  }

  private updateLayoutForCurrentMap(): void {
    const config = this.logic.getConfig();
    const viewportWidth = 940;
    const viewportHeight = 720;
    const maxWidth = viewportWidth - 120;
    const maxHeight = viewportHeight - 100;

    const widthFactor = Math.sqrt(3) * (config.cols + 0.5);
    const heightFactor = Math.max(2, 1.5 * (config.rows - 1) + 2);
    const sizeByWidth = maxWidth / widthFactor;
    const sizeByHeight = maxHeight / heightFactor;
    const size = Math.max(14, Math.min(36, Math.floor(Math.min(sizeByWidth, sizeByHeight))));

    const boardWidth = Math.sqrt(3) * size * (config.cols + 0.5);
    const boardHeight = size * (1.5 * (config.rows - 1) + 2);

    this.layout = {
      size,
      originX: Math.max(24, (viewportWidth - boardWidth) / 2 + (Math.sqrt(3) * size) / 2),
      originY: Math.max(24, (viewportHeight - boardHeight) / 2 + size)
    };
  }

  private drawBoard(): void {
    for (const tile of this.logic.getTiles()) {
      const points = tilePolygon(tile, this.layout);
      const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      const localPoints = points.flatMap((point) => [point.x - centerX, point.y - centerY]);

      const shape = this.add
        .polygon(centerX, centerY, localPoints, COLORS.hidden)
        .setStrokeStyle(2, COLORS.hiddenStroke)
        .setInteractive(new Phaser.Geom.Polygon(localPoints), Phaser.Geom.Polygon.Contains)
        .setDepth(1);

      const label = this.add
        .text(centerX - this.layout.size, centerY - this.layout.size, "", {
          fontFamily: "Trebuchet MS",
          fontSize: "20px",
          color: "#102a43"
        })
        .setOrigin(0.5)
        .setDepth(3);

      if (tile.isHole) {
        shape.disableInteractive();
      }

      shape.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) {
          this.onFlag(tile.id);
          return;
        }

        this.onReveal(tile.id);
      });

      shape.on(Phaser.Input.Events.POINTER_OVER, () => {
        const previousHoveredTileId = this.hoveredTileId;
        this.hoveredTileId = tile.id;

        if (previousHoveredTileId !== null && previousHoveredTileId !== tile.id) {
          this.paintTile(this.logic.getTiles()[previousHoveredTileId]);
        }

        this.paintTile(tile);
        // Debug: update bar when selected tile is hovered on -- temporary debug option
        const debugId = this.getDebugTileIdFromInputs();
        if (debugId !== null && debugId === tile.id) {
          this.updateDebugBar(debugId);
        }
      });

      shape.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (this.hoveredTileId !== tile.id) {
          return;
        }

        this.hoveredTileId = null;
        this.paintTile(tile);
        // Debug: update bar when selected tile is hovered off -- temporary debug option
        const debugId = this.getDebugTileIdFromInputs();
        if (debugId !== null && debugId === tile.id) {
          this.updateDebugBar(debugId);
        }
      });

      this.displayByTileId.set(tile.id, { shape, label, centerX, centerY });
      this.paintTile(tile);
    }
  }

  private redrawAll(): void {
    for (const tile of this.logic.getTiles()) {
      this.paintTile(tile);
    }
  }

  private onReveal(tileId: number): void {
    if (this.logic.getState() === "ready") {
      this.startMs = Date.now();
    }

    const result = this.logic.reveal(tileId);
    if (result.changedTileIds.length === 0 && !result.clickedMine) {
      return;
    }

    for (const id of result.changedTileIds) {
      const tile = this.logic.getTiles()[id];
      this.paintTile(tile);
    }

    if (result.clickedMine) {
      this.revealAllMines();
      this.updateHud("Game Over");
      return;
    }

    if (result.won) {
      this.revealAllMines(true);
      this.updateHud("You Win");
      return;
    }

    this.updateHud("Playing");
  }

  private onFlag(tileId: number): void {
    const changed = this.logic.toggleFlag(tileId);
    if (!changed) {
      return;
    }

    const tile = this.logic.getTiles()[tileId];
    this.paintTile(tile);

    if (this.logic.getState() === "won") {
      this.revealAllMines(true);
      this.updateHud("You Win");
      return;
    }

    this.updateHud("Playing");
  }

  private revealAllMines(markSafe = false): void {
    for (const tile of this.logic.getTiles()) {
      if (tile.hasMine) {
        tile.revealed = true;
      } else if (markSafe) {
        tile.revealed = true;
      }
      this.paintTile(tile);
    }
  }

  private paintTile(tile: Tile): void {
    const view = this.displayByTileId.get(tile.id);
    if (!view) {
      return;
    }

    view.label
      .setOrigin(0.5)
      .setPosition(view.centerX - this.layout.size, view.centerY - this.layout.size)
      .setVisible(true);

    let strokeWidth = 2;
    let strokeColor = COLORS.hiddenStroke;

    if (tile.isHole) {
      view.shape.setFillStyle(COLORS.hole);
      strokeColor = COLORS.holeStroke;
      view.label.setText("").setVisible(false);

      if (this.hoveredTileId === tile.id) {
        strokeWidth = 12;
        strokeColor = COLORS.hoverStroke;
      }

      view.shape.setScale(this.getHoverCompensationScale(strokeWidth));
      view.shape.setStrokeStyle(strokeWidth, strokeColor);
      return;
    }

    if (!tile.revealed) {
      if (tile.flagged) {
        view.shape.setFillStyle(COLORS.flagged);
        strokeColor = COLORS.flaggedStroke;
        view.label.setText("F").setColor("#3e2723");
      } else {
        view.shape.setFillStyle(COLORS.hidden);
        view.label.setText("");
      }
    } else if (tile.hasMine) {
      view.shape.setFillStyle(COLORS.mine);
      strokeColor = COLORS.mineStroke;
      view.label.setText("M").setColor("#ffffff");
    } else {
      view.shape.setFillStyle(COLORS.revealed);
      strokeColor = COLORS.revealedStroke;

      if (tile.adjacentMines === 0) {
        view.label.setText("").setVisible(true);
      } else {
        view.label
          .setText(String(tile.adjacentMines))
          .setColor("#102a43")
          .setVisible(true);
      }
    }

    if (this.hoveredTileId === tile.id) {
      strokeWidth = 12;
      strokeColor = COLORS.hoverStroke;
    }

    view.shape.setScale(this.getHoverCompensationScale(strokeWidth));
    view.shape.setStrokeStyle(strokeWidth, strokeColor);
  }

  private getHoverCompensationScale(hoverStrokeWidth: number): number {
    const radius = this.layout.size;
    const scale = radius / (radius + hoverStrokeWidth / Math.sqrt(3));
    return Math.max(0.82, scale);
  }


  // Debug helper -- temporary debug option
  // Read row/col from input elements and convert to tile ID
  private getDebugTileIdFromInputs(): number | null {
    const rowInput = document.getElementById("debug-tile-row") as HTMLInputElement | null;
    const colInput = document.getElementById("debug-tile-col") as HTMLInputElement | null;
    if (!rowInput || !colInput) {
      return null;
    }

    const row = Number.parseInt(rowInput.value, 10);
    const col = Number.parseInt(colInput.value, 10);

    if (Number.isNaN(row) || Number.isNaN(col)) {
      return null;
    }

    const config = this.logic.getConfig();
    if (row < 0 || row >= config.rows || col < 0 || col >= config.cols) {
      return null;
    }

    return row * config.cols + col;
  }

  // Update debug bar with tile coordinates and hex vertex info -- temporary debug option
  private updateDebugBar(tileId: number | null): void {
    const tileInfoEl = document.getElementById("debug-tile-info") as HTMLElement | null;
    const vertexInfoEl = document.getElementById("debug-vertex-info") as HTMLElement | null;

    if (!tileInfoEl || !vertexInfoEl) {
      return;
    }

    if (tileId === null) {
      tileInfoEl.textContent = "No cell selected";
      vertexInfoEl.textContent = "";
      return;
    }

    const tile = this.logic.getTiles()[tileId];
    if (!tile) {
      tileInfoEl.textContent = "Invalid tile";
      vertexInfoEl.textContent = "";
      return;
    }

    // Compute absolute coordinates of tile center
    const points = tilePolygon(tile, this.layout);
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    // Build tile info text -- temporary debug option
    const tileInfo = `ID: ${tileId} | Row: ${tile.row}, Col: ${tile.col}\nAbsolute: (${centerX.toFixed(1)}, ${centerY.toFixed(1)})\nState: ${tile.revealed ? (tile.hasMine ? "Mine" : "Safe") : (tile.flagged ? "Flagged" : "Hidden")}`;

    // Build vertex info -- temporary debug option
    const vertexLines = ["Vertices:"];
    for (let i = 0; i < points.length; i++) {
      vertexLines.push(`  V${i}: (${points[i].x.toFixed(1)}, ${points[i].y.toFixed(1)})`);
    }

    tileInfoEl.textContent = tileInfo;
    vertexInfoEl.textContent = vertexLines.join("\n");
  }

  private refreshTimer(): void {
    if (this.logic.getState() !== "playing") {
      return;
    }

    if (this.startMs > 0) {
      this.elapsedSeconds = Math.floor((Date.now() - this.startMs) / 1000);
      this.updateTimer(this.elapsedSeconds);
    }
  }

  private updateTimer(seconds: number): void {
    const timer = document.getElementById("timer");
    if (timer) {
      timer.textContent = `Time: ${seconds}s`;
    }
  }

  private updateMineCounter(): void {
    const mineCounter = document.getElementById("mine-counter");
    if (!mineCounter) {
      return;
    }

    const flaggedCount = this.logic.getTiles().reduce((count, tile) => {
      if (!tile.isHole && tile.flagged) {
        return count + 1;
      }
      return count;
    }, 0);

    const remainingMines = this.logic.getConfig().mineCount - flaggedCount;
    mineCounter.textContent = `Mines: ${remainingMines}`;
  }

  private updateHud(status: string): void {
    const stateLabel = document.getElementById("state");
    if (stateLabel) {
      stateLabel.textContent = `State: ${status}`;
    }

    if (status === "Ready") {
      this.updateTimer(0);
    }

    this.updateMineCounter();
  }
}
