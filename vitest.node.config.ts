import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";
import { resolve } from 'path';
import config from "./config";

export default defineConfig({
    test: {
        watch: false,
        reporters: 'verbose',
        name: "node",
        globals: true,
        setupFiles: [
            resolve('./vitest.setup.ts')
        ],
        // In watch mode you can keep the debugger open during test re-runs by using the --isolate false options.
        isolate: false,
        // pool: "threads"
        pool: "forks", // for debug
        environment: 'node',
        include: ["tests/**/*.{test,spec}.ts"],
        includeSource: ["src/**/*.ts"],
        typecheck: {
            tsconfig: 'tsconfig.vitest.json',
        },
        root: resolve('.'),
    },
    resolve: {
        alias: config.resolveAliases()
    },
    plugins: [
        // tsConfigPaths(),
    ],
    base: "./",
});
