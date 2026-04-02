import type { NextConfig } from "next";

// 회사 네트워크 프록시의 자체 서명 인증서 허용 (개발 환경 한정)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const nextConfig: NextConfig = {};

export default nextConfig;
