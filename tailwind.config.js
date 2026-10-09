/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ochre: '#EEB12F',
        brown: { DEFAULT: '#2B1B12', soft: '#5A4A3E' },
        cream: '#F5E7A8',
        paper: '#F7F1E3',
        sand: '#E9DCC0',
        coral: '#E8604C',
        leaf: '#2F8F5B',
        'gold-ink': '#8A6A1E',
        // Dashboard (bento) surfaces
        shell: '#EAE6DF',
        tile: '#F4F1EC',
        mute: '#A39A92',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // Full Yorùbá tone-mark support (ẹ, ọ, ṣ with accents)
        yoruba: ['"Noto Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
