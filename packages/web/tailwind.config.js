/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1a1a1e',
        'surface-raised': '#222226',
        'surface-overlay': '#2a2a2e'
      }
    }
  },
  plugins: []
}
