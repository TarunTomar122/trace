/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#faf8f4',
        surface: '#ffffff',
        ink: '#17140f',
        muted: '#6f685c',
        line: '#e9e3d8',
        accent: { DEFAULT: '#e8542a', dark: '#c8431d', soft: '#fbe9e2' },
        night: '#151210',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: { content: '72rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(23,20,15,0.04), 0 8px 24px -14px rgba(23,20,15,0.12)',
        lift: '0 2px 6px rgba(23,20,15,0.05), 0 26px 56px -20px rgba(23,20,15,0.22)',
      },
      keyframes: {
        eq: { '0%,100%': { transform: 'scaleY(0.35)' }, '50%': { transform: 'scaleY(1)' } },
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
