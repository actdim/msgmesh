import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMsgBus } from '@/core';
import {
    type MsgStruct,
    type MsgBusConfig,
    type MsgStructNormalized,
    $C_ERROR,
    $SYSTEM_TOPIC,
    isChannelBusyError,
    isTimeoutError,
    isOperationCanceledError,
} from '@/contracts';

type AnyBusStruct = MsgStruct<{
    [k: string]: {
        in: any;
        out: any;
    };
}>;

type AnyBusConfig = MsgBusConfig<MsgStructNormalized<AnyBusStruct>>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Provider that holds every message until releaseNext() is called. */
function gatedProvider(bus: ReturnType<typeof createMsgBus<AnyBusStruct>>, channel: string) {
    const gates: (() => void)[] = [];
    let received = 0;
    bus.provide({
        channel,
        callback: async (msg: any) => {
            received++;
            await new Promise<void>((resolve) => gates.push(resolve));

            return msg.payload;
        },
    });

    return {
        get pending() {
            return gates.length;
        },
        get received() {
            return received;
        },
        releaseNext: () => gates.shift()?.(),
        releaseAll: () => {
            while (gates.length) {
                gates.shift()?.();
            }
        },
    };
}

/** Tracks whether a promise has settled, without awaiting it. */
function track<T>(promise: Promise<T>) {
    const state = { settled: false, value: undefined as T | undefined, error: undefined as unknown };
    promise.then(
        (value) => {
            state.settled = true;
            state.value = value;
        },
        (error) => {
            state.settled = true;
            state.error = error;
        },
    );

    return state;
}

