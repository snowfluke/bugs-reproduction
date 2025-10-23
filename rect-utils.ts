import cv from "@techstark/opencv-js";

export type Rect = cv.Rect;
export type Rects = Rect[];
export type ClusterRects = Rects[];
export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface RectBbox extends Bbox {}

export class RectCluster {
  getVerticalCluster(rects: Rects, thresholdX: number): ClusterRects {
    const clusters: ClusterRects = [];
    for (const rect of rects) {
      const cluster = clusters.find(
        (c) => c.length > 0 && c[0] && Math.abs(c[0].x - rect.x) <= thresholdX
      );

      if (cluster) {
        cluster.push(rect);
      } else {
        clusters.push([rect]);
      }
    }

    return clusters.sort((a, b) => b.length - a.length);
  }

  getVerticalClusterFromRight(rects: Rects, thresholdX: number): ClusterRects {
    const clusters: ClusterRects = [];
    for (const rect of rects) {
      const cluster = clusters.find(
        (c) =>
          c[0] && Math.abs(c[0].x + c[0].width - (rect.x + rect.width)) <= thresholdX
      );

      if (cluster) {
        cluster.push(rect);
      } else {
        clusters.push([rect]);
      }
    }

    return clusters.sort((a, b) => b.length - a.length);
  }

  getLargestCluster(clusters: ClusterRects): Rects {
    if (clusters.length === 0) {
      return [];
    }
    return clusters.reduce((maxCluster, currentCluster) => {
      return currentCluster.length > maxCluster.length
        ? currentCluster
        : maxCluster;
    }, clusters[0]!);
  }

  getClusterBox(rects: Rects): RectBbox {
    let bbox = {
      x0: Infinity,
      y0: Infinity,
      x1: 0,
      y1: 0,
    };

    for (let rect of rects) {
      bbox.x0 = Math.min(rect.x, bbox.x0);
      bbox.y0 = Math.min(rect.y, bbox.y0);

      bbox.x1 = Math.max(rect.x + rect.width, bbox.x1);
      bbox.y1 = Math.max(rect.y + rect.height, bbox.y1);
    }

    return bbox;
  }
}

export class RectUtil extends RectCluster {
  isPerfectSquare(ratio: number): boolean {
    return Math.abs(ratio - 1) <= 0.3;
  }

  toBbox(rect: Rect): RectBbox {
    return {
      x0: rect.x,
      y0: rect.y,
      x1: rect.x + rect.width,
      y1: rect.y + rect.height,
    };
  }

  toRect(bbox: RectBbox): Rect {
    return {
      x: bbox.x0,
      y: bbox.y0,
      width: bbox.x1 - bbox.x0,
      height: bbox.y1 - bbox.y0,
    };
  }

  createBbox(x0: number, y0: number, x1: number, y1: number) {
    return { x0, x1, y0, y1 };
  }

  filterNestedRects(rects: Rects): Rects {
    const result: Rects = [];

    for (const rect of rects) {
      if (this.isOuterRect(rect, rects)) {
        let candidateRect: Rects = [rect];

        const innerRects: cv.Rect[] = rects.filter(
          (innerRect) => rect !== innerRect && this.isInside(rect, innerRect)
        );

        const filteredInnerRects = innerRects.filter((rect, _, inner) =>
          this.isOuterRect(rect, inner)
        );

        if (
          filteredInnerRects.length > 1 &&
          this.isRectsConsistent(filteredInnerRects)
        ) {
          const totalWidth = this.getTotalWidth(filteredInnerRects);
          if (totalWidth > 0.9 * rect.width) {
            candidateRect = filteredInnerRects;
          }
        }

        result.push(...candidateRect);
      }
    }

    return result;
  }

  private isOuterRect(outer: Rect, inners: Rects) {
    return !inners.some(
      (inner) => outer !== inner && this.isInside(inner, outer)
    );
  }

