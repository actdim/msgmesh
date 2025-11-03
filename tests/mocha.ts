/// <reference types="mocha" />
const ctx = globalThis as any;
export const describe: Mocha.SuiteFunction = ctx.describe;
export const it: Mocha.TestFunction = ctx.it;
export const before: Mocha.HookFunction = ctx.before;
export const after: Mocha.HookFunction = ctx.after;