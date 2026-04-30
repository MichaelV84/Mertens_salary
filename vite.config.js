import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig(function () {
    var _a;
    var explicitBase = process.env.BASE_PATH;
    var repositoryName = (_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split("/")[1];
    var base = explicitBase || (repositoryName ? "/".concat(repositoryName, "/") : "/");
    return {
        base: base,
        plugins: [react()],
        test: {
            environment: "jsdom",
            setupFiles: "./src/test/setup.ts",
        },
    };
});
