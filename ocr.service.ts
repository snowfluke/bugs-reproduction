import type { Canvas } from "ppu-ocv";
import { type PaddleOcrResult, PaddleOcrService } from "ppu-paddle-ocr";

export class PaddleOcr {
  private static instance: PaddleOcr;
  private paddle!: PaddleOcrService;

  private constructor() {
    this.paddle = new PaddleOcrService();
  }

  async init() {
    await this.paddle.initialize();
  }

  public static getInstance(): PaddleOcr {
    if (!PaddleOcr.instance) {
      PaddleOcr.instance = new PaddleOcr();
    }

    return PaddleOcr.instance;
  }

  public async recognize(
    image: ArrayBuffer | Canvas
  ): Promise<PaddleOcrResult> {
    return this.paddle.recognize(image);
  }

  public async deskewImage(image: ArrayBuffer | Canvas): Promise<Canvas> {
    return this.paddle.deskewImage(image);
  }
}

let PaddleOcrInstance: PaddleOcr | null = null;
let initializationPromise: Promise<PaddleOcr> | null = null;

export const getPaddleOcr = async (): Promise<PaddleOcr> => {
  if (!PaddleOcrInstance) {
    if (!initializationPromise) {
      initializationPromise = initializePaddleOcr();
    }
    PaddleOcrInstance = await initializationPromise;
  }
  return PaddleOcrInstance;
};

export const initializePaddleOcr = async (): Promise<PaddleOcr> => {
  if (!PaddleOcrInstance) {
    PaddleOcrInstance = PaddleOcr.getInstance();
    await PaddleOcrInstance.init();
  }
  return PaddleOcrInstance;
};