describe('flow control (backpressure)', () => {
    it('channels without flowControl keep the old behavior and have no flow state', async () => {
        const bus = createMsgBus<AnyBusStruct>();
        const provider = gatedProvider(bus, 'Fc.None');
        for (let i = 0; i < 5; i++) {
            await bus.send({ channel: 'Fc.None', payload: i });
        }
        await sleep(20);
        expect(provider.received).toBe(5);
        expect(bus.getFlowStats('Fc.None')).toBeUndefined();
        provider.releaseAll();
    });

    it('suspends send() when maxInFlight is reached and resumes on the "out" answer', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Slow': { flowControl: { maxInFlight: 2 } } } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Fc.Slow');

        const s1 = track(bus.send({ channel: 'Fc.Slow', payload: 1 }));
        const s2 = track(bus.send({ channel: 'Fc.Slow', payload: 2 }));
        const s3 = track(bus.send({ channel: 'Fc.Slow', payload: 3 }));
        await sleep(20);

        expect(s1.settled && s2.settled).toBe(true);
        expect(s3.settled).toBe(false);
        expect(provider.received).toBe(2);
        expect(bus.getFlowStats('Fc.Slow')).toEqual({ limit: 2, inFlight: 2, waiting: 1, leases: 2 });

        provider.releaseNext();
        await sleep(20);

        expect(s3.settled).toBe(true);
        expect(provider.received).toBe(3);
        expect(bus.getFlowStats('Fc.Slow')).toEqual({ limit: 2, inFlight: 2, waiting: 0, leases: 2 });

        provider.releaseAll();
        await sleep(20);
        provider.releaseAll();
        await sleep(20);
        expect(bus.getFlowStats('Fc.Slow')).toEqual({ limit: 2, inFlight: 0, waiting: 0, leases: 0 });
    });

    it('admits waiters in FIFO order', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Fifo': { flowControl: { maxInFlight: 1 } } } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Fc.Fifo');
        const order: string[] = [];

        await bus.send({ channel: 'Fc.Fifo', payload: 'a' });
        bus.send({ channel: 'Fc.Fifo', payload: 'b' }).then(() => order.push('b'));
        bus.send({ channel: 'Fc.Fifo', payload: 'c' }).then(() => order.push('c'));
        await sleep(20);
        expect(order).toEqual([]);

        provider.releaseNext();
        await sleep(20);
        expect(order).toEqual(['b']);

        provider.releaseNext();
        await sleep(20);
        expect(order).toEqual(['b', 'c']);
        provider.releaseAll();
    });

    it("overflow: 'error' rejects with ChannelBusyError", async () => {
        const bus = createMsgBus<AnyBusStruct>({
            'Fc.Busy': { flowControl: { maxInFlight: 1, overflow: 'error' } },
        } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Fc.Busy');

        await bus.send({ channel: 'Fc.Busy', payload: 1 });
        const err = await bus.send({ channel: 'Fc.Busy', payload: 2 }).catch((e) => e);
        expect(isChannelBusyError(err)).toBe(true);
        expect(err.channel).toBe('Fc.Busy');
        await sleep(20);
        expect(provider.received).toBe(1);
        provider.releaseAll();
    });

    it('timeout and abortSignal cancel a waiting send() without leaking the slot', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Wait': { flowControl: { maxInFlight: 1 } } } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Fc.Wait');

        await bus.send({ channel: 'Fc.Wait', payload: 1 });

        const timeoutErr = await bus
            .send({ channel: 'Fc.Wait', payload: 2, options: { timeout: 30 } })
            .catch((e) => e);
        expect(isTimeoutError(timeoutErr)).toBe(true);

        const ac = new AbortController();
        const aborted = bus.send({ channel: 'Fc.Wait', payload: 3, options: { abortSignal: ac.signal } });
        await sleep(10);
        ac.abort();
        expect(isOperationCanceledError(await aborted.catch((e) => e))).toBe(true);

        expect(bus.getFlowStats('Fc.Wait')).toEqual({ limit: 1, inFlight: 1, waiting: 0, leases: 1 });

        provider.releaseAll();
        await sleep(20);
        expect(provider.received).toBe(1);
        expect(bus.getFlowStats('Fc.Wait')).toEqual({ limit: 1, inFlight: 0, waiting: 0, leases: 0 });
    });

    it('releases the slot when the provider fails or cancels', async () => {
        const bus = createMsgBus<AnyBusStruct>({
            'Fc.Fail': { flowControl: { maxInFlight: 1 } },
            'Fc.Cancel': { flowControl: { maxInFlight: 1 } },
        } as AnyBusConfig);
        bus.provide({
            channel: 'Fc.Fail',
            callback: () => {
                throw new Error('boom');
            },
        });
        bus.provide({
            channel: 'Fc.Cancel',
            callback: (_msg: any, msgOut: any) => {
                msgOut.status = 'canceled';
            },
        });

        for (const channel of ['Fc.Fail', 'Fc.Cancel']) {
            await bus.send({ channel, payload: 1 });
            const second = track(bus.send({ channel, payload: 2 }));
            await sleep(20);
            expect(second.settled).toBe(true);
            await sleep(20);
            expect(bus.getFlowStats(channel)).toEqual({ limit: 1, inFlight: 0, waiting: 0, leases: 0 });
        }
    });

    it('holds the slot for skipped messages and on()-only channels until the lease timeout', async () => {
        const bus = createMsgBus<AnyBusStruct>({
            'Fc.Skip': { flowControl: { maxInFlight: 1, leaseTimeout: 80 } },
            'Fc.On': { flowControl: { maxInFlight: 1, leaseTimeout: 80 } },
        } as AnyBusConfig);
        bus.provide({
            channel: 'Fc.Skip',
            callback: (_msg: any, msgOut: any) => {
                msgOut.status = 'skipped';
            },
        });
        bus.on({ channel: 'Fc.On', callback: () => {} });

        for (const channel of ['Fc.Skip', 'Fc.On']) {
            await bus.send({ channel, payload: 1 });
            const second = track(bus.send({ channel, payload: 2 }));
            await sleep(30);
            expect(second.settled).toBe(false);
            await sleep(100);
            expect(second.settled).toBe(true);
            await sleep(100);
            expect(bus.getFlowStats(channel)?.inFlight).toBe(0);
        }
    });

    it('releases the slot immediately when nobody is subscribed', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Nobody': { flowControl: { maxInFlight: 1 } } } as AnyBusConfig);
        await bus.send({ channel: 'Fc.Nobody', payload: 1 });
        await bus.send({ channel: 'Fc.Nobody', payload: 2 });
        expect(bus.getFlowStats('Fc.Nobody')).toEqual({ limit: 1, inFlight: 0, waiting: 0, leases: 0 });
    });

    it('never gates "out" answers: a provider requesting another limited channel does not deadlock', async () => {
        const bus = createMsgBus<AnyBusStruct>({
            'Fc.A': { flowControl: { maxInFlight: 1 } },
            'Fc.B': { flowControl: { maxInFlight: 1 } },
        } as AnyBusConfig);
        bus.provide({ channel: 'Fc.B', callback: (msg: any): any => msg.payload * 2 });
        bus.provide({
            channel: 'Fc.A',
            callback: async (msg: any) => {
                const res = await bus.request({ channel: 'Fc.B', payload: msg.payload });

                return res.payload + 1;
            },
        });

        const results = await Promise.all([
            bus.request({ channel: 'Fc.A', payload: 1 }),
            bus.request({ channel: 'Fc.A', payload: 2 }),
            bus.request({ channel: 'Fc.A', payload: 3 }),
        ]);
        expect(results.map((r) => r.payload)).toEqual([3, 5, 7]);
        expect(bus.getFlowStats('Fc.A')?.inFlight).toBe(0);
        expect(bus.getFlowStats('Fc.B')?.inFlight).toBe(0);
    });

    it('request() honors sendTimeout while waiting for a slot', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Req': { flowControl: { maxInFlight: 1 } } } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Fc.Req');

        const first = bus.request({ channel: 'Fc.Req', payload: 1 });
        await sleep(10);
        const err = await bus
            .request({ channel: 'Fc.Req', payload: 2, options: { sendTimeout: 30 } })
            .catch((e) => e);
        expect(isTimeoutError(err)).toBe(true);
        expect(bus.getFlowStats('Fc.Req')?.waiting).toBe(0);

        provider.releaseAll();
        expect((await first).payload).toBe(1);
    });

    it('an overall request timeout while waiting leaves no orphan publish', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Orphan': { flowControl: { maxInFlight: 1 } } } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Fc.Orphan');

        const first = bus.request({ channel: 'Fc.Orphan', payload: 1 });
        await sleep(10);
        const err = await bus
            .request({ channel: 'Fc.Orphan', payload: 2, options: { timeout: 40 } })
            .catch((e) => e);
        expect(isTimeoutError(err)).toBe(true);
        expect(bus.getFlowStats('Fc.Orphan')?.waiting).toBe(0);

        provider.releaseAll();
        await first;
        await sleep(20);
        expect(provider.received).toBe(1);
        expect(bus.getFlowStats('Fc.Orphan')?.inFlight).toBe(0);
    });

    it('requestStream() takes a slot and frees it on the first response', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Stream': { flowControl: { maxInFlight: 1 } } } as AnyBusConfig);
        bus.provide({ channel: 'Fc.Stream', callback: (msg: any): any => `a:${msg.payload}` });
        bus.provide({ channel: 'Fc.Stream', callback: (msg: any): any => `b:${msg.payload}` });

        const answers: string[] = [];
        for await (const msg of bus.requestStream({
            channel: 'Fc.Stream',
            payload: 1,
            options: { fetchCount: 2, timeout: 1000 },
        })) {
            answers.push(msg.payload);
        }
        expect(answers.sort()).toEqual(['a:1', 'b:1']);
        expect(bus.getFlowStats('Fc.Stream')).toEqual({ limit: 1, inFlight: 0, waiting: 0, leases: 0 });
    });

    it('unawaited send() with a gate error raises no unhandled rejection and reports to MSGBUS.ERROR', async () => {
        const bus = createMsgBus<AnyBusStruct>({
            'Fc.Fire': { flowControl: { maxInFlight: 1, overflow: 'error' } },
        } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Fc.Fire');
        const errors: any[] = [];
        bus.on({
            channel: $C_ERROR as any,
            topic: $SYSTEM_TOPIC,
            callback: (msg: any) => errors.push(msg.payload),
        });
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        try {
            await bus.send({ channel: 'Fc.Fire', payload: 1 });
            void bus.send({ channel: 'Fc.Fire', payload: 2 });
            await sleep(30);
        } finally {
            process.off('unhandledRejection', unhandled);
        }
        expect(unhandled).not.toHaveBeenCalled();
        expect(errors).toHaveLength(1);
        expect(errors[0].error.name).toBe('ChannelBusyError');
        expect(errors[0].source.address.channel).toBe('Fc.Fire');
        provider.releaseAll();
    });

    it('rejects invalid maxInFlight', async () => {
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Bad': { flowControl: { maxInFlight: 0 } } } as AnyBusConfig);
        await expect(bus.send({ channel: 'Fc.Bad', payload: 1 })).rejects.toThrow(/maxInFlight/);
    });

    it("applies '*' defaults to every channel", async () => {
        const bus = createMsgBus<AnyBusStruct>({
            '*': (channel: string) => (channel.startsWith('Api.') ? { flowControl: { maxInFlight: 1 } } : {}),
        } as AnyBusConfig);
        const provider = gatedProvider(bus, 'Api.Call');
        await bus.send({ channel: 'Api.Call', payload: 1 });
        await bus.send({ channel: 'Ui.Event', payload: 1 });
        expect(bus.getFlowStats('Api.Call')?.inFlight).toBe(1);
        expect(bus.getFlowStats('Ui.Event')).toBeUndefined();
        provider.releaseAll();
    });
});

describe('flow control timer cleanup', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('a burst of requests leaves no leases, waiters or timers', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const bus = createMsgBus<AnyBusStruct>({ 'Fc.Burst': { flowControl: { maxInFlight: 2 } } } as AnyBusConfig);
        bus.provide({ channel: 'Fc.Burst', callback: (msg: any) => msg.payload });

        const results = await Promise.all(
            [1, 2, 3, 4, 5].map((n) => bus.request({ channel: 'Fc.Burst', payload: n })),
        );
        expect(results.map((r) => r.payload)).toEqual([1, 2, 3, 4, 5]);
        expect(bus.getFlowStats('Fc.Burst')).toEqual({ limit: 2, inFlight: 0, waiting: 0, leases: 0 });
        expect(vi.getTimerCount()).toBe(0);
    });
});
