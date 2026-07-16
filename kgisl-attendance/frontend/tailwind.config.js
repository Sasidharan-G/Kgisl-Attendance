/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#272465', // Main Background (Deep Indigo)
          900: '#1E1B4B', // Sidebar / Header (Midnight Indigo)
          850: '#302D68', // Cards (Muted Indigo)
          800: '#302D68', // Cards (Muted Indigo)
          700: '#484575', // Border / Lighter Cards
          600: '#625CA8', // Primary Button approx
          border: '#484575', // Border (Muted Lavender Grey)
        },
        signal: {
          red: '#FF453A',
          redDim: '#7a1a26',
          green: '#32D74B',
          amber: '#f2b544',
          blue: '#0A84FF',
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
