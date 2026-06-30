import Phaser from "phaser";
import { HexMinesGame } from "./ui/HexMinesScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: 940,
  height: 720,
  backgroundColor: "#eef4fb",
  scene: [HexMinesGame],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
