import { describe, it, expect, vi } from "vitest";
import { TestBusStruct, createTestMsgBus, sharedMsgBus } from "./testDomain";
import "@/msgBusFactory";
import { delayAsync, delayErrorAsync, withTimeoutAsync } from "@actdim/utico/utils";
import { v4 as uuid } from "uuid";

describe("msgBus", () => {
    // process.on("unhandledRejection", (reason, promise) => {
    //     console.error("Unhandled Rejection at:", promise, "reason:", reason);
    //     process.exit(1);
    // });

    // window.onerror = (message, source, lineno, colno, error) => {
    //     console.error("Caught error:", error);
    // };

    // window.onunhandledrejection = (event) => {
    //     console.error("Unhandled rejection:", event.reason);
    // };

    const timeout = 100;
    const testData: (TestBusStruct["Test.ComputeSum"]["in"] & { id: string })[] = [
        {
            a: Math.floor(Math.random() * 100),
            b: Math.floor(Math.random() * 100),
            id: "0"
        },
        {
            a: Math.floor(Math.random() * 100),
            b: Math.floor(Math.random() * 100),
            id: "1"
        },
        {
            a: Math.floor(Math.random() * 100),
            b: Math.floor(Math.random() * 100),
            id: "2"
        },
        {
            a: Math.floor(Math.random() * 100),
            b: Math.floor(Math.random() * 100),
            id: "3"
        }
    ];

    const computeSum = (payload: TestBusStruct["Test.ComputeSum"]["in"]) => {
        return payload.a + payload.b;
    };

    const stream = async () => {
        for (let i = 0; i < 1000; i++) {
            // Task.Yield:
            // await Promise.resolve();
            await new Promise((resolve) => setTimeout(resolve, 0));
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: {
                    a: Math.floor(Math.random() * 100),
                    b: Math.floor(Math.random() * 100)
                }
            });
        }
    };

    sharedMsgBus.provide({
        channel: "Test.ComputeSum",
        topic: "/.*/",
        callback: (msg) => {
            return computeSum(msg.payload);
        }
    });

    it("can dispatchAsync", async () => {
        let done = false;
        sharedMsgBus.provide({
            channel: "Test.DoSomeWork",
            // topic: "/.*/",
            group: "in",
            callback: async (msg) => {
                await delayAsync(30);
                // done = true;
                await (async () => {
                    await delayAsync(30);
                    done = true;
                })();
            }
        });

        let test = (async () => {
            const msg = await sharedMsgBus.dispatchAsync({
                channel: "Test.DoSomeWork"
            });
            expect(done).toBe(true);
        })();

        await Promise.race([delayErrorAsync(timeout), Promise.all([stream, test])]);
    });

    it("can use throttling", async () => {
        let c = 0;

        const msgBus = createTestMsgBus();
                
        msgBus.on({
            channel: "Test.DoSomeWork",
            // topic: "/.*/",
            group: "in",
            callback: async (msg) => {
                c++;
            }, 
            config: {
                throttle: {
                    duration: 10,
                    leading: true,
                    trailing: true,
                }
            }
        });

        let test = (async () => {
            for (let i = 0; i < 100; i++) {
                msgBus.dispatch({
                    channel: "Test.DoSomeWork"                    
                })
            }
        })();

        await test;
        await delayAsync(timeout);
        expect(c).toBe(2);
    });

    it("can dispatchAsync with result", async () => {
        const data = testData[0];
        let result: number; // Msg<TestBusStruct, "Test.ComputeSum", "out">
        let test = (async () => {
            const msg = await sharedMsgBus.dispatchAsync({
                channel: "Test.ComputeSum",
                payload: data
            });
            result = msg.payload;
        })();

        await Promise.race([delayErrorAsync(timeout), Promise.all([stream, test])]);
        expect(result).toBe(computeSum(data));
    });

    it("can dispatch", async () => {
        const data = testData[0];
        let result: number;
        const test = new Promise<number>((res, rej) => {
            let c = 0;
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: data,
                callback: (msg) => {
                    c++;
                    if (c > 1) {
                        rej("Unexpected call");
                    }
                    // res(msg.payload);
                    result = msg.payload;
                }
            });

            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[3],
            });
        });

        await Promise.race([delayAsync(timeout), Promise.all([stream, test])]);
        expect(result).toBe(computeSum(data));
    });

    it("can subscribe using 'on'", async (ctx) => {
        const mockCallback = vi.fn();
        // expect(mockCallback).toHaveBeenCalledWith('done');

        const test = new Promise<number>((res, rej) => {
            let c = 0;
            sharedMsgBus.on({
                channel: "Test.ComputeSum",
                callback: (msg) => {
                    c++;
                    if (c == 6) {
                        res(c);
                    }
                }
            });

            sharedMsgBus.on({
                channel: "Test.ComputeSum",
                group: "out",
                callback: (msg) => {
                    c++;
                    if (c == 6) {
                        res(c);
                    }
                }
            });

            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[0]
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[1]
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[2]
            });
        });

        // const result = await withTimeoutAsync(test, timeout);
        const result = await Promise.race([delayErrorAsync(timeout), test]);
        expect(result).toBe(6);
    });

    it("can subscribe to topic using 'on'", async (ctx) => {
        const mockCallback = vi.fn();
        // expect(mockCallback).toHaveBeenCalledWith('done');

        let c = 0;
        const test = new Promise<number>((res, rej) => {
            sharedMsgBus.on({
                channel: "Test.ComputeSum",
                topic: "test",
                callback: (msg) => {
                    c++;
                }
            });

            sharedMsgBus.on({
                channel: "Test.ComputeSum",
                topic: "test",
                group: "out",
                callback: (msg) => {
                    c++;
                }
            });

            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[0]
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[1]
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[2]
            });

            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                topic: "test",
                payload: testData[0],
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                topic: "test",
                payload: testData[1],
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                topic: "test",
                payload: testData[2]
            });
        });

        // const result = await withTimeoutAsync(test, timeout);
        const result = await Promise.race([delayAsync(timeout * 10), test]);
        expect(c).toBe(6);
    });

    it("can subscribe using 'on' and config", async (ctx) => {
        let cIn = 0;
        let cOut = 0;
        const test = new Promise<void>((res, rej) => {
            sharedMsgBus.on({
                channel: "Test.ComputeSum",
                callback: (msg) => {
                    cIn++;
                    if (cIn > 1) {
                        rej("On 'In': extra calls");
                    }
                },
                config: { fetchCount: 1 }
            });

            sharedMsgBus.on({
                channel: "Test.ComputeSum",
                group: "out",
                callback: (msg) => {
                    cOut++;
                    if (cOut > 1) {
                        rej("On 'Out': extra calls");
                    }
                    const data = testData.filter((item) => item.id == msg.headers.correlationId)[0];
                    if (msg.payload != computeSum(data)) {
                        rej("On 'Out': wrong payload");
                    }
                },
                config: { fetchCount: 1 }
            });

            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[0],
                headers: {
                    correlationId: testData[0].id
                }
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[1],
                headers: {
                    correlationId: testData[1].id
                }
            });
            sharedMsgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: testData[2],
                headers: {
                    correlationId: testData[2].id
                }
            });
        });

        const result = await Promise.race([delayAsync(timeout), test]);
        expect(cIn + cOut).toBe(2);
    });

    it("can subscribe using 'onceAsync'", async (ctx) => {
        let data = testData[0];
        const test = async () => {
            const msgIn = await sharedMsgBus.onceAsync({
                channel: "Test.ComputeSum"
            });

            const msgId = msgIn.id;
            expect(msgIn.headers.correlationId).toBe(data.id);
            expect(msgIn.payload.a).toBe(data.a);
            expect(msgIn.payload.b).toBe(data.b);

            const msgOut = await sharedMsgBus.onceAsync({
                channel: "Test.ComputeSum",
                group: "out"
            });

            expect(msgOut.headers.requestId).toBe(msgId);
            expect(msgOut.headers.correlationId).toBe(data.id);
            expect(msgOut.payload).toBe(computeSum(data));
        };

        sharedMsgBus.dispatch({
            channel: "Test.ComputeSum",
            payload: data,
            headers: {
                correlationId: data.id
            }
        });

        const result = await Promise.race([delayAsync(timeout), test]);
    });

    it("can cancel sub", async (ctx) => {
        let data = testData[0];
        let c = 0;
        const abortController = new AbortController();
        // const msgBus = createTestMsgBus();
        const msgBus = sharedMsgBus;

        const cutoff = Date.now();
        const correlationId = uuid();
        msgBus.on({
            channel: "Test.ComputeSum",
            callback: (msg) => {
                // msg.headers.publishedAt >= cutoff
                if (msg.headers.correlationId === correlationId) {
                    c++;
                }
            },
            config: {
                abortSignal: abortController.signal
            }
        });

        msgBus.dispatch({
            channel: "Test.ComputeSum",
            payload: data,
            headers: {
                correlationId
            }
        });

        await delayAsync(timeout);
        abortController.abort();

        msgBus.dispatch({
            channel: "Test.ComputeSum",
            payload: data,
            headers: {
                correlationId
            }
        });

        expect(c).toBe(1);
    });

    it("can cancel async sub", async (ctx) => {
        let data = testData[0];
        let c = 0;
        const abortController = new AbortController();
        let err = undefined;
        const reason = "cancelled";
        const msgBus = createTestMsgBus();
        // const msgBus = sharedMsgBus;
        const listen = (async () => {
            try {
                await msgBus.onceAsync({
                    channel: "Test.ComputeSum",
                    config: {
                        abortSignal: abortController.signal
                    }
                });
                c++;
            } catch (e) {
                err = e;
            }
        })();

        await delayAsync(100);
        abortController.abort(reason);
        const emit = (async () => {
            msgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: data,
            });
            msgBus.dispatch({
                channel: "Test.ComputeSum",
                payload: data,
            });
        })();
        await Promise.race([Promise.all([listen, emit]), delayAsync(timeout)]);
        expect(c).toBe(0);
        expect(err).toBeDefined();
        expect((err as Error).cause).toBe(reason);
    });
});