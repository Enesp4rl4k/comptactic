/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blufor: '#3b82f6',
        opfor: '#ef4444',
        panel: '#1b1f27',
        panel2: '#232833',
        edge: '#333a47',
      },
    },
  },
  plugins: [],
}
