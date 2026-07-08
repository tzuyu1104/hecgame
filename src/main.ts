import Phaser from "phaser";
import { HexMinesGame } from "./ui/HexMinesScene";

const GAME_WIDTH = 940;
const GAME_HEIGHT = 720;

const getDevicePixelRatio = (): number => Math.max(1, window.devicePixelRatio || 1);

type RendererWithResolution =
  | (Phaser.Renderer.WebGL.WebGLRenderer & { resolution: number })
  | (Phaser.Renderer.Canvas.CanvasRenderer & { resolution: number });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#eef4fb",
  scene: [HexMinesGame],
  scale: {
    mode: Phaser.Scale.NONE
  }
});

const updateResolutionForCurrentDpr = (): void => {
  const renderer = game.renderer as RendererWithResolution;
  const nextResolution = getDevicePixelRatio();

  if (renderer.resolution === nextResolution) {
    return;
  }

  renderer.resolution = nextResolution;
  renderer.resize(GAME_WIDTH, GAME_HEIGHT);
};

const watchDevicePixelRatioChanges = (): (() => void) => {
  let cleanup: (() => void) | null = null;

  const bindQuery = (): void => {
    cleanup?.();

    const query = window.matchMedia(`(resolution: ${getDevicePixelRatio()}dppx)`);
    const handleChange = (): void => {
      bindQuery();
      updateResolutionForCurrentDpr();
    };

    query.addEventListener("change", handleChange);
    cleanup = () => query.removeEventListener("change", handleChange);
  };

  bindQuery();
  return () => cleanup?.();
};

game.events.once("ready", () => {
  updateResolutionForCurrentDpr();
});

watchDevicePixelRatioChanges();
