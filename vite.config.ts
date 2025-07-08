import { Alias, AliasOptions, defineConfig } from "vite";
import * as path from "path";
import config from "./config";
import react from "@vitejs/plugin-react-swc";
// import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import * as fs from "fs";
import { JsxEmit } from "typescript";
import tsConfigPaths from "vite-tsconfig-paths";
import * as packageJson from "./package.json";

// https://www.dev-notes.ru/articles/typescript/tsconfig-cheat-sheet/

const rootPath = __dirname;

const packageName = packageJson.name.split("/").reverse()[0];

export default defineConfig({
    // resolve: {
    //     alias: config.resolveAliases()
    // },
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
                globals: {
                    react: "React",
                    "react-dom": "ReactDOM",
                    lodash: "_"
                },
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
    plugins: [
        react({}),
        tsConfigPaths(),
        dts({
            outDir: "dist",
            entryRoot: "src",
            // include: ["./src/**/*.ts"]
            include: ["src"],
            // many modules
            rollupTypes: false,
            insertTypesEntry: false
            // one module
            // rollupTypes: true,
            // insertTypesEntry: true // ?

            // compilerOptions: {
            //     jsx: JsxEmit.ReactJSX
            // }
        }),
        {
            name: "postBuild",
            closeBundle() {
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
