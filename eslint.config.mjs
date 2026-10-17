import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import accessibility from "eslint-plugin-jsx-a11y";
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".next-test/**",
      ".postgres/**",
      "output/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
      "YekanBakh*/**",
      "data/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "tests/**/*.ts", "*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { "react-hooks": hooks, "jsx-a11y": accessibility },
    rules: {
      ...hooks.configs.recommended.rules,
      ...accessibility.configs.recommended.rules,
    },
  },
);
