import {
    type MsgBus,
    type MsgStructBase,
    type Msg,
    $CG_IN,
    $CG_OUT,
    type MsgBusConfig,
    type MsgSubParams,
    type AwaitableMsgSubParams,
    type MsgProviderParams,
    type MsgStructNormalized,
    $CG_ERROR,
    $C_ERROR,
    type MsgHeaders,
    TimeoutError,
    OperationCanceledError,
    type MsgRequestDispatcherParams,
    type ErrorPayload,
    $SYSTEM_TOPIC,
    type MsgStreamParams,
    type MsgStream,
    type MsgSub,
    type AwaitableMsgSub,
    type MsgProvider,
    type MsgSender,
    type MsgRequestDispatcher,
    type MsgRequestStream,
    type MsgRequestStreamParams,
    type MsgSenderParams,
    type OutChannelStruct,
    NoProviderError,
    $C_ANY,
    type MsgStatus,
    type MsgChannelConfig,
    type MsgFlowControl,
    type MsgFlowStats,
    ChannelBusyError,
    isOperationCanceledError,
} from '@/contracts';
import { v4 as uuid } from 'uuid';
import {
    type MonoTypeOperatorFunction,
    type Observable,
    Subject,
    ReplaySubject,
    asyncScheduler,
    type OperatorFunction,
    type SchedulerLike,
} from 'rxjs';
import {
    filter as filterOp,
    take as takeOp,
    observeOn,
    delay as delayOp,
    debounceTime as debounceOp,
} from 'rxjs/operators';

import { type Skip } from '@actdim/utico/typeCore';
import { pipeFromArray, throttleOp, type ThrottleOptions } from '@/util';
import { delayError } from '@actdim/utico/utils';
import { getGlobalFlags } from '@/globals';

export const getMatchTest = (pattern: string) => {
    if (pattern == undefined) {
        // return (value: string) => true;
        return (value: string) => value == pattern;
    }
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
        pattern = pattern.substring(1, pattern.length - 1);
        const regexp = new RegExp(pattern);

        return (value: string) => regexp.test(value);
    } else {
        return (value: string) => pattern === value;
    }
};

export const defaultPromiseTimeout = 1000 * 5; // 5 seconds

// see also https://www.npmjs.com/package/p-queue
// https://github.com/postaljs/postal.js

function now() {
    return Date.now(); // new Date().getTime() or +new Date()
}

// createServiceBus
const groupPrefix = ':'; // "/", ":", "::"
export function createMsgBus<
    TStruct extends MsgStructBase,
    THeaders extends MsgHeaders = MsgHeaders,
