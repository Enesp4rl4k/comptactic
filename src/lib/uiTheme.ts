export type UiThemeId = 'red' | 'amber' | 'blue' | 'steel'

export interface UiTheme {
  id: UiThemeId
  label: string
  rgb: string
  hover: string
  swatch: string
}

export const UI_THEMES: UiTheme[] = [
  { id: 'red', label: 'Red', rgb: '220 38 38', hover: '#ef4444', swatch: '#dc2626' },
  { id: 'amber', label: 'Amber', rgb: '202 138 4', hover: '#facc15', swatch: '#ca8a04' },
  { id: 'blue', label: 'Blue', rgb: '59 130 246', hover: '#60a5fa', swatch: '#3b82f6' },
  { id: 'steel', label: 'Steel', rgb: '161 161 170', hover: '#d4d4d8', swatch: '#a1a1aa' },
]

export const UI_THEME_BY_ID = Object.fromEntries(UI_THEMES.map((t) => [t.id, t])) as Record<
  UiThemeId,
  UiTheme
>

const STORAGE_KEY = 'comptactic-ui-theme'
export const DEFAULT_UI_THEME: UiThemeId = 'red'

export function isUiThemeId(value: string): value is UiThemeId {
  return value in UI_THEME_BY_ID
}

export function loadUiThemeId(): UiThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && isUiThemeId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_UI_THEME
}

export function applyUiTheme(id: UiThemeId) {
  document.documentElement.dataset.uiTheme = id
}

export function persistUiTheme(id: UiThemeId) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  applyUiTheme(id)
}

export function initUiTheme() {
  applyUiTheme(loadUiThemeId())
}
