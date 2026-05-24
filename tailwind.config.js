/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // teams
        blufor: '#3b82f6',
        opfor: '#ef4444',
        neutral: '#eab308',
        // surfaces
        bg: '#09090b',
        panel: '#141416',
        panel2: '#1c1c1f',
        edge: '#2a2a2e',
        edge2: '#36363c',
        // accent — driven by CSS vars (see index.css + data-ui-theme)
        accent: '#52525b',
        highlight: 'rgb(var(--ui-highlight-rgb) / <alpha-value>)',
        success: 'rgb(var(--ui-highlight-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Chakra Petch"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 8px 24px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
}
