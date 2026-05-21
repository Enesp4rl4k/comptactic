import { useBoardStore } from '../store/useBoardStore'
import type { ToolId, Team } from '../types'

const TOOLS: { id: ToolId; label: string; glyph: string }[] = [
  { id: 'select', label: 'Seç / Taşı', glyph: '⭖' },
  { id: 'arrow', label: 'Ok', glyph: '↗' },
  { id: 'line', label: 'Çizgi', glyph: '╱' },
  { id: 'pen', label: 'Serbest', glyph: '✎' },
  { id: 'rect', label: 'Dikdörtgen', glyph: '▭' },
  { id: 'circle', label: 'Daire', glyph: '◯' },
  { id: 'text', label: 'Metin', glyph: 'T' },
  { id: 'measure', label: 'Ölçüm (m)', glyph: '📏' },
]

const COLORS = ['#3b82f6', '#ef4444', '#eab308', '#22c55e', '#a855f7', '#f97316', '#ffffff', '#0b0e13']

const TEAMS: { id: Team; label: string; color: string }[] = [
  { id: 'blufor', label: 'BLUFOR', color: '#3b82f6' },
  { id: 'opfor', label: 'OPFOR', color: '#ef4444' },
  { id: 'neutral', label: 'Nötr', color: '#eab308' },
]

export default function Toolbar() {
  const { tool, setTool, team, setTeam, color, setColor, strokeWidth, setStrokeWidth, undo, redo, clearBoard } =
    useBoardStore()

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-panel border-b border-edge">
      <div className="flex gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setTool(t.id)}
            className={`h-9 w-9 rounded text-base grid place-items-center border transition-colors ${
              tool === t.id
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-panel2 border-edge text-gray-300 hover:bg-edge'
            }`}
          >
            {t.glyph}
          </button>
        ))}
      </div>

      <Divider />

      <div className="flex gap-1">
        {TEAMS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTeam(t.id)}
            className={`px-2 h-9 rounded text-xs font-semibold border ${
              team === t.id ? 'text-white' : 'text-gray-400'
            }`}
            style={{
              background: team === t.id ? t.color : '#232833',
              borderColor: team === t.id ? t.color : '#333a47',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
            style={{ background: c }}
            title={c}
          />
        ))}
      </div>

      <Divider />

      <label className="flex items-center gap-2 text-xs text-gray-400">
        Kalınlık
        <input
          type="range"
          min={1}
          max={14}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-24 accent-blue-500"
        />
      </label>

      <div className="ml-auto flex gap-1">
        <ActionBtn onClick={undo} title="Geri al (Ctrl+Z)">↶</ActionBtn>
        <ActionBtn onClick={redo} title="İleri al (Ctrl+Y)">↷</ActionBtn>
        <ActionBtn
          onClick={() => {
            if (confirm('Tahtayı temizle?')) clearBoard()
          }}
          title="Tahtayı temizle"
        >
          🗑
        </ActionBtn>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="h-7 w-px bg-edge" />
}

function ActionBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 w-9 rounded bg-panel2 border border-edge text-gray-300 hover:bg-edge grid place-items-center"
    >
      {children}
    </button>
  )
}