>(config?: MsgBusConfig<MsgStructNormalized<TStruct>>) {
    type TStructN = MsgStructNormalized<TStruct>;
    type MsgInfo = Skip<Msg<TStructN>, 'payload'>;

    const errTopic = $SYSTEM_TOPIC;
    const scheduler: SchedulerLike = asyncScheduler;

    function getMsgInfo(msg: Msg<TStructN>) {
        return {
            id: msg.id,
            address: msg.address,
            headers: msg.headers,
        } as MsgInfo;
    }

    function handleError(srcMsg: Msg<TStructN>, err: any, respondToRequest?: boolean) {
        let errInfo: unknown;
        if (!import.meta.env.DEV) {
            if (err instanceof Error) {
                // Keep the error's own fields (e.g. HttpClientError.status, HttpNetworkError.kind):
                // consumers classify errors by them. name/message/stack/cause are non-enumerable on Error.
                errInfo = {
                    ...Object.fromEntries(Object.entries(err)),
                    name: err.name,
                    message: err.message,
                    stack: err.stack,
                    cause: err.cause,
                };
            } else {
                errInfo = JSON.stringify(err);
            }
        } else {
            errInfo = err;
        }
        const errPayload = {
            error: errInfo,
            source: getMsgInfo(srcMsg),
        } satisfies ErrorPayload as Msg<TStructN>['payload'];
        let errMsg: Msg<TStructN>;
        errMsg = {
            address: {
                channel: srcMsg.address.channel,
                group: $CG_ERROR,
                topic: errTopic,
            },
            payload: errPayload,
        };
        publish(errMsg);
        errMsg = {
            address: {
                channel: $C_ERROR as keyof TStructN,
                group: $CG_IN,
                topic: errTopic,
            },
            payload: errPayload,
        };
        publish(errMsg);
        if (respondToRequest && srcMsg.headers?.requestId) {
            publish({
                address: {
                    channel: srcMsg.address.channel,
                    group: $CG_OUT,
                    topic: srcMsg.address.topic,
                },
                status: 'failed' satisfies MsgStatus,
                headers: {
                    ...srcMsg.headers,
                    inResponseToId: srcMsg.headers.requestId,
                    error: err?.message ?? String(err),
                },
            });
        }
        // + nack?
    }

    function createOperationCanceledError(cause?: unknown, message?: string) {
        if (!message) {
            message = 'The operation was canceled by the caller';
        }

        return new OperationCanceledError(message, cause);
    }

    // observables
    const subjects: Map<string, Subject<Msg<TStructN>>> = new Map();

    function createRoutingKey(channel: string, group: string) {
        return `${channel}${groupPrefix}${group}`;
    }

    function getChannelConfig(channel: string) {
        const configOrResolver = config?.[$C_ANY];
        const defaults =
            typeof configOrResolver === 'function' ? configOrResolver(channel) : configOrResolver;

        return { ...defaults, ...config?.[channel] } as MsgChannelConfig<any>;
    }

    function getOrCreateSubject(channel: string, group: string): Subject<Msg<TStructN>> {
        const routingKey = createRoutingKey(channel, group);
        if (!subjects.has(routingKey)) {
            let subject: Subject<Msg<TStructN>> = null;
            const channelConfig = getChannelConfig(channel);
            if (channelConfig) {
                if (
                    channelConfig.replayBufferSize != undefined ||
                    channelConfig.replayWindowTime != undefined
                ) {
                    subject = new ReplaySubject<Msg<TStructN>>(
                        channelConfig.replayBufferSize == undefined
                            ? Infinity
                            : channelConfig.replayBufferSize,
                        channelConfig.replayWindowTime == undefined
                            ? Infinity
                            : channelConfig.replayWindowTime,
                    );
                }
            }
            if (!subject) {
                subject = new Subject<Msg<TStructN>>();
            }
            subjects.set(routingKey, subject);
        }

        return subjects.get(routingKey);
    }

    // flow control: credit-based backpressure for in/out channel pairs (see MsgFlowControl)
    type FlowLease = { count: number; timer: ReturnType<typeof setTimeout> | null };
    type FlowWaiter = { grant: () => void };
    type FlowState = {
        limit: number;
        inFlight: number;
        leases: Map<string, FlowLease>; // key: requestId
        waiters: FlowWaiter[]; // FIFO
    };
    type FlowWait = { timeout?: number; signals: (AbortSignal | undefined)[] };

    const flows: Map<string, FlowState> = new Map(); // key: channel
    // resolved flowControl per channel (null = none); keeps the fast path free of getChannelConfig() spreads
    const flowConfigs: Map<string, MsgFlowControl | null> = new Map();

    function getFlowControl(channel: string, group: string): MsgFlowControl | undefined {
        if (group === $CG_OUT || group === $CG_ERROR) {
            return undefined;
        }
        let flowControl = flowConfigs.get(channel);
        if (flowControl === undefined) {
            flowControl = getChannelConfig(channel).flowControl ?? null;
            if (flowControl && !(flowControl.maxInFlight >= 1)) {
                throw new Error(`[msgBus] flowControl.maxInFlight must be >= 1 (channel "${channel}")`,);
            }
            flowConfigs.set(channel, flowControl);
        }

        return flowControl ?? undefined;
    }

    function getFlowState(channel: string, flowControl: MsgFlowControl) {
        let state = flows.get(channel);
        if (!state) {
            state = {
                limit: flowControl.maxInFlight,
                inFlight: 0,
                leases: new Map(),
                waiters: [],
            };
            flows.set(channel, state);
        }

        return state;
    }

    function getLeaseTimeout(channel: string, flowControl: MsgFlowControl) {
        return flowControl.leaseTimeout ?? getChannelConfig(channel).timeout ?? defaultPromiseTimeout;
    }

    /** Takes a slot: returns undefined when one is free right away, a Promise when the caller must wait. */
    function acquireSlot(
        channel: string,
        flowControl: MsgFlowControl,
        wait: FlowWait,
    ): Promise<void> | undefined {
        const state = getFlowState(channel, flowControl);
        if (state.inFlight < state.limit && state.waiters.length === 0) {
            state.inFlight++;

            return undefined;
        }
        if (flowControl.overflow === 'error') {
            throw new ChannelBusyError(channel);
        }
        const signals = wait.signals.filter((s): s is AbortSignal => !!s);
        for (const signal of signals) {
            if (signal.aborted) {
                throw createOperationCanceledError(signal.reason);
            }
        }

        return new Promise<void>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | null = null;
            const listeners: [AbortSignal, () => void][] = [];
            const dispose = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                for (const [signal, listener] of listeners) {
                    signal.removeEventListener('abort', listener);
                }
                listeners.length = 0;
            };
            const waiter: FlowWaiter = {
                // the released slot is handed over as is: inFlight stays unchanged
                grant: () => {
                    dispose();
                    resolve();
                },
            };
            const fail = (err: unknown) => {
                const index = state.waiters.indexOf(waiter);
                if (index < 0) {
                    return; // already granted
                }
                state.waiters.splice(index, 1);
                dispose();
                reject(err);
            };
            if (wait.timeout != undefined && wait.timeout !== Infinity) {
                timer = setTimeout(
                    () => fail(new TimeoutError(`Timeout waiting for a free slot on channel "${channel}"`)),
                    wait.timeout,
                );
            }
            for (const signal of signals) {
                const listener = () => fail(createOperationCanceledError(signal.reason));
                signal.addEventListener('abort', listener);
                listeners.push([signal, listener]);
            }
            state.waiters.push(waiter);
        });
    }

    /** Registers the slot taken by acquireSlot() under the request id (before publish). */
    function openLease(channel: string, requestId: string, timeout: number) {
        const state = flows.get(channel);
        if (!state) {
            return;
        }
        const lease = state.leases.get(requestId);
        if (lease) {
            lease.count++; // caller-supplied duplicate requestId

            return;
        }
        let timer: ReturnType<typeof setTimeout> | null = null;
        if (timeout > 0 && timeout !== Infinity) {
            timer = setTimeout(() => {
                if (getGlobalFlags().debug) {
                    console.warn(`[msgBus] Flow control lease timeout on channel "${channel}" (requestId: ${requestId}). Slot released without an "out" answer.`,);
                }
                releaseSlot(channel, requestId, true);
            }, timeout);
        }
        state.leases.set(requestId, { count: 1, timer });
    }

    /** Releases a slot (idempotent for unknown request ids) and hands it to the oldest waiter. */
    function releaseSlot(channel: string, requestId: string, all = false) {
        const state = flows.get(channel);
        if (!state) {
            return;
        }
        const lease = state.leases.get(requestId);
        if (!lease) {
            return;
        }
        let count = all ? lease.count : 1;
        lease.count -= count;
        if (lease.count <= 0) {
            if (lease.timer) {
                clearTimeout(lease.timer);
            }
            state.leases.delete(requestId);
        }
        while (count-- > 0) {
            const next = state.waiters.shift();
            if (next) {
                next.grant();
            } else {
                state.inFlight--;
            }
        }
    }

    function getFlowStats(channel: string): MsgFlowStats | undefined {
        const state = flows.get(channel);
        if (!state) {
            return undefined;
        }

        return {
            limit: state.limit,
            inFlight: state.inFlight,
            waiting: state.waiters.length,
            leases: state.leases.size,
        };
    }

    function applyThrottle(
        ops: OperatorFunction<any, any>[],
        throttle?: number | (ThrottleOptions & { duration: number }),
        scheduler?: SchedulerLike,
    ) {
        if (throttle != undefined) {
            let duration: number;
            const options: ThrottleOptions = { leading: true, trailing: true };
            if (typeof throttle === 'number') {
                duration = throttle;
            } else {
                duration = throttle.duration;
                options.leading = throttle.leading;
                options.trailing = throttle.trailing;
            }
            ops.push(throttleOp(duration, options, scheduler));
        }
    }

    function applyDebounce(
        ops: OperatorFunction<any, any>[],
        duration?: number,
        scheduler?: SchedulerLike,
    ) {
        if (duration != undefined) {
            ops.push(debounceOp(duration, scheduler));
        }
    }

    function subscribe(params: MsgSubParams<TStructN>) {
        const channel = String(params.channel);

        const group = params.group == undefined ? $CG_IN : String(params.group);

        const subject = getOrCreateSubject(channel, group);

        const match = getMatchTest(params.topic);

        const fOp: MonoTypeOperatorFunction<Msg<TStructN>> = filterOp((msg) =>
        // msg.address.channel === channel &&
        // msg.address.group === group &&
            match(msg.address.topic) && (!params.filter || params.filter(msg)),);

        let observable: Observable<Msg<TStructN>>;

        const ops: OperatorFunction<any, any>[] = [];

        ops.push(fOp);

        const channelConfig = getChannelConfig(channel);

        applyThrottle(ops, channelConfig?.throttle, scheduler);

        applyThrottle(ops, params.options?.throttle, scheduler);

        applyDebounce(ops, channelConfig?.debounce, scheduler);

        applyDebounce(ops, params.options?.debounce, scheduler);

        if (channelConfig?.delay) {
            ops.push(delayOp(channelConfig.delay, scheduler));
        }

        if (scheduler) {
            ops.push(observeOn(scheduler));
        }

        if (params.options?.fetchCount) {
            ops.push(takeOp(params.options.fetchCount));
        }

        observable = pipeFromArray(ops)(subject);

        if (params.options?.abortSignal?.aborted) {
            return () => { };
        }

        const sub = observable.subscribe({
            next: (msg: Msg<TStructN>) => {
                try {
                    const { payload, ...envelope } = msg;

                    return params.callback({ ...structuredClone(envelope), payload });
                } catch (err) {
                    handleError(msg, err);
                }
            },
            error: (err) => {
                handleError(
                    {
                        address: {
                            channel: channel as keyof TStructN,
                            group: group,
                            topic: params.topic,
                        },
                    },
                    err,
                );
            },
            complete: () => {
                // cleanup
            },
        });

        const abortSignal = params.options?.abortSignal;
        let onAbort: (() => void) | null = null;
        if (abortSignal) {
            onAbort = () => {
                if (getGlobalFlags().debug) {
                    console.debug(`Listening aborted for channel: ${channel}, group: ${group}, topic: ${params.topic}. Reason: ${abortSignal.reason}`, // e.target
                    );
                }
                sub.unsubscribe();
            };
            abortSignal.addEventListener('abort', onAbort);
        }

        // Ensure abort listener is always removed when subscription ends
        // (complete/error/unsubscribe), even if caller doesn't call returned cleanup.
        sub.add(() => {
            if (onAbort && abortSignal) {
                abortSignal.removeEventListener('abort', onAbort);
                onAbort = null;
            }
        });

        return () => {
            if (onAbort && abortSignal) {
                abortSignal.removeEventListener('abort', onAbort);
                onAbort = null;
            }
            sub.unsubscribe();
        };
    }

    function publish(msg: Msg<TStructN>) {
        if (msg.id == undefined) {
            msg.id = uuid();
        }
        if (msg.headers == undefined) {
            msg.headers = {};
        }
        if (msg.status == undefined) {
            msg.status = 'pending' satisfies MsgStatus;
        }
        const headers = msg.headers;
        headers.timestamp = now();
        const channel = String(msg.address.channel);
        if (msg.address.group == undefined) {
            msg.address.group = $CG_IN;
        }
        const group = String(msg.address.group);
        const subject = getOrCreateSubject(channel, group);
        if (!subject.observed) {
            if (getGlobalFlags().debug) {
                console.warn(`[msgBus] No subscribers on channel "${channel}" (group: "${group}"). Message may be lost.`,);
            }
        }
        if (group === $CG_OUT && flows.size > 0 && headers.inResponseToId) {
            // "out" answer (any status) releases the in-flight slot of the request
            releaseSlot(channel, headers.inResponseToId);
        }
        subject.next(msg);

        return Promise.resolve(msg);
    }

    function on(params: MsgSubParams<TStructN>) {
        subscribe(params);
    }

    function once(params: AwaitableMsgSubParams<TStructN>) {
        const channelConfig = getChannelConfig(String(params.channel));
        const timeout =
            params.options?.timeout == undefined
                ? (channelConfig?.timeout ?? defaultPromiseTimeout)
                : params.options?.timeout;
        let settled = false;
        const timeoutAc = new AbortController();

        return Promise.race([
            delayError(timeout, () => new TimeoutError(), timeoutAc.signal),
            new Promise<any>((res, rej) => {
                try {
                    const abortSignal = params.options?.abortSignal;
                    let un: (() => void) | null = null;
                    let cleanup: () => void = () => {
                        un?.();
                        un = null;
                    };

                    if (abortSignal?.aborted) {
                        rej(createOperationCanceledError(abortSignal.reason));

                        return;
                    }

                    if (abortSignal) {
                        let onAbort: (() => void) | null = null;
                        cleanup = () => {
                            abortSignal.removeEventListener('abort', onAbort);
                            un?.();
                            un = null;
                        };
                        onAbort = () => {
                            if (settled) {
                                return;
                            }
                            settled = true;
                            cleanup();
                            rej(createOperationCanceledError(abortSignal.reason));
                        };
                        abortSignal.addEventListener('abort', onAbort);
                    }

                    const subParams: MsgSubParams<TStructN> = {
                        ...params,
                        ...{
                            options: {
                                ...params.options,
                                ...{
                                    fetchCount: 1,
                                },
                            },
                            callback: (msg) => {
                                try {
                                    if (settled) {
                                        return;
                                    }
                                    settled = true;
                                    cleanup?.();
                                    res(msg);
                                } catch (err) {
                                    if (settled) {
                                        return;
                                    }
                                    settled = true;
                                    cleanup?.();
                                    rej(err);
                                }
                            },
                        },
                    };
                    un = subscribe(subParams);
                } catch (e) {
                    rej(e);
                }
            }),
        ]).finally(() => {
            timeoutAc.abort();
        });
    }

    function provide(params: MsgProviderParams<TStructN>) {
        const subParams: MsgSubParams<TStructN> = {
            ...params,
            ...{
                callback: async (inMsg) => {
                    try {
                        const outMsg: Msg<TStructN, keyof TStructN, keyof OutChannelStruct> = {
                            address: {
                                channel: inMsg.address.channel,
                                group: $CG_OUT,
                                topic: inMsg.address.topic,
                            },
                            headers: {
                                ...inMsg.headers,
                                ...params.headers,
                                inResponseToId: inMsg.headers?.requestId,
                            } as Msg<TStructN>['headers'],
                        };
                        const payload = params.callback
                            ? await Promise.resolve(params.callback(inMsg, outMsg))
                            : undefined;
                        if (
                            inMsg.status === 'canceled' ||
                            outMsg.status === 'skipped' ||
                            outMsg.status === 'canceled'
                        ) {
                            if (
                                outMsg.status === 'canceled' &&
                                inMsg.status !== 'canceled' &&
                                flows.size > 0 &&
                                inMsg.headers?.requestId
                            ) {
                                // provider-side cancel publishes no "out": release the slot here
                                releaseSlot(String(inMsg.address.channel), inMsg.headers.requestId);
                            }

                            return;
                        }
                        if (payload !== undefined) {
                            outMsg.payload = payload;
                        }
                        if (outMsg.status == null) {
                            outMsg.status = 'handled';
                        }
                        publish(outMsg);
                    } catch (err) {
                        handleError(inMsg, err, true);
                    }
                },
            },
        };
        subscribe(subParams);
    }

    type MsgDispatcherParams<
        TStruct extends MsgStructBase = MsgStructBase,
        TChannel extends keyof TStruct = keyof TStruct,
        TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
        THeaders extends MsgHeaders = MsgHeaders,
    > = MsgSenderParams<TStruct, TChannel, TGroup, THeaders> & {
        callback?: (msg: Msg<TStruct, TChannel, typeof $CG_OUT, THeaders>) => void;
        /** Internal: how long to wait for a flow control slot (default: options.timeout / options.abortSignal). */
        flowWait?: FlowWait;
    };

    async function dispatch(params: MsgDispatcherParams<TStructN>) {
        const requestId = params.headers?.requestId || uuid();
        const channel = String(params.channel);
        const group = params.group == undefined ? $CG_IN : String(params.group);
        const flowControl = getFlowControl(channel, group);
        let unsub: (() => void) | null = null;
        if (params.callback) {
            const subParams: MsgSubParams<TStructN, keyof TStructN, keyof OutChannelStruct> = {
                channel: params.channel,
                group: $CG_OUT,
                topic: params.topic,
                options: {
                    ...params.options,
                    ...{
                        fetchCount: 1,
                    },
                },
                callback: (outMsg) => {
                    unsub?.();
                    params.callback(outMsg);
                },
                filter: (outMsg) => {
                    return (
                        outMsg.headers?.inResponseToId === requestId &&
                        (!params.filter || params.filter(outMsg))
                    );
                },
            };
            unsub = subscribe(subParams);
        }
        let payload: any;
        if (params.payloadFn) {
            params.payloadFn((...args) => {
                payload = args;
            });
        } else {
            payload = params.payload;
        }
        if (flowControl) {
            try {
                const wait = acquireSlot(
                    channel,
                    flowControl,
                    params.flowWait ?? {
                        timeout: params.options?.timeout,
                        signals: [params.options?.abortSignal],
                    },
                );
                if (wait !== undefined) {
                    await wait;
                }
            } catch (err) {
                unsub?.();
                throw err;
            }
            openLease(channel, requestId, getLeaseTimeout(channel, flowControl));
        }
        let msg: Msg<TStructN>;
        try {
            msg = await publish({
                address: {
                    channel: params.channel,
                    group: params.group,
                    topic: params.topic,
                },
                headers: {
                    ...params.headers,
                    requestId,
                },
                payload: payload,
            });
        } catch (err) {
            if (flowControl) {
                releaseSlot(channel, requestId);
            }
            throw err;
        }
        if (flowControl && !getOrCreateSubject(channel, group).observed) {
            // nobody can answer: do not hold the slot until the lease timeout
            releaseSlot(channel, requestId);
        }

        return msg;
    }

    function send(params: MsgDispatcherParams<TStructN>) {
        const promise = dispatch(params);
        // dispatch() resolved the channel's flow control synchronously above
        if (flowConfigs.get(String(params.channel))) {
            // fire-and-forget safety: unawaited send() must not raise unhandled rejections;
            // awaiting callers still get the rejection
            promise.catch((err) => {
                if (isOperationCanceledError(err)) {
                    return;
                }
                handleError(
                    {
                        address: {
                            channel: params.channel,
                            group: params.group == undefined ? $CG_IN : params.group,
                            topic: params.topic,
                        },
                        headers: params.headers,
                    } as Msg<TStructN>,
                    err,
                );
            });
        }

        return promise;
    }

    async function request(params: MsgRequestDispatcherParams<TStructN>): Promise<any> {
        const channel = String(params.channel);
        const inGroup = params.group == undefined ? $CG_IN : String(params.group);
        const channelConfig = getChannelConfig(channel);
        const inSubject = getOrCreateSubject(channel, inGroup);
        if (!inSubject.observed) {
            if (getGlobalFlags().debug) {
                console.warn(`[msgBus] No handlers on channel "${channel}" (group: "${inGroup}"). Message may be lost.`,);
            }
            if (params.options?.throwIfNoProvider || channelConfig?.mandatoryProvider) {
                throw new NoProviderError(channel);
            }
        }
        const timeout =
            params.options?.timeout == undefined
                ? (channelConfig?.timeout ?? defaultPromiseTimeout)
                : params.options?.timeout;
        let settled = false;
        const timeoutAc = new AbortController();

        return Promise.race([
            delayError(timeout, () => new TimeoutError(), timeoutAc.signal),
            new Promise(async (res, rej) => {
                try {
                    const abortSignal = params.options?.abortSignal;
                    let cleanup: () => void = null;
                    let msg: Msg<TStructN> = null;
                    const dispatchParams: MsgDispatcherParams<TStructN> = {
                        ...params,
                        // slot waiting: bounded by sendTimeout; the caller's abort and the settled
                        // request (timeoutAc aborts in finally) remove a still-waiting dispatch
                        flowWait: {
                            timeout: params.options?.sendTimeout,
                            signals: [abortSignal, timeoutAc.signal],
                        },
                        callback: (msg) => {
                            try {
                                if (settled) {
                                    return;
                                }
                                settled = true;
                                cleanup?.();
                                if (msg.status === 'canceled') {
                                    rej(createOperationCanceledError(
                                        msg,
                                        'The request was canceled by the provider',
                                    ),);

                                    return;
                                } else if (msg.status === 'failed') {
                                    const errHeader = msg.headers?.error;
                                    const errMessage =
                                        typeof errHeader === 'string'
                                            ? errHeader
                                            : (errHeader?.message ?? 'Unknown error');
                                    rej(new Error(errMessage, { cause: msg }));

                                    return;
                                }
                                res(msg);
                            } catch (err) {
                                if (settled) {
                                    return;
                                }
                                settled = true;
                                cleanup?.();
                                rej(err);
                            }
                        },
                    };
                    msg = await dispatch(dispatchParams);

                    if (abortSignal) {
                        let onAbort: () => void = null;
                        cleanup = () => {
                            abortSignal.removeEventListener('abort', onAbort);
                        };
                        onAbort = () => {
                            if (settled) {
                                return;
                            }
                            settled = true;
                            cleanup();
                            publish({
                                address: {
                                    channel: params.channel,
                                    group: $CG_IN,
                                    topic: params.topic,
                                },
                                status: 'canceled' satisfies MsgStatus,
                                headers: { requestId: msg.headers.requestId },
                            });
                            rej(createOperationCanceledError(
                                abortSignal.reason,
                                'The request was canceled by the caller',
                            ),);
                        };
                        if (abortSignal.aborted) {
                            onAbort();

                            return;
                        }
                        abortSignal.addEventListener('abort', onAbort);
                    }
                } catch (err) {
                    rej(err);
                }
            }),
        ]).finally(() => {
            timeoutAc.abort();
        });
    }

    async function* requestStream(params: MsgRequestStreamParams<TStructN>) {
        const channel = String(params.channel);
        const inGroup = params.group == undefined ? $CG_IN : String(params.group);
        const channelConfig = getChannelConfig(channel);
        const inSubject = getOrCreateSubject(channel, inGroup);

        if (!inSubject.observed) {
            if (getGlobalFlags().debug) {
                console.warn(`[msgBus] No handlers on channel "${channel}" (group: "${inGroup}"). Message may be lost.`,);
            }
            if (params.options?.throwIfNoProvider || channelConfig?.mandatoryProvider) {
                throw new NoProviderError(channel);
            }
        }

        const timeout = params.options?.timeout;
        const abortSignal = params.options?.abortSignal;
        const streamEnd = Symbol('stream-end');
        let aborted = false;

        let pendingResolve: ((msg: Msg<TStructN> | typeof streamEnd) => void) | null = null;
        let pendingReject: ((error: any) => void) | null = null;
        let timeoutId: any = null;
        let messageCount = 0;
        const fetchCount = params.options?.fetchCount;

        const resetTimeout = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (timeout && timeout !== Infinity) {
                timeoutId = setTimeout(() => {
                    if (pendingReject) {
                        pendingReject(new TimeoutError());
                        pendingReject = null;
                        pendingResolve = null;
                    }
                }, timeout);
            }
        };

        const resolvePendingAsEnded = () => {
            if (pendingResolve) {
                pendingResolve(streamEnd);
                pendingResolve = null;
                pendingReject = null;
            }
        };

        const requestId = params.headers?.requestId ?? uuid();

        let payload: any;
        if (params.payloadFn) {
            params.payloadFn((...args) => {
                payload = args;
            });
        } else {
            payload = params.payload;
        }

        // Subscribe to out BEFORE publishing to in (same ordering as dispatch())
        const subParams: MsgSubParams<TStructN, keyof TStructN, keyof OutChannelStruct> = {
            channel: params.channel,
            group: $CG_OUT,
            topic: params.topic,
            filter: (outMsg) =>
                outMsg.headers.inResponseToId === requestId &&
                (!params.filter || params.filter(outMsg)),
            options: {
                throttle: params.options?.throttle,
                debounce: params.options?.debounce,
            },
            callback: (msg) => {
                resetTimeout();
                if (pendingResolve) {
                    pendingResolve(msg);
                    pendingResolve = null;
                    pendingReject = null;
                }
            },
        };

        const unsubscribe = subscribe(subParams);

        const flowControl = getFlowControl(channel, inGroup);
        if (flowControl) {
            try {
                const wait = acquireSlot(channel, flowControl, {
                    timeout,
                    signals: [abortSignal],
                });
                if (wait !== undefined) {
                    await wait;
                }
            } catch (err) {
                unsubscribe();
                if (isOperationCanceledError(err)) {
                    return; // aborted while waiting: end the stream quietly, like an abort after publish
                }
                throw err;
            }
            // the first response releases the slot (publish() hook); later responses are no-ops
            openLease(channel, requestId, getLeaseTimeout(channel, flowControl));
        }

        await publish({
            address: {
                channel: params.channel,
                group: params.group,
                topic: params.topic,
            },
            headers: {
                requestId,
                ...params.headers,
            },
            payload,
        });

        if (flowControl && !inSubject.observed) {
            releaseSlot(channel, requestId);
        }

        let onAbort: (() => void) | null = null;
        if (abortSignal) {
            onAbort = () => {
                aborted = true;
                unsubscribe();
                resolvePendingAsEnded();
            };
            if (abortSignal.aborted) {
                onAbort();
            } else {
                abortSignal.addEventListener('abort', onAbort);
            }
        }

        resetTimeout();

        try {
            while ((!fetchCount || messageCount < fetchCount) && !aborted) {
                const msg = await new Promise<Msg<TStructN> | typeof streamEnd>((resolve, reject) => {
                    pendingResolve = resolve;
                    pendingReject = reject;
                },);

                if (msg === streamEnd) break;

                if (msg.status === 'canceled') {
                    throw createOperationCanceledError(
                        msg,
                        'The request was canceled by the provider',
                    );
                } else if (msg.status === 'failed') {
                    const errHeader = msg.headers?.error;
                    const errMessage =
                        typeof errHeader === 'string'
                            ? errHeader
                            : (errHeader?.message ?? 'Unknown error');
                    throw new Error(errMessage, { cause: msg });
                }

                messageCount++;
                yield msg;
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            if (onAbort && abortSignal) {
                abortSignal.removeEventListener('abort', onAbort);
            }
            unsubscribe();
        }
    }

    // : AsyncIterableIterator<Msg<TStructN>>
    async function* stream(params: MsgStreamParams<TStructN>) {
        const timeout = params.options?.timeout;
        const abortSignal = params.options?.abortSignal;
        const streamEnd = Symbol('stream-end'); // sentinel
        let aborted = false;

        let pendingResolve: ((msg: Msg<TStructN> | typeof streamEnd) => void) | null = null;
        let pendingReject: ((error: any) => void) | null = null;
        let timeoutId: any = null;
        let messageCount = 0;
        const fetchCount = params.options?.fetchCount;

        const resetTimeout = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (timeout && timeout !== Infinity) {
                timeoutId = setTimeout(() => {
                    if (pendingReject) {
                        pendingReject(new TimeoutError());
                        pendingReject = null;
                        pendingResolve = null;
                    }
                }, timeout);
            }
        };

        const resolvePendingAsEnded = () => {
            if (pendingResolve) {
                pendingResolve(streamEnd);
                pendingResolve = null;
                pendingReject = null;
            }
        };

        const subParams: MsgSubParams<TStructN> = {
            ...params,
            options: {
                ...params.options,
            },
            callback: (msg) => {
                resetTimeout();
                if (pendingResolve) {
                    pendingResolve(msg);
                    pendingResolve = null;
                    pendingReject = null;
                }
            },
        };

        const unsubscribe = subscribe(subParams);

        let onAbort: (() => void) | null = null;
        if (abortSignal) {
            onAbort = () => {
                aborted = true;
                unsubscribe();
                resolvePendingAsEnded();
            };
            if (abortSignal.aborted) {
                onAbort();
            } else {
                abortSignal.addEventListener('abort', onAbort);
            }
        }

        resetTimeout();

        try {
            while ((!fetchCount || messageCount < fetchCount) && !aborted) {
                const msg = await new Promise<Msg<TStructN> | typeof streamEnd>((resolve, reject) => {
                    pendingResolve = resolve;
                    pendingReject = reject;
                },);

                if (msg === streamEnd) {
                    break;
                }
                messageCount++;
                yield msg;
            }
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            if (onAbort && abortSignal) {
                abortSignal.removeEventListener('abort', onAbort);
            }
            unsubscribe();
        }
    }

    const msgBus: MsgBus<TStruct, THeaders> = {
        config: config,
        on: on as MsgSub<TStructN, THeaders>,
        once: once as AwaitableMsgSub<TStructN, THeaders>,
        stream: stream as MsgStream<TStructN, THeaders>,
        provide: provide as MsgProvider<TStructN, THeaders>,
        send: send as MsgSender<TStructN, THeaders>,
        request: request as MsgRequestDispatcher<TStructN, THeaders>,
        requestStream: requestStream as MsgRequestStream<TStructN, THeaders>,
        getFlowStats: getFlowStats as MsgBus<TStruct, THeaders>['getFlowStats'],
    };

    // msgBus[$subjects] = subjects;

    return msgBus;
}
