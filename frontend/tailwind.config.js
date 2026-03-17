export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ibbiBlue: '#0b4dbf',
        ibbiGold: '#c9a227',
        ibbiNavy: '#0a1f44',
        ibbiCream: '#f7f3ea'
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(10, 31, 68, 0.12)'
      }
    },
  },
  plugins: [],
};
