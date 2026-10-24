import type { OxlintConfig } from "oxlint";

const config: OxlintConfig = {
  ignorePatterns: [
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".continue/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".pi/**",
    ".roo/**",
    ".windsurf/**",
    "tools/oxlint/anti-slop/**",
    ".turbo/**",
    "**/dist/**",
  ],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
  ],
  // These repository-wide anti-slop rules currently identify legacy cleanup
  // debt (hundreds of existing findings). Keep them visible as warnings while
  // native correctness rules and OXC safety rules remain blocking. The root
  // lint command sets a warning ceiling so this backlog cannot grow silently.
  rules: {
    "oxc/no-accumulating-spread": "error",
    "anti-slop/no-array-filter-map": "warn",
    "anti-slop/no-reduce-accumulator-copy": "warn",
    "anti-slop/no-chained-type-assertions": "warn",
    "anti-slop/no-conditional-empty-object-spread": "warn",
    "anti-slop/no-known-value-widening": "warn",
    "anti-slop/no-module-mocking": "warn",
    "anti-slop/no-object-parameters": "warn",
    "anti-slop/no-reflect-apply": "warn",
    "anti-slop/no-reflect-get": "warn",
    "anti-slop/no-runtime-typeof": "warn",
    "anti-slop/no-shape-in-symbol-names": "warn",
    "anti-slop/no-unknown-parameters": "warn",
    "anti-slop/no-unknown-returns": "warn",
    "anti-slop/no-unknown-type-aliases": "warn",
    "anti-slop/no-unsafe-dictionary-type": "warn",
    "anti-slop/no-widen-then-assert": "warn",
    "anti-slop/require-readable-spacing": "warn",
    "anti-slop/require-safety-comment-for-type-assertion": "warn",
  },
};

export default config;
