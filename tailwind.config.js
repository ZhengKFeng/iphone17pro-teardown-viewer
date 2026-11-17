/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#101214', 900: '#15171a', 800: '#1c1f23', 700: '#262a2f', 600: '#343941' },
        ember: { 300: '#ffb27a', 400: '#ff9550', 500: '#f77e2d', 600: '#d9641a' },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Text', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
