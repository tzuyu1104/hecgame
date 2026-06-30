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
  hoverStroke: 0xf0b429
};

export class HexMinesGame extends Phaser.Scene {
  private readonly logic = new GameLogic({ rows: 12, cols: 6, mineCount: 10 });
  private readonly displayByTileId = new Map<number, TileDisplay>();
  private layout: HexLayout = { size: 34, originX: 120, originY: 72 };
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private startMs = 0;
  private elapsedSeconds = 0;
  private hoveredTileId: number | null = null;

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

    this.drawBoard();
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
    this.redrawAll();
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
        .text(centerX-this.layout.size, centerY-this.layout.size, "", {
          fontFamily: "Trebuchet MS",
          fontSize: "20px",
          color: "#102a43"
        })
        .setOrigin(0.5)
        .setDepth(3);

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
      });

      shape.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (this.hoveredTileId !== tile.id) {
          return;
        }

        this.hoveredTileId = null;
        this.paintTile(tile);
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

    view.label.setOrigin(0.5).setPosition(view.centerX-this.layout.size, view.centerY-this.layout.size).setVisible(true);

    let strokeWidth = 2;
    let strokeColor = COLORS.hiddenStroke;

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
      strokeWidth = 5;
      strokeColor = COLORS.hoverStroke;
      view.shape.setScale(1.04);
    } else {
      view.shape.setScale(1);
    }

    view.shape.setStrokeStyle(strokeWidth, strokeColor);
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

  private updateHud(status: string): void {
    const stateLabel = document.getElementById("state");
    if (stateLabel) {
      stateLabel.textContent = `State: ${status}`;
    }

    if (status === "Ready") {
      this.updateTimer(0);
    }
  }
}
