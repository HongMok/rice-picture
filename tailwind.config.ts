import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#2b2622', // 暖黑（带一点棕）
          soft: '#5c534b',
          muted: '#8a7f74',
        },
        cream: {
          DEFAULT: '#fcfbf8', // 暖白底
          card: '#ffffff',
          line: '#ece7df', // 暖色细边框
        },
        // 低饱和暖色强调（不刺眼、不塑料）
        clay: {
          DEFAULT: '#e08a5b', // 暖陶橙
          soft: '#f5e6dc',
        },
        sage: {
          DEFAULT: '#7fa27e', // 柔绿
          soft: '#e6ede4',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43,38,34,0.04), 0 8px 24px rgba(43,38,34,0.06)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
