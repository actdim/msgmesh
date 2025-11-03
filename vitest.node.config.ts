import { defineConfig, TestProjectConfiguration } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";
import { resolve } from 'path';
import config from "./config";
import fs from "fs";
import path from "path";

export default defineConfig({
    test: {
        watch: false,
        reporters: 'verbose',
        // coverage: {
        //     enabled: false
        // },
        // do not use projects!
        // projects: [],
        name: "node",
        globals: true,
        setupFiles: [
            // './vitest.setup.ts'
            resolve('./vitest.setup.ts')
        ],
        // In watch mode you can keep the debugger open during test re-runs by using the --isolate false options.
        isolate: false,
        // pool: "threads"
        pool: "forks", // for debug
        // restoreMocks: true,
        // clearMocks: true,
        environment: 'node',
        include: ["tests/**/*.{test,spec}.ts"],
        includeSource: ["src/**/*.ts"],
        typecheck: {
            tsconfig: 'tsconfig.vitest.json',
        },
        root: resolve('.'),
    },
    esbuild: {
        // sourcemap: "external",
        // sourcemap: "inline",
        // target: "es2020",
    },
    resolve: {
        alias: config.resolveAliases()
        // alias: [{ find: "@", replacement: resolve(__dirname, "./src") }]
    },
    plugins: [
        // tsConfigPaths(),
        // {
        //     name: "dump-maps",
        //     async transform(code, id) {
        //         if (id.endsWith(".ts")) {
        //             const mapPath = path.resolve(".vitest", path.basename(id) + ".map");
        //             fs.mkdirSync(path.dirname(mapPath), { recursive: true });
        //             const map = this.getCombinedSourcemap?.();
        //             if (map) fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
        //         }
        //         return null;
        //     },
        // },
    ],
    base: "./",
});
