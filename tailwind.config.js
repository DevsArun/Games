/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        // Loaded via a self-hosted/preconnected font to avoid render-blocking.
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // NEON HAUL brand palette — high-contrast neon on near-black.
        ink: {
          900: '#05060a',
          800: '#0a0c14',
          700: '#10131f',
          600: '#181c2c',
        },
        neon: {
          cyan: '#22d3ee',
          magenta: '#f0f',
          violet: '#8b5cf6',
          lime: '#a3e635',
          amber: '#fbbf24',
          red: '#fb3b53',
        },
      },
      boxShadow: {
        glow: '0 0 24px -2px rgba(34,211,238,0.55)',
        'glow-magenta': '0 0 24px -2px rgba(255,0,255,0.45)',
        glass: 'inset 0 1px 0 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.45)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px currentColor)' },
          '50%': { opacity: '0.65', filter: 'drop-shadow(0 0 2px currentColor)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.6s ease-in-out infinite',
        'slide-up': 'slide-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
