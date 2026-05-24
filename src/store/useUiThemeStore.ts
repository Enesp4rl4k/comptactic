import { create } from 'zustand'
import {
  DEFAULT_UI_THEME,
  loadUiThemeId,
  persistUiTheme,
  type UiThemeId,
} from '../lib/uiTheme'

interface UiThemeState {
  themeId: UiThemeId
  setTheme: (id: UiThemeId) => void
}

export const useUiThemeStore = create<UiThemeState>((set) => ({
  themeId: loadUiThemeId(),
  setTheme: (id) => {
    persistUiTheme(id)
    set({ themeId: id })
  },
}))

export function getUiThemeId(): UiThemeId {
  return useUiThemeStore.getState().themeId ?? DEFAULT_UI_THEME
}
