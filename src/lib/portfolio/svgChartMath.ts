export interface Point2D {
  x: number;
  y: number;
}

export interface GridTickResult {
  min: number;
  max: number;
  span: number;
  ticks: number[];
}

/**
 * Generates a smooth Monotone Cubic Hermite SVG path (Fritsch-Carlson) so financial series
 * never overshoot flat plateaus or sharp turning points.
 */
export function buildSmoothSvgPath(points: readonly Point2D[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  if (n === 2) {
    return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)},${points[1].y.toFixed(2)}`;
  }

  const dx: number[] = new Array(n - 1);
  const delta: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const stepX = points[i + 1].x - points[i].x;
    dx[i] = stepX;
    delta[i] = Math.abs(stepX) > 1e-6 ? (points[i + 1].y - points[i].y) / stepX : 0;
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (delta[i - 1] + delta[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(delta[i]) < 1e-9) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const alpha = m[i] / delta[i];
    const beta = m[i + 1] / delta[i];
    const hypot = Math.hypot(alpha, beta);
    if (hypot > 3) {
      const tau = 3 / hypot;
      m[i] = tau * alpha * delta[i];
      m[i + 1] = tau * beta * delta[i];
    }
  }

  const segments: string[] = [`M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = dx[i];
    if (Math.abs(h) <= 1e-6) {
      segments.push(`L ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`);
      continue;
    }
    const cp1x = p0.x + h / 3;
    const cp1y = p0.y + (m[i] * h) / 3;
    const cp2x = p1.x - h / 3;
    const cp2y = p1.y - (m[i + 1] * h) / 3;
    segments.push(
      `C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`
    );
  }

  return segments.join(' ');
}

/**
 * Wraps the smooth line path with a closed bottom boundary at baselineY for subtle gradient fills.
 */
export function buildAreaSvgPath(points: readonly Point2D[], baselineY: number): string {
  if (points.length < 2) return '';
  const linePath = buildSmoothSvgPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(2)},${baselineY.toFixed(2)} L ${first.x.toFixed(2)},${baselineY.toFixed(2)} Z`;
}

/**
 * Computes padded bounds and balanced Y-axis grid ticks for responsive chart legibility.
 */
export function computeNiceGridTicks(
  minVal: number,
  maxVal: number,
  tickCount = 4
): GridTickResult {
  const safeMin = Number.isFinite(minVal) ? minVal : 0;
  const safeMax = Number.isFinite(maxVal) ? maxVal : 1;
  const rawSpan = Math.max(1e-3, safeMax - safeMin);
  const pad = rawSpan * 0.1;
  const min = safeMin - pad;
  const max = safeMax + pad;
  const span = Math.max(1e-3, max - min);

  const count = Math.max(2, Math.floor(tickCount));
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    const val = min + (span * i) / (count - 1);
    ticks.push(Number(val.toFixed(2)));
  }

  return { min, max, span, ticks };
}
