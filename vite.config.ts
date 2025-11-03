import { Alias, AliasOptions, defineConfig } from "vite";
import * as path from "path";
import config from "./config";
import dts from "vite-plugin-dts";
import * as fs from "fs";
import tsConfigPaths from "vite-tsconfig-paths";
import * as packageJson from "./package.json";

const rootPath = __dirname;

const packageName = packageJson.name.split("/").reverse()[0];

export default defineConfig({
    resolve: {
        alias: config.resolveAliases()
    },
    build: {
        outDir: "dist",
        lib: {
            // entry: path.resolve(rootPath, "src/index.ts"),
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
                // preserveEntrySignatures: "strict",
                format: "esm",
                entryFileNames: "[name].es.js" // mjs
                // inlineDynamicImports: false
            }
        },
        sourcemap: true
        // emptyOutDir: true
    },
    server: {
        port: 5173,
        open: "/tests/browser/index.html",
        fs: {
            strict: false
        }
    },
    esbuild: {
        // sourcemap: "inline",
        // target: "es2020",
    },
    plugins: [
        tsConfigPaths(),
        dts({
            outDir: "dist",
            entryRoot: "src",
            include: ["src/**/*.ts"],
            // many modules
            rollupTypes: false,
            insertTypesEntry: false
            // one module
            // rollupTypes: true,
            // insertTypesEntry: true
            // staticImport: true
        }),

        {
            name: "postBuild",
            closeBundle() {
                const excluded: string[] = [];
                for (let filePath of excluded) {
                    filePath = path.resolve(__dirname, filePath);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('Removed excluded:', filePath);
                    }
                }

                console.log("Use vite dedupe:", config.packages.join(", "));
                // const oldPath = path.resolve(__dirname, "dist", `${packageName}.d.ts`);
                // const newPath = path.resolve(__dirname, "dist", `index.d.ts`);
                // if (fs.existsSync(oldPath)) {
                //     fs.renameSync(oldPath, newPath);
                // }
            }
        }
    ]
});