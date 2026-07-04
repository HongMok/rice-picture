import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', '"Noto Sans SC"', '"PingFang SC"', 'sans-serif'],
        serif: ['"Noto Serif SC"', '"Songti SC"', 'serif'],
      },
      colors: {
        // design-skill.md（Japandi 治愈风）唯一视觉基准 token
        paper: {
          DEFAULT: '#FAF7F2',
          deep: '#F3F0E9',
        },
        card: '#FFFFFF',
        sand: '#E8E2D6',
        line: '#EDE8DF',
        ink: {
          DEFAULT: '#3E3A36',
          soft: '#8A857D',
          faint: '#A8A296',
        },
        sage: {
          DEFAULT: '#8FA98F',
          deep: '#6E8A6E',
          mist: '#EAF0E8',
        },
        water: {
          DEFAULT: '#6D8B90',
          mist: '#E7EEEF',
        },
        // 主色调：小禾绿（原 clay 别名保留，避免历史组件全量替换）
        clay: {
          DEFAULT: '#7FA98B',
          deep: '#5E8A6E',
          mist: '#E8F1E9',
        },
        // 陶土暖色：Japandi 里少量点缀（HOT/新品等语义色），保持低饱和
        ember: {
          DEFAULT: '#C97A5B',
          deep: '#A65F44',
          mist: '#F5E5DC',
        },
      },
      borderRadius: {
        btn: '999px',
        card: '18px',
        section: '24px',
        input: '12px',
      },
      transitionDuration: {
        DEFAULT: '450ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-out',
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
        breathe: {
          '0%,100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        float: 'float 4s ease-in-out infinite',
        breathe: 'breathe 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
