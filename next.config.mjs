/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // subset-font 依赖 harfbuzz wasm，需作为外部包在运行时用 Node 加载，避免被 webpack 打包
    serverComponentsExternalPackages: ['subset-font'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.aliyuncs.com' },
      { protocol: 'https', hostname: 'dashscope-result-*.oss-*.aliyuncs.com' },
    ],
  },
};

export default nextConfig;
