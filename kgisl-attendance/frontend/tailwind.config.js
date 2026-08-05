/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#02070B', // Obsidian background
          900: '#06131D', // Deep glass surface
          850: '#0A1C27', // Elevated glass card
          800: '#102A37', // Hovered glass card
          700: '#1F4655', // Strong divider
          600: '#2E6576', // Secondary control
          border: '#285160', // Luminous glass edge
        },
        signal: {
          red: '#FF5D55',
          redDim: '#7a1a26',
          green: '#4ADE80',
          amber: '#F8C65C',
          blue: '#49D8FF',
        },
        theme: {
          bg: '#272465',
          sidebar: '#1E1B4B',
          card: '#302D68',
          btn: '#625CA8',
          'btn-hover': '#7771BD',
          border: '#484575',
          text: '#F5F5F7',
          'text-muted': '#B4B2C7',
          success: '#3FA37C',
          warning: '#D6A84B',
          error: '#C95D6B',
        },
      },
      fontFamily: {
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Inter"', 'sans-serif'],
        body: ['"SF Pro Text"', '-apple-system', 'BlinkMacSystemFont', '"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(224,41,63,0.25), 0 0 40px -8px rgba(224,41,63,0.45)',
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '0.6' },
          '70%': { transform: 'scale(1.15)', opacity: '0' },
          '100%': { transform: 'scale(1.15)', opacity: '0' },
        },
      },
      animation: {
        scanline: 'scanline 2.4s linear infinite',
        pulseRing: 'pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
