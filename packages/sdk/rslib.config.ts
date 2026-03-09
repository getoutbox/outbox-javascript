import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: true,
      dts: true,
    },
    {
      format: "cjs",
      bundle: true,
      dts: false,
    },
  ],
  source: {
    entry: {
      index: "./src/index.ts",
    },
    tsconfigPath: "./tsconfig.lib.json",
  },
  output: {
    target: "web",
  },
});
