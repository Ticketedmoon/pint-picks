import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/firebase.ts",
        "src/lib/firestore.ts",
        "src/lib/resend.ts",
        "src/lib/usePageView.ts",
        "src/lib/sports/types.ts",
        "src/lib/sports/index.ts",
        "src/lib/sports/golf/index.ts",
        "src/lib/sports/football/index.ts",
        "src/lib/sports/football/types.ts",
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