  private isInside(outer: Rect, inner: Rect) {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height
    );
  }

  private getTotalWidth(rects: Rects) {
    return rects.reduce((acc, rect) => acc + rect.width, 0);
  }

  private isRectsConsistent(rects: Rects, threshold = 3) {
    if (rects.length === 0) {
      return false;
    }
    return rects.every(
      (rect) =>
        rects[0] && Math.abs(rects[0].width - rect.width) <= threshold &&
        Math.abs(rect.height - rect.height) <= threshold
    );
  }

  rectsToLines(rects: Rects, thresholdX = 10): ClusterRects {
    const classifier = (l: Rects, rect: Rect) =>
      l[0] ? Math.abs(l[0].y - rect.y) < thresholdX : false;

    const lines: ClusterRects = this.getLineCluster(rects, classifier);
    return lines;
  }

  rectsToLinesFromY1(rects: Rects, thresholdX = 10): ClusterRects {
    const classifier = (l: Rects, rect: Rect) =>
      l[0] ? Math.abs(l[0].y + l[0].height - (rect.y + rect.height)) < thresholdX : false;

    const lines: ClusterRects = this.getLineCluster(rects, classifier);
    return lines;
  }

  private getLineCluster(
    rects: Rects,
    callback: (l: Rects, rect: Rect) => boolean
  ) {
    const lines: ClusterRects = [];
    for (const rect of rects) {
      const line = lines.find((l) => callback(l, rect));

      if (line) {
        line.push(rect);
      } else {
        lines.push([rect]);
      }
    }

    return lines;
  }

  rectsToLinesMerge(rects: Rects, thresholdX = 10): Rects {
    const lines = this.rectsToLines(rects, thresholdX);
    const linesMerged = this.mergeRectsSameLine(lines);
    return linesMerged;
  }

  getMeanVerticalGap(rects: Rects): number {
    if (rects.length < 2) {
      return 0;
    }

    rects = rects.sort((a, b) => a.y - b.y);

    const verticalGaps: number[] = [];
    for (let i = 1; i < rects.length; i++) {
      const currentRect = rects[i];
      const prevRect = rects[i - 1];
      if (currentRect && prevRect) {
        const gap = currentRect.y - (prevRect.y + prevRect.height);
        verticalGaps.push(gap);
      }
    }

    const totalVerticalGap = verticalGaps.reduce((sum, gap) => sum + gap, 0);
    const averageVerticalGap = totalVerticalGap / (rects.length - 1);
    return averageVerticalGap;
  }

  private mergeRectsSameLine(lines: ClusterRects): Rects {
    const mergedLines = lines
      .map((line) => {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = 0;
        let y1 = 0;

        for (const rect of line) {
          x0 = Math.min(x0, rect.x);
          y0 = Math.min(y0, rect.y);
          x1 = Math.max(x1, rect.x + rect.width);
          y1 = Math.max(y1, rect.y + rect.height);
        }

        return new cv.Rect(x0, y0, x1 - x0, y1 - y0);
      })
      .sort((a, b) => a.y - b.y);

    return mergedLines;
  }

  filterByMeanHeight(rects: Rects): Rects {
    const averageHeight = this.getMeanHeight(rects);

    const filteredByMeanHeight = rects.filter(
      (rect) => rect.height >= averageHeight
    );
    return filteredByMeanHeight;
  }

  filterByMeanHeightThreshold(rects: Rects, threshold = 5): Rects {
    const averageHeight = this.getMeanHeight(rects);

    const filteredByMeanHeight = rects.filter(
      (rect) =>
        rect.height >= averageHeight || rect.height <= averageHeight + threshold
    );
    return filteredByMeanHeight;
  }

  private getMeanHeight(rects: Rects) {
    const averageHeight = rects.reduce((total, rect) => total + rect.height, 0);
    const average = averageHeight / rects.length;
    return average;
  }

  private getCornerRect(
    rects: Rects,
    getCorner: (rect: Rect) => { x: number; y: number },
    getRule: (boundary: RectBbox) => { x: number; y: number }
  ): Rect {
    if (rects.length === 0) {
      throw new Error("Cannot find corner rect in empty array");
    }

    const boundary = this.getClusterBox(rects);

    let minDistance = Number.MAX_SAFE_INTEGER;
    let cornerRect: Rect = rects[0]!;
    const rule = getRule(boundary);

    for (const rect of rects) {
      const cornerPoint = getCorner(rect);
      const distance = Math.sqrt(
        Math.pow(cornerPoint.x - rule.x, 2) +
          Math.pow(cornerPoint.y - rule.y, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        cornerRect = rect;
      }
    }

    return cornerRect;
  }

  getTopRightRect(rects: Rects): Rect {
    const topRight = (rect: Rect) => ({ x: rect.x + rect.width, y: rect.y });
    const rule = (boundary: RectBbox) => ({ x: boundary.x1, y: boundary.y0 });

    return this.getCornerRect(rects, topRight, rule);
  }

  getTopLeftRect(rects: Rects): Rect {
    const topLeft = (rect: Rect) => ({ x: rect.x, y: rect.y });
    const rule = (boundary: RectBbox) => ({ x: boundary.x0, y: boundary.y0 });

    return this.getCornerRect(rects, topLeft, rule);
  }

  getBottomRightRect(rects: Rects): Rect {
    const bottomRight = (rect: Rect) => ({
      x: rect.x + rect.width,
      y: rect.y + rect.height,
    });
    const rule = (boundary: RectBbox) => ({ x: boundary.x1, y: boundary.y1 });

    return this.getCornerRect(rects, bottomRight, rule);
  }

  getBottomLeftRect(rects: Rects): Rect {
    const bottomLeft = (rect: Rect) => ({ x: rect.x, y: rect.y + rect.height });
    const rule = (boundary: RectBbox) => ({ x: boundary.x0, y: boundary.y1 });

    return this.getCornerRect(rects, bottomLeft, rule);
  }
}