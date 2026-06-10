/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        orange: {
          50: '#FFF7F3',
          100: '#FFE8D6',
          200: '#FFD0B5',
          300: '#FFB088',
          400: '#FF8C57',
          500: '#FF6B2B',
          600: '#E55A1E',
          700: '#C04B14',
          800: '#9A3D0F',
          900: '#7A3009',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
