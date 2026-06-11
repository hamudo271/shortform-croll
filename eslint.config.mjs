import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // 전역 무시: 외부 작업물/빌드/도구 폴더는 lint 대상 아님 (반드시 최상단 독립 블록)
  {
    ignores: [
      ".next/**",
      "**/.next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".claude/**",
      "**/추가 작업물/**",
      "추가 작업물/**",
      "**/추가 작업물/",
    ],
  },
  ...nextVitals,
  ...nextTs,
]);

export default eslintConfig;
