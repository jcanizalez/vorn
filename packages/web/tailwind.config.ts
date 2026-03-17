import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{ts,tsx}',
    './index.html',
    // Include all renderer components so their Tailwind classes are picked up
    '../../src/renderer/**/*.{ts,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config
