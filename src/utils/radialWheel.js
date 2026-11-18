/**
 * 径向轮盘几何。扇区始终按 360°/n 均分。
 * 角度约定：12 点为 0°，顺时针为正（与屏幕 y 轴向下一致）。
 * 只负责绘制和命中，不涉及 MQTT / 指令。
 */

export const WHEEL = {
  size: 320,
  cx: 160,
  cy: 160,
  rBezel: 158,
  rTickOut: 154,
  rTickIn: 148,
  rTickMidIn: 145,
  rTickMajorIn: 138,
  rSectorOut: 132,
  rSectorSel: 143,
  rSectorIn: 98,
  rLabel: 116,
  rPip: 107,
  rHud: 88,
  gapDeg: 1.8,
};

export function normalize360(deg) {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

/** 折到 (-180, 180]，用于取最短转角 */
export function normalize180(deg) {
  let a = normalize360(deg);
  if (a > 180) a -= 360;
  return a;
}

export function polar(cx, cy, r, clockDeg) {
  const rad = (clockDeg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

export function sliceGap(n, gapDeg = WHEEL.gapDeg) {
  const slice = 360 / Math.max(1, n);
  return Math.min(gapDeg, slice * 0.16);
}

/** 第 i 个扇区的起止角（含对称间隙），中心仍落在 (i+0.5)*slice */
export function sectorAngles(i, n, gapDeg = WHEEL.gapDeg) {
  const count = Math.max(1, n);
  const slice = 360 / count;
  const gap = sliceGap(count, gapDeg);
  const a0 = i * slice + gap / 2;
  const a1 = (i + 1) * slice - gap / 2;
  return { a0, a1, mid: (a0 + a1) / 2, slice, gap };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** 圆环扇形。a0→a1 为顺时针外弧，再沿内弧返回。 */
export function annularSectorPath(cx, cy, rIn, rOut, a0, a1) {
  const span = a1 - a0;
  const large = span > 180 ? 1 : 0;
  const [x0o, y0o] = polar(cx, cy, rOut, a0);
  const [x1o, y1o] = polar(cx, cy, rOut, a1);
  const [x1i, y1i] = polar(cx, cy, rIn, a1);
  const [x0i, y0i] = polar(cx, cy, rIn, a0);
  return [
    `M ${round2(x0o)} ${round2(y0o)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${round2(x1o)} ${round2(y1o)}`,
    `L ${round2(x1i)} ${round2(y1i)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${round2(x0i)} ${round2(y0i)}`,
    'Z',
  ].join(' ');
}

/**
 * 把扇区 i 的中心转到 12 点，并取离 fromDeg 最近的等价角。
 * 这样连续切换会沿短路径转过去，而不会每圈跳回 0。
 */
export function rotationForIndex(i, n, fromDeg = 0) {
  const count = Math.max(1, n);
  const idx = ((i % count) + count) % count;
  const slice = 360 / count;
  const base = -((idx + 0.5) * slice);
  const k = Math.round((fromDeg - base) / 360);
  return base + 360 * k;
}

/** 当前旋转角下，哪一块扇区中心离 12 点最近 */
export function indexFromRotation(rot, n) {
  const count = Math.max(1, n | 0);
  if (count <= 1) return 0;
  const slice = 360 / count;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < count; i += 1) {
    const d = Math.abs(normalize180((i + 0.5) * slice + rot));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** 屏幕上的钟面角（已含圆盘旋转）落在哪一块扇区 */
export function sectorIndexAtVisual(visualDeg, rot, n) {
  const count = Math.max(1, n | 0);
  if (count <= 1) return 0;
  const local = normalize360(visualDeg - rot);
  const slice = 360 / count;
  let i = Math.floor(local / slice);
  if (i < 0) i = 0;
  if (i >= count) i = count - 1;
  return i;
}

/** 12 点为 0，顺时针为正，约 -180..180 */
export function clockDegFromPoint(x, y, cx, cy) {
  return (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
}

/** 外围刻度。12 点留给三角游标，3/6/9 点为加长主刻度。 */
export function tickMarks() {
  const { cx, cy, rTickOut, rTickIn, rTickMidIn, rTickMajorIn } = WHEEL;
  const marks = [];
  for (let deg = 0; deg < 360; deg += 3) {
    if (deg === 0) continue;
    const major = deg % 90 === 0;
    const mid = !major && deg % 30 === 0;
    const r1 = major ? rTickMajorIn : mid ? rTickMidIn : rTickIn;
    const [x1, y1] = polar(cx, cy, r1, deg);
    const [x2, y2] = polar(cx, cy, rTickOut, deg);
    marks.push({
      deg,
      major,
      mid,
      x1: round2(x1),
      y1: round2(y1),
      x2: round2(x2),
      y2: round2(y2),
    });
  }
  return marks;
}
