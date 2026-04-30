import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  const explicitBase = process.env.BASE_PATH;
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const base = explicitBase || (repositoryName ? `/${repositoryName}/` : "/");

  return {
    base,
    plugins: [react()],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
