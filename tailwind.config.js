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
        // accent — tactical slate + highlight for primary actions
        accent: '#52525b',
        highlight: '#3b82f6',
        success: '#22c55e',
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
