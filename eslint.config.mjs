import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 외부 작업물/워크트리/도구 폴더는 lint 대상에서 제외
    ".claude/**",
    "추가 작업물/**",
    "**/추가 작업물/**",
  ]),
]);

export default eslintConfig;
