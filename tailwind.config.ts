import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{html,ts}',
    './src/index.html',
    './src/main.ts'
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
