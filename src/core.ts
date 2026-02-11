import {
    MsgBus,
    MsgStruct,
    Msg,
    $CG_IN,
    $CG_OUT,
    MsgBusConfig,
    MsgSubParams,
    AwaitableMsgSubParams,
    MsgProviderParams,
    MsgStructNormalized,
    $CG_ERROR,
    $C_ERROR,
    MsgHeaders,
    TimeoutError,
    OperationCanceledError,
    MsgRequestDispatcherParams,
    ErrorPayload,
    $SYSTEM_TOPIC,
    MsgStreamParams,
    MsgStream,
    MsgSub,
    AwaitableMsgSub,
    MsgProvider,
    MsgSender,
    MsgRequestDispatcher,
    MsgSenderParams
} from "./contracts";
import { v4 as uuid } from "uuid";
import { MonoTypeOperatorFunction, Observable, Subject, ReplaySubject, asyncScheduler, OperatorFunction, SchedulerLike } from "rxjs";
import { filter as filterOp, take as takeOp, observeOn, delay as delayOp, debounceTime as debounceOp } from "rxjs/operators";

import { Skip } from "@actdim/utico/typeCore";
import { pipeFromArray, throttleOp, ThrottleOptions } from "./util";
import { delayError } from "@actdim/utico/utils";

export const getMatchTest = (pattern: string) => {
    if (pattern == undefined) {
        // return (value: string) => true;
        return (value: string) => value == pattern;
    }
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
        pattern = pattern.substring(1, pattern.length - 1);
        const regexp = new RegExp(pattern);
        return (value: string) => regexp.test(value);
    } else {
        return (value: string) => pattern === value;
    }
};

const DEFAULT_PROMISE_TIMEOUT = 1000 * 60 * 2; // 2 minutes

// see also https://www.npmjs.com/package/p-queue
// https://github.com/postaljs/postal.js

function now() {
    return Date.now(); // new Date().getTime() or +new Date()
}

