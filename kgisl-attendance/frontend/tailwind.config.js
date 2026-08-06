/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0F172A', // Slate 900 - Calm Executive Background
          900: '#1E293B', // Slate 800 - Crisp Card Surface
          850: '#334155', // Slate 700 - Elevated Card Surface
          800: '#475569', // Hovered Card Surface
          700: '#64748B', // Muted Divider
          600: '#94A3B8', // Secondary Text Control
          border: '#334155', // Clean Slate Border
        },
        signal: {
          red: '#EF4444',
          redDim: '#991B1B',
          green: '#10B981',
          amber: '#F59E0B',
          blue: '#3B82F6',
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
