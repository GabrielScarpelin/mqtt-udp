import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["cjs", "esm"], // Construir para commonJS e ESmodules
  dts: true, // Gerar arquivo de declaração (.d.ts)
  splitting: false,
  sourcemap: true,
  clean: true,
});
