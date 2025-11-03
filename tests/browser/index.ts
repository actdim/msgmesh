/// <reference types="vite/client" />
/// <reference types="mocha" />
/// <reference types="chai" />

// declare interface ImportMeta {
//   glob(pattern: string, options?: any): Record<string, () => Promise<any>>;
//   globEager(pattern: string, options?: any): Record<string, any>;
// }

mocha.setup("bdd");

import 'mocha/mocha.css';
import 'mocha/mocha.js';

// await import('../example.t.ts');
const modules = import.meta.glob('../*.t.ts');
for (const path in modules) {
    await modules[path]();
}

mocha.run();

// const testRun = new Promise<number>((resolve) => {
//     mocha.run(
//         // (failures) => {
//         //     if (failures) {
//         //         throw new Error(`${failures} Mocha tests failed`);
//         //     }
//         //     resolve(failures);
//         // }
//     )
//         .on('end', function () {
//             resolve(this.failures);
//         });
// });