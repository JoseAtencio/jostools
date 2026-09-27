/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jostools/firebase-config"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
