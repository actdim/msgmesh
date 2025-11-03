
import mocha from "./index"
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll, test } from "vitest";

test('Mocha tests', async () => {    
    mocha.run((failures) => {
        // process.exitCode = failures ? 1 : 0;            
        if (failures > 0) {
            console.error(`${failures} Mocha tests failed`);
        } else {
            console.log('All Mocha tests passed');
        }
    });
});