// createServiceBus
const groupPrefix = ":"; // "/", ":", "::"
export function createMsgBus<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders>(config?: MsgBusConfig<MsgStructNormalized<TStruct>>) {
    type TStructN = MsgStructNormalized<TStruct>;
    type MsgInfo = Skip<Msg<TStructN>, "payload">;

    const errTopic = $SYSTEM_TOPIC;
    const scheduler: SchedulerLike = asyncScheduler;

    function getMsgInfo(msg: Msg<TStructN>) {
        return {
            id: msg.id,
            address: msg.address,
            headers: msg.headers
        } as MsgInfo;
    }

    function handleError(srcMsg: Msg<TStructN>, err: any) {
        // TODO: keep original error only in debug mode
        // if (err instanceof Error) {
        //     err = {
        //         name: err.name,
        //         message: err.message,
        //         stack: err.stack,
        //         cause: err.cause
        //     };
        // }
        const errPayload = ({
            error: err,
            source: getMsgInfo(srcMsg)
        } satisfies ErrorPayload) as Msg<TStructN>["payload"];
        let errMsg: Msg<TStructN>;
        errMsg = {
            address: {
                channel: srcMsg.address.channel,
                group: $CG_ERROR,
                topic: errTopic
            },
            payload: errPayload
        };
        publish(errMsg);
        errMsg = {
            address: {
                channel: $C_ERROR,
                group: $CG_IN,
                topic: errTopic
            },
            payload: errPayload
        };
        publish(errMsg);
        // + nack?
    }

    function createOperationCanceledError(reason: unknown) {
        return new OperationCanceledError(undefined, reason);
    }

    // observables
    const subjects: Map<string, Subject<Msg<TStructN>>> = new Map();

    function createRoutingKey(channel: string, group: string) {
        return `${channel}${groupPrefix}${group}`;
    }

    // TODO: use for subjects
    // type MsgRecord = {
    //     msg: Msg<TStructN>;
    //     acked: boolean;
    //     // ackTimestamp
    //     ackedAt?: number;
    // }

    function getOrCreateSubject(channel: string, group: string): Subject<Msg<TStructN>> {
        const routingKey = createRoutingKey(channel, group);
        // TODO: support BehaviorSubject
        if (!subjects.has(routingKey)) {
            let subject: Subject<Msg<TStructN>> = null;
            const channelConfig = config?.[channel];
            if (channelConfig) {
                if (channelConfig.replayBufferSize != undefined || channelConfig.replayWindowTime != undefined) {
                    subject = new ReplaySubject<Msg<TStructN>>(channelConfig.replayBufferSize == undefined ? Infinity : channelConfig.replayBufferSize, channelConfig.replayWindowTime == undefined ? Infinity : channelConfig.replayWindowTime);
                }
            }
            if (!subject) {
                subject = new Subject<Msg<TStructN>>();
            }
            subjects.set(routingKey,
                subject
            );
        }
        return subjects.get(routingKey);
    }

    function applyThrottle(ops: OperatorFunction<any, any>[], throttle?: number | (ThrottleOptions & { duration: number; }), scheduler?: SchedulerLike) {
        if (throttle != undefined) {
            let duration: number;
            let options: ThrottleOptions = { leading: true, trailing: true };
            if (typeof throttle === "number") {
                duration = throttle;
            } else {
                duration = throttle.duration;
                options.leading = throttle.leading;
                options.trailing = throttle.trailing;
            }
            ops.push(throttleOp(duration, options, scheduler));
        }
    }

    function applyDebounce(ops: OperatorFunction<any, any>[], duration?: number, scheduler?: SchedulerLike) {
        if (duration != undefined) {
            ops.push(debounceOp(duration, scheduler));
        }
    }

    function subscribe(params: MsgSubParams<TStructN>) {
        // TODO: use [channel, group] as key?

        const channel = String(params.channel);

        const group = params.group == undefined ? $CG_IN : String(params.group);

        const subject = getOrCreateSubject(channel, group);

        const match = getMatchTest(params.topic);

        const fOp: MonoTypeOperatorFunction<Msg<TStructN>> = filterOp(
            (msg) =>
                // msg.address.channel === channel &&
                // msg.address.group === group &&
                match(msg.address.topic) && (!params.filter || params.filter(msg))
        );

        let observable: Observable<Msg<TStructN>>;

        const ops: OperatorFunction<any, any>[] = [];

        ops.push(fOp);

        const channelConfig = config?.[channel];

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

        const sub = observable.subscribe({
            next: (msg: Msg<TStructN>) => {
                try {
                    return params.callback(msg);
                } catch (err) {
                    handleError(msg, err);
                    // throw err;
                }
            },
            error: (err) => {
                handleError(
                    {
                        address: {
                            channel: channel,
                            group: group,
                            topic: params.topic
                        }
                    },
                    err
                );
            },
            complete: () => {
                // cleanup
            }
        });

        const abortSignal = params.options?.abortSignal;
        let onAbort: (() => void) | null = null;
        if (abortSignal) {
            onAbort = () => {
                // TODO: publish debug (internal) message
                console.debug(
                    `Listening aborted for channel: ${channel}, group: ${group}, topic: ${params.topic}. Reason: ${abortSignal.reason}` // e.target
                );
                sub.unsubscribe();
            };
            abortSignal.addEventListener("abort", onAbort);
        }

        // Ensure abort listener is always removed when subscription ends
        // (complete/error/unsubscribe), even if caller doesn't call returned cleanup.
        sub.add(() => {
            if (onAbort && abortSignal) {
                abortSignal.removeEventListener("abort", onAbort);
                onAbort = null;
            }
        });

        return () => {
            if (onAbort && abortSignal) {
                abortSignal.removeEventListener("abort", onAbort);
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
        const headers = msg.headers;
        headers.publishedAt = now()
        const channel = String(msg.address.channel);
        if (msg.address.group == undefined) {
            msg.address.group = $CG_IN;
        }
        const group = String(msg.address.group);
        const subject = getOrCreateSubject(channel, group);
        subject.next(msg);
        // TODO: implement backpressure using signal after auto-'ack' or "out" msg signal
        return Promise.resolve(msg);
    }

    function on(params: MsgSubParams<TStructN>) {
        subscribe(params);
    }

    function once(params: AwaitableMsgSubParams<TStructN>) {
        const timeout = params.options?.timeout == undefined ? DEFAULT_PROMISE_TIMEOUT : params.options?.timeout;
        let settled = false;
        return Promise.race([delayError(timeout, () => new TimeoutError()), new Promise<any>((res, rej) => {
            try {
                const abortSignal = params.options?.abortSignal;
                let un: (() => void) | null = null;
                let cleanup: () => void = () => {
                    un?.();
                    un = null;
                };

                if (abortSignal) {
                    let onAbort: (() => void) | null = null;
                    cleanup = () => {
                        abortSignal.removeEventListener("abort", onAbort);
                        un?.();
                        un = null;
                    };
                    onAbort = () => {
                        if (settled) {
                            return
                        };
                        settled = true;
                        cleanup();
                        rej(createOperationCanceledError(abortSignal.reason));
                    };
                    abortSignal.addEventListener("abort", onAbort);
                }

                const subParams: MsgSubParams<TStructN> = {
                    ...params,
                    ...{
                        options: {
                            ...params.options,
                            ...{
                                fetchCount: 1
                            }
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
                        }
                    }
                };
                un = subscribe(subParams);
            } catch (e) {
                rej(e);
            }
        })]);
    }

    function provide(params: MsgProviderParams<TStructN>) {
        const subParams: MsgSubParams<TStructN> = {
            ...params,
            ...{
                callback: async (msgIn) => {
                    try {
                        const headers = {
                            ...msgIn.headers,
                            ...params.headers,
                            requestId: msgIn.id,
                        }
                        const payload = (await Promise.resolve(params.callback(msgIn, headers)));
                        const msgOut: Msg<TStructN, keyof TStructN, typeof $CG_OUT> = {
                            address: {
                                channel: msgIn.address.channel,
                                group: $CG_OUT,
                                topic: msgIn.address.topic
                            },
                            headers: headers,
                            payload: payload
                        };
                        publish(msgOut);
                    } catch (err) {
                        handleError(msgIn, err);
                        // throw err;
                    }
                }
            }
        };
        subscribe(subParams);
    }

    type MsgDispatcherParams<
        TStruct extends MsgStruct = MsgStruct,
        TChannel extends keyof TStruct = keyof TStruct,
        TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
        THeaders extends MsgHeaders = MsgHeaders
    > = MsgSenderParams<TStruct, TChannel, TGroup, THeaders> & {
        callback?: (msg: Msg<TStruct, TChannel, typeof $CG_OUT, THeaders>) => void;
    };

    async function dispatch(params: MsgDispatcherParams<TStructN>) {
        const msgId = uuid();
        if (params.callback) {
            const subParams: MsgSubParams<TStructN, keyof TStructN, typeof $CG_OUT> = {
                channel: params.channel,
                group: $CG_OUT,
                topic: params.topic,
                options: {
                    ...params.options,
                    ...{
                        fetchCount: 1
                    }
                },
                callback: (msgOut) => {
                    // sub.unsubscribe();
                    params.callback(msgOut);
                },
                filter: (msgOut) => {
                    return msgOut.headers?.requestId === msgId && (!params.filter || params.filter(msgOut)) // TODO: match topic?
                }
            };
            subscribe(subParams);
        }
        let payload: any;
        if (params.payloadFn) {
            params.payloadFn((...args) => {
                payload = args;
            });
        } else {
            payload = params.payload;
        }
        await publish({
            id: msgId,
            address: {
                channel: params.channel,
                group: params.group,
                topic: params.topic
            },
            headers: {
                ...params.headers
            },
            payload: payload
        });
    }

    async function request(params: MsgRequestDispatcherParams<TStructN>): Promise<any> {
        const timeout = params.options?.timeout == undefined ? DEFAULT_PROMISE_TIMEOUT : params.options?.timeout;
        let settled = false;
        return Promise.race([delayError(timeout, () => new TimeoutError()), new Promise((res, rej) => {
            try {
                const abortSignal = params.options?.abortSignal;
                let cleanup: () => void = null;

                if (abortSignal) {
                    let onAbort: () => void = null;
                    cleanup = () => {
                        abortSignal.removeEventListener("abort", onAbort);
                    };
                    onAbort = () => {
                        if (settled) {
                            return
                        };
                        settled = true;
                        cleanup();
                        rej(createOperationCanceledError(abortSignal.reason));
                    };
                    abortSignal.addEventListener("abort", onAbort);
                }

                const dispatchParams: MsgDispatcherParams<TStructN> = {
                    ...params,
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
                    }
                };
                dispatch(dispatchParams);
            } catch (err) {
                rej(err);
            }
        })]);
    }

    // : AsyncIterableIterator<Msg<TStructN>>
    async function* stream(params: MsgStreamParams<TStructN>) {
        const timeout = params.options?.timeout;
        const abortSignal = params.options?.abortSignal;
        const streamEnd = Symbol("stream-end"); // sentinel
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
                ...params.options
            },
            callback: (msg) => {
                resetTimeout();
                if (pendingResolve) {
                    pendingResolve(msg);
                    pendingResolve = null;
                    pendingReject = null;
                }
            }
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
                abortSignal.addEventListener("abort", onAbort);
            }
        }

        resetTimeout();

        try {
            while ((!fetchCount || messageCount < fetchCount) && !aborted) {
                const msg = await new Promise<Msg<TStructN> | typeof streamEnd>((resolve, reject) => {
                    pendingResolve = resolve;
                    pendingReject = reject;
                });

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
                abortSignal.removeEventListener("abort", onAbort);
            }
            unsubscribe();
        }
    }

    const msgBus: MsgBus<TStruct, THeaders> = {
        config: config,
        on: on as MsgSub<MsgStructNormalized<TStruct>, THeaders>,
        once: once as AwaitableMsgSub<MsgStructNormalized<TStruct>, THeaders>,
        stream: stream as MsgStream<MsgStructNormalized<TStruct>, THeaders>,
        provide: provide as MsgProvider<MsgStructNormalized<TStruct>, THeaders>,
        send: dispatch as MsgSender<MsgStructNormalized<TStruct>, THeaders>,
        request: request as MsgRequestDispatcher<MsgStructNormalized<TStruct>, THeaders>
    };

    // msgBus["#subjects"] = subjects;

    return msgBus;
}

// TODO: support persistence
// TODO: support unsubscribe (abort) alias (like in hooks)
// TODO: support msg ack via custom RepeatSubject and MsgRecord: (no acked messages in queue, auto ack on publish to "out" channel)
// TODO: support rate limiting (for single channel) and backpressure (for "in" and "out" channel pair), real send promise
// TODO: support TTL, maxBufferLength
/*
class RepeatSubject<T> {
  private buffer: Msg<T>[] = [];
  private subject = new Subject<Msg<T>>();

  next(msg: Msg<T>) {
    this.buffer.push(msg);
    this.subject.next(msg);
  }

  subscribe(
    observer: (msg: Msg<T>) => void,
    filterFn?: (msg: Msg<T>) => boolean
  ) { 
    this.buffer.filter(filterFn ?? (() => true)).forEach(observer);
    
    return this.subject.subscribe(observer);
  }
}
*/
