import * as path from "path";
import * as url from "url";
import * as fs from "fs";
import { Alias } from "vite";
import * as packageJson from "./package.json";

// const __filename = url.fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

const rootPath = __dirname;

// TODO: read from tsconfig.json
const aliases = {
    // '$'
    "@": "./src"
};

function getSrcFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const res = path.resolve(dir, entry.name);
        return entry.isDirectory() ? getSrcFiles(res) : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [res] : [];
    });
}

const packages = [
    // ...Object.keys(packageJson["dependencies"] || {}),
    ...Object.keys(packageJson["peerDependencies"] || {})
];

export default {
    packages,
    resolveAliases: () => {
        return Object.fromEntries(Object.entries(aliases).map(([key, value]) => [key, path.resolve(rootPath, value)]));
        // return Object.entries(aliases).map(
        //     ([key, value]) =>
        //         ({
        //             find: key,
        //             replacement: path.resolve(rootPath, value)
        //             // replacement: url.fileURLToPath(new URL(value, import.meta.url))
        //         } as Alias)
        // );
    },
    srcFiles: () => getSrcFiles(path.resolve(__dirname, "src")),
    externals: (id: string) => {
        return packages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));
    }
};
