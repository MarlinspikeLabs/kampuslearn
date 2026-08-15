/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './context/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: '#2563eb', dark: '#1d4ed8', light: '#3b82f6' },
        secondary: { DEFAULT: '#7c3aed', dark: '#6d28d9', light: '#8b5cf6' },
        success:   '#16a34a',
        warning:   '#d97706',
        danger:    '#dc2626',
        muted:     '#64748b',
      },
    },
  },
  plugins: [],
};
