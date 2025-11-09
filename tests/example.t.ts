/// <reference types="mocha" />
/// <reference types="chai" />

import "./mocha"
// import "mocha";

import { expect } from "chai";

describe("Mocha example", () => {
    it("should work", async () => {
        expect({}).to.exist;
        // expect({}}).to.undefined;
    });
});