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
        // surfaces (deep slate, 3-tier)
        bg: '#0b0e14',
        panel: '#141821',
        panel2: '#1e2430',
        edge: '#2b3340',
        // accent
        accent: '#3b82f6',
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
