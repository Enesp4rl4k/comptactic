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
        // surfaces (neutral grayscale, 3-tier)
        bg: '#0c0c0d',
        panel: '#161617',
        panel2: '#202022',
        edge: '#2d2d30',
        // accent — neutral gray for active states (monochrome theme)
        accent: '#57575b',
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
