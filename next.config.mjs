import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // لو فيه package-lock.json في فولدر أعلى، Next بيفتكر إنه الـroot وبيحط standalone في فولدر فرعي
  // فالـdeploy ما يلاقيش server.js — بنثبّت الـroot على فولدر المشروع نفسه
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  poweredByHeader: false,
  output: "standalone",
  // استيراد نسخة النظام السابق ممكن يكون كبير
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default nextConfig;
