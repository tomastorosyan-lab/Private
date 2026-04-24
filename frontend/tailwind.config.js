/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        display: [
          '2rem',
          { lineHeight: '1.25', letterSpacing: '-0.025em', fontWeight: '600' },
        ],
        'display-lg': [
          '2.5rem',
          { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '600' },
        ],
      },
      colors: {
        primary: {
          DEFAULT: '#206676',
          foreground: '#ffffff',
          light: '#e6f1f3',
          dark: '#19535f',
          muted: '#c4dde2',
        },
        secondary: {
          DEFAULT: '#059669',
          light: '#d1fae5',
          dark: '#047857',
        },
      },
      boxShadow: {
        surface:
          '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'surface-md':
          '0 4px 6px -1px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.05)',
      },
    },
  },
  plugins: [],
}
