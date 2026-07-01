import { describe, it, expect, vi } from "vitest";
import { TestBusStruct, createTestMsgBus, sharedMsgBus } from "./testDomain";
import "@/core";
import { delay, delayError, withTimeout } from "@actdim/utico/utils";
import { v4 as uuid } from "uuid";
import { MsgHeaders, MsgStruct, NoProviderError, OperationCanceledError, TimeoutError } from "@/contracts";
import { createMsgBus } from "@/core";
import { BaseServiceSuffix, getMsgChannelSelector, MsgProviderAdapter, registerAdapters, ToMsgChannelPrefix, ToMsgStruct } from "@/adapters";
import { getGlobalFlags } from "@/globals";

getGlobalFlags().debug = true;

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
            sharedMsgBus.send({
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

    it("can subscribe", async () => {
        let c = 0;
        const msgBus = createTestMsgBus();
        msgBus.on({
            channel: "Test.DoSomeWork",
            callback: async (msg) => {
                c++;
            }
        });

        msgBus.send({
            channel: "Test.DoSomeWork",
            group: 'in'
        })
        await delay(timeout);
        expect(c).toBe(1);
    });

    it("can request without result", async () => {
        let done = false;
        sharedMsgBus.provide({
            channel: "Test.DoSomeWork",
            // topic: "/.*/",
            callback: async (msg) => {
                await delay(30);
                // done = true;
                await (async () => {
                    await delay(30);
                    done = true;
                })();
            }
        });

        let test = (async () => {
            const requestId = uuid();
            const msg = await sharedMsgBus.request({
                channel: "Test.DoSomeWork",
                headers: {
                    sourceId: requestId
                }
            });
            expect(done).toBe(true);
        })();

        await Promise.race([delayError(timeout), Promise.all([stream, test])]);
    });

    it("can use throttling", async () => {
        let c = 0;

        const msgBus = createTestMsgBus();
        // const msgBus = sharedMsgBus;

        msgBus.on({
            channel: "Test.DoSomeWork",
            // topic: "/.*/",
            callback: async (msg) => {
                c++;
            },
            options: {
                throttle: {
                    duration: 10,
                    leading: true,
                    trailing: true,
                }
            }
        });

        let test = (async () => {
            for (let i = 0; i < 100; i++) {
                msgBus.send({
                    channel: "Test.DoSomeWork"
                })
            }
        })();

        await test;
        await delay(timeout);
        expect(c).toBe(2);
    });

    it("can use timeout", async () => {
        let c = 0;

        const msgBus = createTestMsgBus();

        let test = (async () => {
            const requestId = uuid();
            await msgBus.request({
                channel: "Test.DoSomeWork",
                options: {
                    timeout: 50
                },
                headers: {
                    sourceId: requestId
                }
            });
        });

        // expect(() => {
        // }).toThrow();

        // +toThrow
        // +toMatchObject
        // +toHaveProperty
        await expect(test).rejects.toBeInstanceOf(TimeoutError);
    });

    it("can request", async () => {
        const data = testData[3];
        let result: number;
        let responseMsgHeaders: MsgHeaders;
        const requestId = uuid();
        let request = (async () => {
            const msg = await sharedMsgBus.request({
                channel: "Test.ComputeSum",
                payload: data,
                headers: {
                    sourceId: requestId
                }
            });
            result = msg.payload;
            responseMsgHeaders = msg.headers;
        })();

        await Promise.race([delayError(timeout), Promise.all([stream, request])]);
        expect(result).toBe(computeSum(data));
        expect(responseMsgHeaders.sourceId).toBe(requestId);
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

            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[0]
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[1]
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[2]
            });
        });

        // const result = await withTimeout(test, timeout);
        const result = await Promise.race([delayError(timeout), test]);
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

            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[0]
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[1]
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[2]
            });

            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                topic: "test",
                payload: testData[0],
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                topic: "test",
                payload: testData[1],
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                topic: "test",
                payload: testData[2]
            });
        });

        // const result = await withTimeout(test, timeout);
        const result = await Promise.race([delay(timeout * 10), test]);
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
                options: { fetchCount: 1 }
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
                options: { fetchCount: 1 }
            });

            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[0],
                headers: {
                    correlationId: testData[0].id
                }
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[1],
                headers: {
                    correlationId: testData[1].id
                }
            });
            sharedMsgBus.send({
                channel: "Test.ComputeSum",
                payload: testData[2],
                headers: {
                    correlationId: testData[2].id
                }
            });
        });

        const result = await Promise.race([delay(timeout), test]);
        expect(cIn + cOut).toBe(2);
    });

    it("can subscribe using 'onceAsync'", async (ctx) => {
        let data = testData[0];
        const test = async () => {
            const inMsg = await sharedMsgBus.once({
                channel: "Test.ComputeSum"
            });

            const msgId = inMsg.id;
            expect(inMsg.headers.correlationId).toBe(data.id);
            expect(inMsg.payload.a).toBe(data.a);
            expect(inMsg.payload.b).toBe(data.b);

            const outMsg = await sharedMsgBus.once({
                channel: "Test.ComputeSum",
                group: "out"
            });

            expect(outMsg.headers.requestId).toBe(msgId);
            expect(outMsg.headers.correlationId).toBe(data.id);
            expect(outMsg.payload).toBe(computeSum(data));
        };

        sharedMsgBus.send({
            channel: "Test.ComputeSum",
            payload: data,
            headers: {
                correlationId: data.id
            }
        });

        const result = await Promise.race([delay(timeout), test]);
    });

    it("can cancel sub", async (ctx) => {
        let data = testData[0];
        let c = 0;
        const abortController = new AbortController();
        const msgBus = createTestMsgBus();
        // const msgBus = sharedMsgBus;

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
            options: {
                abortSignal: abortController.signal
            }
        });

        msgBus.send({
            channel: "Test.ComputeSum",
            payload: data,
            headers: {
                correlationId
            }
        });

        await delay(timeout);
        abortController.abort();

        msgBus.send({
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
        const reason = "canceled";
        const msgBus = createTestMsgBus();
        // const msgBus = sharedMsgBus;
        const listen = (async () => {
            try {
                await msgBus.once({
                    channel: "Test.ComputeSum",
                    options: {
                        abortSignal: abortController.signal
                    }
                });
                c++;
            } catch (e) {
                err = e;
            }
        })();

        await delay(100);
        abortController.abort(reason);
        const emit = (async () => {
            msgBus.send({
                channel: "Test.ComputeSum",
                payload: data,
            });
            msgBus.send({
                channel: "Test.ComputeSum",
                payload: data,
            });
        })();
        await Promise.race([Promise.all([listen, emit]), delay(timeout)]);
        expect(c).toBe(0);
        expect(err).toBeDefined();
        expect((err as Error).cause).toBe(reason);
    });

    it("can repeat messages", async (ctx) => {

        const replayBufferSize = 5;
        const msgBus = createTestMsgBus({
            "Test.TestTaskWithRepeat": {
                replayBufferSize,
                replayWindowTime: Infinity

            }
        });
        // const msgBus = sharedMsgBus;
        let c = 0;
        for (let i = 0; i < replayBufferSize * 2; i++) {
            msgBus.send({
                channel: "Test.TestTaskWithRepeat",
                payload: i.toString()
            });
        }
        await delay(timeout);
        const listen = new Promise<void>((res, rej) => {
            msgBus.on({
                channel: "Test.TestTaskWithRepeat",
                callback: () => {
                    c++;
                }
            });
        });

        await Promise.race([listen, delay(timeout)]);
        expect(c).toBe(replayBufferSize);
    });

    it("can limit fetch count", async (ctx) => {

        const msgBus = createTestMsgBus();
        let c = 0;
        let n = 10;
        let fetchCount = 5;
        const listen = new Promise<void>((res, rej) => {
            msgBus.on({
                channel: "Test.TestTaskWithRepeat",
                callback: () => {
                    c++;
                },
                options: {
                    fetchCount
                }
            });
        });

        for (let i = 0; i < n; i++) {
            msgBus.send({
                channel: "Test.TestTaskWithRepeat",
                payload: i.toString()
            });
        }

        await Promise.race([listen, delay(timeout)]);
        expect(c).toBe(fetchCount);
    });

    it("can use topics", async (ctx) => {

        const msgBus = createTestMsgBus();
        let i1 = Math.round(Math.random() * 100);
        let i2 = Math.round(Math.random() * 100);
        let o1 = 0;
        let o2 = 0;
        let o = 0;

        const listenAll = new Promise<void>((res, rej) => {
            msgBus.on({
                channel: "Test.DoSomeWork",
                topic: "/foo|bar/",
                callback: () => {
                    o++;
                },

            });
        });

        const listen1 = new Promise<void>((res, rej) => {
            msgBus.on({
                channel: "Test.DoSomeWork",
                topic: "/^foo.*$/",
                callback: () => {
                    o1++;
                },

            });
        });
        const listen2 = new Promise<void>((res, rej) => {
            msgBus.on({
                channel: "Test.DoSomeWork",
                topic: "/^bar.*$/",
                callback: () => {
                    o2++;
                },

            });
        });

        const emit1 = new Promise<void>((res, rej) => {
            for (let i = 0; i < i1; i++) {
                msgBus.send({
                    channel: "Test.DoSomeWork",
                    topic: "foo" + i,
                    payload: i.toString()
                });
            }
        });

        const emit2 = new Promise<void>((res, rej) => {
            for (let i = 0; i < i2; i++) {
                msgBus.send({
                    channel: "Test.DoSomeWork",
                    topic: "bar" + i,
                    payload: i.toString()
                });
            }
        });

        await Promise.race([Promise.all([listenAll, listen1, listen2, emit1, emit2]), delay(timeout)]);
        expect(o1).toBe(i1);
        expect(o2).toBe(i2);
        expect(o).toBe(i1 + i2);
    });

    it("can multiplex", async (ctx) => {

        const msgBus = createTestMsgBus();

        let m = 0
        let i1 = Math.round(Math.random() * 100);
        let i2 = Math.round(Math.random() * 100);
        let o1 = 0;
        let o2 = 0;

        const multiplex = new Promise<void>((res, rej) => {
            msgBus.on({
                channel: "Test.Multiplexer",
                group: "out",
                callback: () => {
                    m++;
                }
            });
        });


        const provide1 = new Promise<void>((res, rej) => {
            msgBus.provide({
                channel: "Test.Multiplexer",
                group: "in1",
                callback: () => {
                    return o1++;
                }
            });
        });

        const provide2 = new Promise<void>((res, rej) => {
            msgBus.provide({
                channel: "Test.Multiplexer",
                group: "in2",
                callback: () => {
                    return o2++;
                }
            });
        });

        const emit1 = new Promise<void>((res, rej) => {
            for (let i = 0; i < i1; i++) {
                msgBus.send({
                    channel: "Test.Multiplexer",
                    group: "in1",
                    payload: i.toString()
                });
            }
        });

        const emit2 = new Promise<void>((res, rej) => {
            for (let i = 0; i < i2; i++) {
                msgBus.send({
                    channel: "Test.Multiplexer",
                    group: "in2",
                    payload: i
                });
            }
        });

        await Promise.race([Promise.all([multiplex, provide1, provide2, emit1, emit2]), delay(timeout)]);
        expect(o1).toBe(i1);
        expect(o2).toBe(i2);
        expect(m).toBe(i1 + i2);
    });

    it("can stream messages", async () => {
        const msgBus = createTestMsgBus();
        const receivedMessages: number[] = [];
        const messageCount = 10;

        // Start streaming in background
        const streamTask = (async () => {
            const messageStream = msgBus.stream({
                channel: "Test.ComputeSum",
                group: "out",
                options: {
                    fetchCount: messageCount
                }
            });

            for await (const msg of messageStream) {
                receivedMessages.push(msg.payload);
            }
        })();

        // Set up provider
        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg) => {
                return msg.payload.a + msg.payload.b;
            }
        });

        // Send messages
        await delay(10);
        for (let i = 0; i < messageCount; i++) {
            msgBus.send({
                channel: "Test.ComputeSum",
                payload: { a: i, b: i }
            });
        }

        await Promise.race([streamTask, delay(timeout)]);

        expect(receivedMessages.length).toBe(messageCount);
        for (let i = 0; i < messageCount; i++) {
            expect(receivedMessages[i]).toBe(i + i);
        }
    });

    it("can stream with topic filter", async () => {
        const msgBus = createTestMsgBus();
        const receivedMessages: string[] = [];
        const matchingCount = 5;
        const totalCount = 10;

        const streamTask = (async () => {
            const messageStream = msgBus.stream({
                channel: "Test.DoSomeWork",
                topic: "/^match-.*$/",
                options: {
                    fetchCount: matchingCount
                }
            });

            for await (const msg of messageStream) {
                receivedMessages.push(msg.payload);
            }
        })();

        await delay(10);

        // Send mixed messages
        for (let i = 0; i < totalCount; i++) {
            msgBus.send({
                channel: "Test.DoSomeWork",
                topic: i < matchingCount ? `match-${i}` : `other-${i}`,
                payload: `message-${i}`
            });
        }

        await Promise.race([streamTask, delay(timeout)]);

        expect(receivedMessages.length).toBe(matchingCount);
    });

    it("can abort stream", async () => {
        const msgBus = createTestMsgBus();
        const receivedMessages: number[] = [];
        const abortController = new AbortController();
        let streamError: any = undefined;
        let streamCompleted = false;

        const streamTask = (async () => {
            try {
                const messageStream = msgBus.stream({
                    channel: "Test.ComputeSum",
                    group: "out",
                    options: {
                        abortSignal: abortController.signal
                    }
                });

                for await (const msg of messageStream) {
                    receivedMessages.push(msg.payload);
                }
                streamCompleted = true;
            } catch (err) {
                streamError = err;
            }
        })();

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg) => {
                return msg.payload.a + msg.payload.b;
            }
        });

        await delay(10);

        // Send some messages
        for (let i = 0; i < 3; i++) {
            msgBus.send({
                channel: "Test.ComputeSum",
                payload: { a: i, b: i }
            });
        }

        await delay(50);

        // Abort the stream
        abortController.abort("test abort");

        // Try to send more messages
        for (let i = 3; i < 6; i++) {
            msgBus.send({
                channel: "Test.ComputeSum",
                payload: { a: i, b: i }
            });
        }

        await Promise.race([streamTask, delay(timeout)]);

        expect(receivedMessages.length).toBe(3);
        expect(streamCompleted).toBe(true);
        expect(streamError).toBeUndefined();
    });

    it("can stream with timeout", async () => {
        const msgBus = createTestMsgBus();
        let streamError: any = undefined;

        const streamTask = (async () => {
            try {
                const messageStream = msgBus.stream({
                    channel: "Test.ComputeSum",
                    options: {
                        timeout: 50
                    }
                });

                for await (const msg of messageStream) {
                    // Process messages
                }
            } catch (err) {
                streamError = err;
            }
        })();

        await Promise.race([streamTask, delay(timeout)]);

        expect(streamError).toBeDefined();
        expect(streamError).toBeInstanceOf(TimeoutError);
    });

    it("can cancel request in provider", async () => {
        const msgBus = createTestMsgBus();
        const abortController = new AbortController();
        let requestError: any = undefined;
        let providerWorkIterations = 0;
        let providerWorkAborted = false;

        // Provider tracks cancellation per request
        const cancelFlags = new Map<string, boolean>();

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: async (msg, outMsg) => {
                const requestId = outMsg.headers.requestId;

                // Cancel message — mark the request as canceled
                if (msg.status === 'canceled') {
                    if (requestId && cancelFlags.has(requestId)) {
                        cancelFlags.set(requestId, true);
                    }
                    return undefined;
                }

                // Normal request — register in cancel tracking
                cancelFlags.set(requestId, false);

                // Simulate long-running work as a loop with cancellation checks
                for (let i = 0; i < 20; i++) {
                    await delay(25);
                    providerWorkIterations++;

                    if (cancelFlags.get(requestId)) {
                        providerWorkAborted = true;
                        cancelFlags.delete(requestId);
                        return undefined;
                    }
                }

                cancelFlags.delete(requestId);
                return msg.payload.a + msg.payload.b;
            }
        });

        const requestTask = (async () => {
            try {
                await msgBus.request({
                    channel: "Test.ComputeSum",
                    payload: { a: 1, b: 2 },
                    options: {
                        abortSignal: abortController.signal
                    }
                });
            } catch (err) {
                requestError = err;
            }
        })();

        // Wait for provider to start working, then abort
        await delay(100);
        abortController.abort("user canceled");

        // Wait for provider loop to detect cancellation
        await delay(150);
        await Promise.race([requestTask, delay(timeout * 3)]);

        // Requester side: got OperationCanceledError
        expect(requestError).toBeDefined();
        expect(requestError).toBeInstanceOf(OperationCanceledError);
        expect(requestError.cause).toBe("user canceled");

        // Provider side: work was actually aborted mid-loop
        expect(providerWorkAborted).toBe(true);
        // Should have done some iterations but not all 20
        expect(providerWorkIterations).toBeGreaterThan(0);
        expect(providerWorkIterations).toBeLessThan(20);
    });

    it("can send with payloadFn (tuple args)", async () => {
        const msgBus = createTestMsgBus();
        let receivedA: number | undefined;
        let receivedB: number | undefined;

        msgBus.provide({
            channel: "Test.ComputeSum",
            group: "inFn",
            callback: (msg) => {
                const [a, b] = msg.payload;
                receivedA = a;
                receivedB = b;
                return a + b;
            }
        });

        const response = await msgBus.request({
            channel: "Test.ComputeSum",
            group: "inFn",
            payloadFn: fn => fn(10, 20),
        });

        expect(receivedA).toBe(10);
        expect(receivedB).toBe(20);
        expect(response.payload).toBe(30);
    });

    it("can use service->msgbus adapter", async () => {

        class TestApiClient {
            static readonly name = 'TestApiClient' as const;
            readonly name = 'TestApiClient' as const;

            computeOnServer(a: number, b: number) {
                return new Promise<number>((res, rej) => {
                    setTimeout(() => {
                        res(
                            computeSum({
                                a,
                                b
                            })
                        );
                    }, 200);
                });
            }

            // Internal helper — should not be exposed on the bus
            extraMethod() {

            }
        }

        type ServiceSuffix = BaseServiceSuffix;
        type BaseApiPrefix = 'API';
        type TestApiChannelPrefix = ToMsgChannelPrefix<
            typeof TestApiClient.name,
            BaseApiPrefix,
            ServiceSuffix
        >;

        type ApiMsgStruct = ToMsgStruct<
            TestApiClient,
            TestApiChannelPrefix,
            'extraMethod'
        >;

        const services: Record<TestApiChannelPrefix, any> = {
            'API.TEST.': new TestApiClient(),
        };

        const msgProviderAdapters = Object.entries(services).map(
            (entry) =>
                ({
                    service: entry[1],
                    channelSelector: getMsgChannelSelector(services),
                }) as MsgProviderAdapter,
        );

        const msgBus = createMsgBus<ApiMsgStruct>();

        const abortController = new AbortController();

        registerAdapters(msgBus, msgProviderAdapters, abortController.signal);

        const response = await msgBus.request({
            channel: "API.TEST.COMPUTEONSERVER",
            payloadFn: fn => fn(10, 20)
        });

        abortController.abort();
        expect(response.payload).toBe(30);
    });

    it("throws NoProviderError when throwIfNoProvider and no provider", async () => {
        const msgBus = createTestMsgBus();

        await expect(
            msgBus.request({
                channel: "Test.ComputeSum",
                payload: { a: 1, b: 2 },
                options: { throwIfNoProvider: true }
            })
        ).rejects.toBeInstanceOf(NoProviderError);
    });

    it("throws NoProviderError when mandatoryProvider in channel config and no provider", async () => {
        type BusStruct = MsgStruct<{
            "Test.ComputeSum": { in: { a: number; b: number }; out: number };
        }>;
        const msgBus = createMsgBus<BusStruct>({
            "Test.ComputeSum": { mandatoryProvider: true }
        });

        await expect(
            msgBus.request({
                channel: "Test.ComputeSum",
                payload: { a: 1, b: 2 }
            })
        ).rejects.toBeInstanceOf(NoProviderError);
    });

    it("does not throw NoProviderError when provider is registered", async () => {
        const msgBus = createTestMsgBus();

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg) => msg.payload.a + msg.payload.b
        });

        const response = await msgBus.request({
            channel: "Test.ComputeSum",
            payload: { a: 5, b: 3 },
            options: { throwIfNoProvider: true }
        });

        expect(response.payload).toBe(8);
    });

    it("request rejects with Error when provider throws", async () => {
        const msgBus = createTestMsgBus();

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: () => {
                throw new Error("provider failure");
            }
        });

        await expect(
            msgBus.request({
                channel: "Test.ComputeSum",
                payload: { a: 1, b: 2 }
            })
        ).rejects.toThrow("provider failure");
    });

    it("can requestStream from multiple providers", async () => {
        const msgBus = createTestMsgBus();
        const results: number[] = [];

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg) => msg.payload.a + msg.payload.b
        });
        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg) => (msg.payload.a + msg.payload.b) * 2
        });

        const streamTask = (async () => {
            for await (const msg of msgBus.requestStream({
                channel: "Test.ComputeSum",
                payload: { a: 3, b: 7 },
                options: { fetchCount: 2 }
            })) {
                results.push(msg.payload);
            }
        })();

        await Promise.race([streamTask, delay(timeout)]);

        expect(results.length).toBe(2);
        expect(results).toContain(10);
        expect(results).toContain(20);
    });

    it("can requestStream with fetchCount", async () => {
        const msgBus = createTestMsgBus();
        const results: number[] = [];
        const providerCount = 5;

        for (let i = 0; i < providerCount; i++) {
            const multiplier = i + 1;
            msgBus.provide({
                channel: "Test.ComputeSum",
                callback: (msg) => (msg.payload.a + msg.payload.b) * multiplier
            });
        }

        const fetchCount = 3;
        const streamTask = (async () => {
            for await (const msg of msgBus.requestStream({
                channel: "Test.ComputeSum",
                payload: { a: 1, b: 1 },
                options: { fetchCount }
            })) {
                results.push(msg.payload);
            }
        })();

        await Promise.race([streamTask, delay(timeout)]);

        expect(results.length).toBe(fetchCount);
    });

    it("can requestStream with inactivity timeout", async () => {
        const msgBus = createTestMsgBus();
        let streamError: any;

        const streamTask = (async () => {
            try {
                for await (const _msg of msgBus.requestStream({
                    channel: "Test.ComputeSum",
                    payload: { a: 1, b: 2 },
                    options: { timeout: 50 }
                })) {
                    // no provider, never receives
                }
            } catch (err) {
                streamError = err;
            }
        })();

        await Promise.race([streamTask, delay(timeout)]);

        expect(streamError).toBeInstanceOf(TimeoutError);
    });

    it("can abort requestStream", async () => {
        const msgBus = createTestMsgBus();
        const results: number[] = [];
        const abortController = new AbortController();
        let streamCompleted = false;

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg) => msg.payload.a + msg.payload.b
        });

        const streamTask = (async () => {
            for await (const msg of msgBus.requestStream({
                channel: "Test.ComputeSum",
                payload: { a: 2, b: 3 },
                options: { abortSignal: abortController.signal }
            })) {
                results.push(msg.payload);
                abortController.abort();
            }
            streamCompleted = true;
        })();

        await Promise.race([streamTask, delay(timeout)]);

        expect(results.length).toBe(1);
        expect(streamCompleted).toBe(true);
    });

    it("requestStream throws NoProviderError when throwIfNoProvider and no provider", async () => {
        const msgBus = createTestMsgBus();

        const gen = msgBus.requestStream({
            channel: "Test.ComputeSum",
            payload: { a: 1, b: 2 },
            options: { throwIfNoProvider: true }
        });

        await expect(gen.next()).rejects.toBeInstanceOf(NoProviderError);
    });

    it("supports chain of responsibility via outMsg.status = 'skipped'", async () => {
        const msgBus = createTestMsgBus();
        const handled: string[] = [];

        // Provider A: handles only even sums, skips odd
        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg, outMsg) => {
                const sum = msg.payload.a + msg.payload.b;
                if (sum % 2 !== 0) {
                    outMsg.status = 'skipped';
                    return undefined;
                }
                handled.push('A');
                return sum * 10;
            }
        });

        // Provider B: handles only odd sums, skips even
        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg, outMsg) => {
                const sum = msg.payload.a + msg.payload.b;
                if (sum % 2 === 0) {
                    outMsg.status = 'skipped';
                    return undefined;
                }
                handled.push('B');
                return sum * 100;
            }
        });

        // even sum (2+4=6) → Provider A handles, Provider B skips
        const r1 = await msgBus.request({
            channel: "Test.ComputeSum",
            payload: { a: 2, b: 4 },
        });
        expect(r1.payload).toBe(60);
        expect(handled).toEqual(['A']);

        handled.length = 0;

        // odd sum (3+4=7) → Provider A skips, Provider B handles
        const r2 = await msgBus.request({
            channel: "Test.ComputeSum",
            payload: { a: 3, b: 4 },
        });
        expect(r2.payload).toBe(700);
        expect(handled).toEqual(['B']);
    });

    it("subscriber mutations do not affect other subscribers", async () => {
        const msgBus = createTestMsgBus();
        const received: { status: string; headersSourceId: string }[] = [];

        msgBus.on({
            channel: "Test.ComputeSum",
            callback: (msg) => {
                msg.status = 'skipped';
                msg.headers.sourceId = 'mutated-by-A';
                received.push({ status: msg.status, headersSourceId: msg.headers.sourceId });
            }
        });

        msgBus.on({
            channel: "Test.ComputeSum",
            callback: (msg) => {
                received.push({ status: msg.status, headersSourceId: msg.headers?.sourceId });
            }
        });

        msgBus.send({
            channel: "Test.ComputeSum",
            payload: { a: 1, b: 2 },
            headers: { sourceId: 'original' }
        });

        await delay(50);

        expect(received).toHaveLength(2);
        // subscriber B sees the original envelope, not A's mutations
        const b = received.find(r => r.headersSourceId !== 'mutated-by-A');
        expect(b).toBeDefined();
        expect(b.headersSourceId).toBe('original');
        expect(b.status).toBe('pending'); // default from publish(), not A's 'skipped'
    });

    it("multiple simultaneous requests are correlated by requestId", async () => {
        const msgBus = createTestMsgBus();
        const delays = [40, 5];
        let callIndex = 0;

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: async (msg) => {
                const d = delays[callIndex++];
                await delay(d);
                return msg.payload.a + msg.payload.b;
            }
        });

        const [r1, r2] = await Promise.all([
            msgBus.request({ channel: "Test.ComputeSum", payload: { a: 1, b: 2 } }),
            msgBus.request({ channel: "Test.ComputeSum", payload: { a: 10, b: 20 } }),
        ]);

        // r2 finishes first but each resolves with its own result
        expect(r1.payload).toBe(3);
        expect(r2.payload).toBe(30);
    });

    it("once() receives replayed message from replay buffer", async () => {
        type ReplayStruct = MsgStruct<{ "Replay.Val": { in: { value: number } } }>;
        const msgBus = createMsgBus<ReplayStruct>({ "Replay.Val": { replayBufferSize: 1 } });

        msgBus.send({ channel: "Replay.Val", payload: { value: 42 } });
        await delay(10);

        const msg = await msgBus.once({ channel: "Replay.Val" });
        expect(msg.payload).toEqual({ value: 42 });
    });

    it("stream() stops at fetchCount when messages arrive quickly", async () => {
        const msgBus = createTestMsgBus();
        const received: number[] = [];
        const gen = msgBus.stream({
            channel: "Test.ComputeSum",
            options: { fetchCount: 2, timeout: 5000 },
        });

        setTimeout(() => {
            msgBus.send({ channel: "Test.ComputeSum", payload: { a: 1, b: 0 } });
            msgBus.send({ channel: "Test.ComputeSum", payload: { a: 2, b: 0 } });
            msgBus.send({ channel: "Test.ComputeSum", payload: { a: 3, b: 0 } });
        }, 10);

        for await (const msg of gen) {
            received.push(msg.payload.a);
        }

        expect(received).toEqual([1, 2]);
    });

    it("stream() throws TimeoutError when inactivity timeout fires", async () => {
        const msgBus = createTestMsgBus();
        const received: number[] = [];
        const gen = msgBus.stream({
            channel: "Test.ComputeSum",
            options: { fetchCount: 10, timeout: 60 },
        });

        setTimeout(() => {
            msgBus.send({ channel: "Test.ComputeSum", payload: { a: 7, b: 0 } });
        }, 10);

        await expect(async () => {
            for await (const msg of gen) {
                received.push(msg.payload.a);
            }
        }).rejects.toThrow(TimeoutError);

        expect(received).toEqual([7]);
    });

    it("once() rejects immediately when AbortSignal is already aborted", async () => {
        const msgBus = createTestMsgBus();
        const controller = new AbortController();
        controller.abort("pre-aborted");

        await expect(
            msgBus.once({ channel: "Test.ComputeSum", options: { abortSignal: controller.signal } })
        ).rejects.toThrow(OperationCanceledError);
    });

    it("on() callback never fires when AbortSignal is already aborted", async () => {
        const msgBus = createTestMsgBus();
        const controller = new AbortController();
        controller.abort();
        let called = false;

        msgBus.on({
            channel: "Test.ComputeSum",
            callback: () => { called = true; },
            options: { abortSignal: controller.signal }
        });

        msgBus.send({ channel: "Test.ComputeSum", payload: { a: 1, b: 2 } });
        await delay(50);

        expect(called).toBe(false);
    });

    it("request() resolves with undefined payload when provider returns undefined", async () => {
        const msgBus = createTestMsgBus();

        msgBus.provide({
            channel: "Test.DoSomeWork",
            callback: () => undefined,
        });

        const msg = await msgBus.request({ channel: "Test.DoSomeWork", payload: "work" });
        expect(msg.payload).toBeUndefined();
    });

    it("provide() custom msgOut.headers are present in request() response", async () => {
        const msgBus = createTestMsgBus();

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (msg, msgOut) => {
                msgOut.headers = { ...msgOut.headers, sourceId: "provider-tag" };
                return msg.payload.a + msg.payload.b;
            }
        });

        const msg = await msgBus.request({ channel: "Test.ComputeSum", payload: { a: 3, b: 7 } });
        expect(msg.payload).toBe(10);
        expect(msg.headers?.sourceId).toBe("provider-tag");
    });

    it("request() rejects with Error when provider sets msgOut.status = 'failed'", async () => {
        const msgBus = createTestMsgBus();

        msgBus.provide({
            channel: "Test.ComputeSum",
            callback: (_msg, msgOut) => {
                msgOut.status = 'failed';
                msgOut.headers = { ...msgOut.headers, error: "validation failed" };
                return undefined;
            }
        });

        await expect(
            msgBus.request({ channel: "Test.ComputeSum", payload: { a: 1, b: 2 } })
        ).rejects.toThrow("validation failed");
    });

    it("send() with custom group delivers only to that group's subscribers", async () => {
        const msgBus = createTestMsgBus();
        const in1Received: string[] = [];
        const in2Received: number[] = [];

        msgBus.on({ channel: "Test.Multiplexer", group: "in1", callback: (msg) => { in1Received.push(msg.payload); } });
        msgBus.on({ channel: "Test.Multiplexer", group: "in2", callback: (msg) => { in2Received.push(msg.payload); } });

        msgBus.send({ channel: "Test.Multiplexer", group: "in1", payload: "hello" });
        await delay(50);

        expect(in1Received).toEqual(["hello"]);
        expect(in2Received).toHaveLength(0);
    });

    it("'*' config in function form applies dynamic defaults per channel", async () => {
        type DynStruct = MsgStruct<{
            "Api.Data": { in: string; out: string };
            "Local.Data": { in: string; out: string };
        }>;
        const msgBus = createMsgBus<DynStruct>({
            "*": (channel) => ({ mandatoryProvider: channel.startsWith("Api.") }),
        });

        // Api.Data requires provider — should throw NoProviderError
        await expect(
            msgBus.request({ channel: "Api.Data", payload: "q" })
        ).rejects.toThrow(NoProviderError);

        // Local.Data does not require provider — should throw TimeoutError (no provider, but no mandatory check)
        await expect(
            msgBus.request({ channel: "Local.Data", payload: "q", options: { timeout: 50 } })
        ).rejects.toThrow(TimeoutError);
    });
});
