/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Warm cozy palette
        cream: {
          50: '#FBF7F0',
          100: '#F5EDE0',
          200: '#EDDFC8',
          300: '#E0CCA8',
        },
        moss: {
          200: '#C9D6BE',
          400: '#8FA889',
          600: '#5E7858',
        },
        rose: {
          200: '#F2C6C0',
          400: '#E29B96',
        },
        lilac: {
          200: '#D9CFE8',
          400: '#A998C2',
        },
        sand: {
          300: '#D4B89A',
          500: '#A88B68',
          700: '#6B5640',
        },
        // Warm dark
        cocoa: {
          900: '#1F1A17',
          800: '#2A2320',
          700: '#3A302B',
          600: '#4B403A',
          500: '#5E5048',
          400: '#7A6A60',
          300: '#9D8D82',
          200: '#C8BAB0',
          100: '#E8DED4',
        },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        'soft': '0 2px 12px -2px rgba(74, 56, 44, 0.08), 0 1px 3px -1px rgba(74, 56, 44, 0.06)',
        'glow': '0 4px 24px -6px rgba(212, 184, 154, 0.4)',
        'inner-soft': 'inset 0 1px 2px rgba(74, 56, 44, 0.06)',
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
