import Mocha from 'mocha';
const mocha = new Mocha({ ui: 'bdd', timeout: 5000 });

await import('./example.t');
// const modules = import.meta.glob('./*.t.ts');
// for (const path in modules) {
//     await modules[path]();
// }

export default mocha;