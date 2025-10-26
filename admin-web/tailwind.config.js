/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          primary: '#1f2937',
          secondary: '#374151',
          accent: '#3b82f6',
          danger: '#dc2626',
          warning: '#f59e0b',
          success: '#10b981',
          background: '#f9fafb',
          surface: '#ffffff',
          border: '#e5e7eb'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}

