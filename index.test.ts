import { beforeAll, describe, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { ImageProcessor } from "ppu-ocv";
import { getPaddleOcr, PaddleOcr } from "./ocr.service";

describe("OCR Sample test", () => {
  let paddleOcr: PaddleOcr;

  beforeAll(async () => {
    await ImageProcessor.initRuntime();
    paddleOcr = await getPaddleOcr();
  });

  describe("Extract key receipt fields", () => {
    const testCases = [
      {
        imageFile: "test.png",
        jsonFile: "001.json",
      },
    ];

    testCases.forEach(({ imageFile, jsonFile }) => {
      it(`should extract words  from ${imageFile}`, async () => {
        const groundTruthPath = join(__dirname, jsonFile);
        const groundTruth: string[] = JSON.parse(
          readFileSync(groundTruthPath, "utf-8")
        );

        const imagePath = Bun.file(imageFile);
        const imageBuffer = await imagePath.arrayBuffer();
        const inputCanvas = await ImageProcessor.prepareCanvas(imageBuffer);

        const result = await paddleOcr.recognize(inputCanvas);
        console.log("OCR Result:", result);
      });
    });
  });
});
