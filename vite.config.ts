import {
  antipattern,
  correctness,
  effectNative,
  recommended,
  style,
} from "@effect/tsgo/oxlint-presets"
import { defineConfig } from "vite-plus"

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    semi: false,
  },
  lint: {
    ignorePatterns: [".direnv"],
    extends: [recommended, antipattern, correctness, effectNative, style],
    plugins: ["typescript"],
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "effecttsgo/deterministic-keys": "off",
      "eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        // A test provides its layers itself: each test is an entry point.
        files: ["**/test/**"],
        rules: { "effecttsgo/strict-effect-provide": "off" },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  run: {
    cache: true,
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: [
            "apps/*/test/**/*.test.ts",
            "packages/*/test/**/*.test.ts",
            "tools/*/test/**/*.test.ts",
          ],
          exclude: [".direnv", "**/node_modules/**"],
        },
      },
    ],
  },
})
