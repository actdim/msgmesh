import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMsgBus } from '@/core';
import { type MsgStruct, isTimeoutError, isOperationCanceledError } from '@/contracts';

type AnyBusStruct = MsgStruct<{
    [k: string]: {
        in: any;
        out: any;
    };
}>;

describe('timeout timer cleanup', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('request() clears timeout timer after successful response', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        bus.provide({
            channel: 'Test.Math',
            callback: (m: any) => m.payload.a + m.payload.b,
        });

        expect(vi.getTimerCount()).toBe(0);

        const promise = bus.request({
            channel: 'Test.Math',
            payload: { a: 2, b: 3 },
            options: { timeout: 5000 },
        });

        // While request is in-flight, the timeout timer is pending.
        expect(vi.getTimerCount()).toBe(1);

        const response = await promise;
        expect(response.payload).toBe(5);

        // After settle, timeout timer must be cleared.
        expect(vi.getTimerCount()).toBe(0);
    });

    it('request() clears timeout timer when provider fails', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        bus.provide({
            channel: 'Test.Fail',
            callback: () => {
                throw new Error('boom');
            },
        });

        expect(vi.getTimerCount()).toBe(0);

        const promise = bus.request({
            channel: 'Test.Fail',
            payload: {},
            options: { timeout: 5000 },
        });

        expect(vi.getTimerCount()).toBe(1);

        await expect(promise).rejects.toThrow('boom');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('request() clears timeout timer when caller aborts', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        bus.provide({
            channel: 'Test.Slow',
            callback: async () => {
                // provider that never returns
                await new Promise(() => {});
            },
        });

        const ac = new AbortController();
        const promise = bus.request({
            channel: 'Test.Slow',
            payload: {},
            options: { timeout: 5000, abortSignal: ac.signal },
        });

        expect(vi.getTimerCount()).toBe(1);

        ac.abort();

        await expect(promise).rejects.toSatisfy((err: unknown) => isOperationCanceledError(err));
        expect(vi.getTimerCount()).toBe(0);
    });

    it('request() fires TimeoutError when timeout expires', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        bus.provide({
            channel: 'Test.Never',
            callback: async () => {
                await new Promise(() => {});
            },
        });

        const promise = bus.request({
            channel: 'Test.Never',
            payload: {},
            options: { timeout: 3000 },
        });

        expect(vi.getTimerCount()).toBe(1);

        vi.advanceTimersByTime(3000);

        await expect(promise).rejects.toSatisfy((err: unknown) => isTimeoutError(err));
        expect(vi.getTimerCount()).toBe(0);
    });

    it('once() clears timeout timer after message received', async () => {
        const bus = createMsgBus<AnyBusStruct>();

        expect(vi.getTimerCount()).toBe(0);

        const promise = bus.once({
            channel: 'Test.Event',
            options: { timeout: 5000 },
        });

        expect(vi.getTimerCount()).toBe(1);

        await bus.send({
            channel: 'Test.Event',
            payload: { value: 42 },
        });

        const msg = await promise;
        expect(msg.payload.value).toBe(42);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('once() clears timeout timer when caller aborts', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        const ac = new AbortController();

        const promise = bus.once({
            channel: 'Test.Event',
            options: { timeout: 5000, abortSignal: ac.signal },
        });

        expect(vi.getTimerCount()).toBe(1);

        ac.abort();

        await expect(promise).rejects.toSatisfy((err: unknown) => isOperationCanceledError(err));
        expect(vi.getTimerCount()).toBe(0);
    });

    it('once() fires TimeoutError when timeout expires', async () => {
        const bus = createMsgBus<AnyBusStruct>();

        const promise = bus.once({
            channel: 'Test.Event',
            options: { timeout: 2000 },
        });

        expect(vi.getTimerCount()).toBe(1);

        vi.advanceTimersByTime(2000);

        await expect(promise).rejects.toSatisfy((err: unknown) => isTimeoutError(err));
        expect(vi.getTimerCount()).toBe(0);
    });

    it('stream() clears inactivity timer on fetchCount completion', async () => {
        const bus = createMsgBus<AnyBusStruct>();

        const consumer = async () => {
            const results: any[] = [];
            for await (const msg of bus.stream({
                channel: 'Test.Stream',
                options: { timeout: 5000, fetchCount: 2 },
            })) {
                results.push(msg.payload);
            }

            return results;
        };

        const promise = consumer();

        // While awaiting first message, inactivity timer is running.
        expect(vi.getTimerCount()).toBe(1);

        await bus.send({ channel: 'Test.Stream', payload: 1 });
        // After 1st message, inactivity timer is reset for 2nd message.
        expect(vi.getTimerCount()).toBe(1);

        await bus.send({ channel: 'Test.Stream', payload: 2 });
        // After 2nd message, fetchCount is reached and generator terminates.
        const res = await promise;
        expect(res).toEqual([1, 2]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('stream() clears inactivity timer on consumer break', async () => {
        const bus = createMsgBus<AnyBusStruct>();

        const consumer = async () => {
            for await (const msg of bus.stream({
                channel: 'Test.Stream',
                options: { timeout: 5000 },
            })) {
                if (msg.payload === 'stop') {
                    break;
                }
            }
        };

        const promise = consumer();
        expect(vi.getTimerCount()).toBe(1);

        await bus.send({ channel: 'Test.Stream', payload: 'stop' });
        await promise;

        expect(vi.getTimerCount()).toBe(0);
    });

    it('stream() clears inactivity timer on abort', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        const ac = new AbortController();

        const consumer = async () => {
            const results: any[] = [];
            for await (const msg of bus.stream({
                channel: 'Test.Stream',
                options: { timeout: 5000, abortSignal: ac.signal },
            })) {
                results.push(msg.payload);
            }

            return results;
        };

        const promise = consumer();
        expect(vi.getTimerCount()).toBe(1);

        ac.abort();
        const res = await promise;
        expect(res).toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('requestStream() clears inactivity timer on fetchCount completion', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        bus.provide({
            channel: 'Test.ReqStream',
            callback: (m: any, out: any) => {
                out.payload = m.payload * 10;
            },
        });

        const consumer = async () => {
            const results: any[] = [];
            for await (const msg of bus.requestStream({
                channel: 'Test.ReqStream',
                payload: 1,
                options: { timeout: 5000, fetchCount: 1 },
            })) {
                results.push(msg.payload);
            }

            return results;
        };

        const promise = consumer();
        const res = await promise;
        expect(res).toEqual([10]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('requestStream() clears inactivity timer on consumer break', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        bus.provide({
            channel: 'Test.ReqStream',
            callback: (m: any, out: any) => {
                out.payload = m.payload;
            },
        });

        const consumer = async () => {
            for await (const _msg of bus.requestStream({
                channel: 'Test.ReqStream',
                payload: 'hello',
                options: { timeout: 5000 },
            })) {
                break;
            }
        };

        await consumer();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('requestStream() clears inactivity timer on abort', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        // Provider that does not respond immediately
        bus.on({
            channel: 'Test.ReqStream',
            callback: () => {},
        });

        const ac = new AbortController();
        const consumer = async () => {
            const results: any[] = [];
            for await (const msg of bus.requestStream({
                channel: 'Test.ReqStream',
                payload: 123,
                options: { timeout: 5000, abortSignal: ac.signal },
            })) {
                results.push(msg.payload);
            }

            return results;
        };

        const promise = consumer();
        // Wait for microtasks so publish settles and resetTimeout starts the inactivity timer.
        await Promise.resolve();
        await Promise.resolve();
        expect(vi.getTimerCount()).toBe(1);

        ac.abort();
        const res = await promise;
        expect(res).toEqual([]);
        expect(vi.getTimerCount()).toBe(0);
    });
});
