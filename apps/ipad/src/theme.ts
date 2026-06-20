// Dark palette mirroring the desktop app's system-monitor look.
export const theme = {
  bg: '#0b0e13',
  panel: '#141a22',
  panel2: '#1c242e',
  line: '#2a3440',
  text: '#e6edf3',
  dim: '#8b97a5',
  accent: '#4cc2ff',
  safe: '#3fb950',
  warn: '#d29922',
  clip: '#f85149',
} as const;

export type Theme = typeof theme;
