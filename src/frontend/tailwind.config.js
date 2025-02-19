/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      'backgroundColor': {
        'primary': 'rgba(24,26,32,1)',
        'secondary': 'rgba(11,14,17,1)'
      },
      scrollbar: {
        thumb: 'bg-sky-500',
        track: 'bg-sky-300',
      }
    },
  },
  plugins: [],
};
