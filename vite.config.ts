import { defineConfig } from "vite";
import config from "./config";
import dts from "vite-plugin-dts";
import tsConfigPaths from "vite-tsconfig-paths";
import * as packageJson from "./package.json";

const packageName = packageJson.name.split("/").reverse()[0];

export default defineConfig({
    resolve: {
        alias: config.resolveAliases()
    },
    build: {
        outDir: "dist",
        lib: {
            entry: "./src/index.ts",
            // name: packageName,
            formats: ["es"],
            fileName: (format) => `${packageName}.${format}.js`
        },
        rollupOptions: {
            input: config.srcFiles(),
            external: config.externals,
            output: {
                exports: "named",
                preserveModules: true,
                preserveModulesRoot: "src",
                format: "esm",
                entryFileNames: "[name].es.js" // mjs                
            }
        },
        sourcemap: true
    },
    server: {
        port: 5173,
        open: "/tests/browser/index.html",
        fs: {
            strict: false
        }
    },
    plugins: [
        tsConfigPaths(),
        dts({
            outDir: "dist",
            entryRoot: "src",
            include: ["src/**/*.ts"],
            rollupTypes: false,
            insertTypesEntry: false
        }),

        {
            name: "postBuild",
            closeBundle() {
                console.log("Use vite dedupe:", config.packages.join(", "));
            }
        }
    ]
});