// Ramer–Douglas–Peucker polyline simplification. Keeps freehand routes smooth
// and lightweight (fewer points -> less data, no render lag, clean curves).

function perpDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** points: flat [x0,y0,x1,y1,...]. epsilon in stage units. */
export function simplifyPoints(points: number[], epsilon = 2): number[] {
  const n = points.length / 2
  if (n < 3) return points
  const pts: [number, number][] = []
  for (let i = 0; i < points.length; i += 2) pts.push([points[i], points[i + 1]])

  const keep = new Array(n).fill(false)
  keep[0] = true
  keep[n - 1] = true

  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    let maxD = 0
    let idx = -1
    for (let i = first + 1; i < last; i++) {
      const d = perpDist(pts[i][0], pts[i][1], pts[first][0], pts[first][1], pts[last][0], pts[last][1])
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > epsilon && idx !== -1) {
      keep[idx] = true
      stack.push([first, idx], [idx, last])
    }
  }

  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(pts[i][0], pts[i][1])
  }
  return out
}
