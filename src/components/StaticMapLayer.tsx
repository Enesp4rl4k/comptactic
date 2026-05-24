import { memo, useEffect, useRef } from 'react'
import { Group, Image as KonvaImage, Layer, Line, Rect, Circle, Text } from 'react-konva'
import type Konva from 'konva'
import type { CapturePoint } from '../types'
import { MAP_SIZE } from '../hooks/useBoardViewport'

interface Props {
  bg: HTMLImageElement | null
  bgStatus: 'loading' | 'loaded' | 'failed'
  capturePoints: CapturePoint[]
  /** Stage zoom — simplify CP labels when zoomed out. */
  viewScale: number
}

const BackgroundImage = memo(function BackgroundImage({ img }: { img: HTMLImageElement }) {
  const ar = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
  let w = MAP_SIZE
  let h = MAP_SIZE
  if (ar >= 1) h = MAP_SIZE / ar
  else w = MAP_SIZE * ar
  return (
    <KonvaImage
      image={img}
      width={w}
      height={h}
      x={(MAP_SIZE - w) / 2}
      y={(MAP_SIZE - h) / 2}
      imageSmoothingEnabled
    />
  )
})

const GridBackground = memo(function GridBackground() {
  const lines = []
  const step = MAP_SIZE / 16
  for (let i = 0; i <= 16; i++) {
    const p = i * step
    lines.push(
      <Line key={'h' + i} points={[0, p, MAP_SIZE, p]} stroke="#1e2530" strokeWidth={1} listening={false} perfectDrawEnabled={false} />,
      <Line key={'v' + i} points={[p, 0, p, MAP_SIZE]} stroke="#1e2530" strokeWidth={1} listening={false} perfectDrawEnabled={false} />,
    )
  }
  return (
    <Group listening={false}>
      <Rect width={MAP_SIZE} height={MAP_SIZE} fill="#10151c" listening={false} />
      {lines}
      <Rect width={MAP_SIZE} height={MAP_SIZE} stroke="#2a3340" strokeWidth={2} listening={false} />
    </Group>
  )
})

const CapturePointsOverlay = memo(function CapturePointsOverlay({
  points,
  detailed,
}: {
  points: CapturePoint[]
  detailed: boolean
}) {
  return (
    <>
      {points.map((cp, i) => (
        <Group key={cp.id} x={cp.x * MAP_SIZE} y={cp.y * MAP_SIZE} listening={false}>
          <Circle radius={14} fill="rgba(234,179,8,0.25)" stroke="#eab308" strokeWidth={2} listening={false} perfectDrawEnabled={false} />
          <Circle radius={4} fill="#eab308" listening={false} perfectDrawEnabled={false} />
          {detailed && (
            <Text
              text={`${i + 1}. ${cp.name}`}
              fontSize={13}
              fill="#fde68a"
              x={18}
              y={-7}
              listening={false}
              perfectDrawEnabled={false}
            />
          )}
        </Group>
      ))}
    </>
  )
})

/** Map background + CP overlay; cached as one bitmap while content is static. */
const StaticMapLayer = memo(function StaticMapLayer({ bg, bgStatus, capturePoints, viewScale }: Props) {
  const layerRef = useRef<Konva.Layer>(null)
  const detailedCp = viewScale >= 0.55

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || bgStatus !== 'loaded') return
    const raf = requestAnimationFrame(() => {
      layer.clearCache()
      const pr = Math.min(window.devicePixelRatio || 1, 2)
      layer.cache({ pixelRatio: pr })
      layer.batchDraw()
    })
    return () => cancelAnimationFrame(raf)
  }, [bg, bgStatus, capturePoints, detailedCp])

  return (
    <Layer ref={layerRef} listening={false}>
      {bg && bgStatus === 'loaded' ? <BackgroundImage img={bg} /> : <GridBackground />}
      {capturePoints.length > 0 && <CapturePointsOverlay points={capturePoints} detailed={detailedCp} />}
    </Layer>
  )
})

export default StaticMapLayer
