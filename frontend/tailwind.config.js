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
      spacing: {
        128: '32rem',
        152: '38rem',
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
        ui: {
          back: 'hsl(156, 8%, 89%)',
          base: 'hsl(156, 15%, 94%)',
          front: 'hsl(155, 100%, 100%)',
          text: 'hsl(156, 27%, 4%)',
          'text-muted': 'hsl(156, 5%, 27%)',
          highlight: 'hsl(156, 100%, 99%)',
          border: 'hsl(156, 3%, 50%)',
          'border-muted': 'hsl(156, 4%, 61%)',
          primary: 'hsl(168, 100%, 11%)',
          secondary: 'hsl(329, 41%, 30%)',
          danger: 'hsl(9, 21%, 41%)',
          warning: 'hsl(52, 23%, 34%)',
          success: 'hsl(147, 19%, 36%)',
          info: 'hsl(217, 22%, 41%)',
        },
      },
      boxShadow: {
        glass: '0 20px 45px -20px rgba(15, 23, 42, 0.35)',
        'ui-0': 'inset 0px 2px 0px hsl(156, 100%, 99%), inset 0px -2px 0px rgba(0,0,0,7%), 0px 3px 5px rgba(0,0,0,10%)',
        'ui-1': 'inset 0px 2px 0px hsl(156, 100%, 99%), inset 0px -2px 0px rgba(0,0,0,7%), 0px 1px 5px rgba(0,0,0,10%)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
    require('@tailwindcss/typography'),
  ],
}
