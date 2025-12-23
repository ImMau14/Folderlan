/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'selector',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Kanit SemiBold'],
        body: ['Inter Variable'],
      },
      colors: {
        brand: {
          50: '#fffbea',
          100: '#fff4cf',
          200: '#fee6a8',
          300: '#fcd97c',
          400: '#f9c956',
          500: '#f2b63c',
          600: '#d99a2c',
          700: '#b77a1f',
          800: '#955f16',
          900: '#7a4c12',
        },
      },
      boxShadow: {
        glass: '0 20px 45px -20px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
    require('@tailwindcss/typography'),
  ],
}
