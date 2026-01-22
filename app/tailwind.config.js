/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,vue}'
  ],
  theme: {
    extend: {
      colors: {
        'call-accept': '#8bc34a',
        'call-decline': '#e53935',
        'call-bg-dark': '#2a2e3d',
        'call-bg-darker': '#1e2130'
      }
    }
  },
  plugins: []
}
