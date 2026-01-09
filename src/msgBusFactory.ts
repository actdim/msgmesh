import {
    MsgBus,
    MsgStruct,
    Msg,
    $CG_IN,
    $CG_OUT,
    MsgBusConfig,
    MsgSubscriberParams,
    MsgAsyncSubscriberParams,
    MsgProviderParams,
    MsgDispatcherParams,
    MsgAsyncDispatcherParams,
    MsgStructNormalized,
    $CG_ERROR,
    $C_ERROR,
    MsgHeaders,
    TimeoutError
} from "./msgBusCore";
import { v4 as uuid } from "uuid";
import { MonoTypeOperatorFunction, Observable, Subject, ReplaySubject, asyncScheduler, OperatorFunction, SchedulerLike } from "rxjs";
import { filter as filterOp, take as takeOp, observeOn, delay as delayOp, debounceTime as debounceOp } from "rxjs/operators";

import { Skip } from "@actdim/utico/typeCore";
import { pipeFromArray, throttleOp, ThrottleOptions } from "./util";
import { delayErrorAsync } from "@actdim/utico/utils";

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

    const errTopic = "msgbus";
    const scheduler: SchedulerLike = asyncScheduler;

    function getMsgInfo(msg: Msg<TStructN>) {
        return {
            id: msg.id,
            address: msg.address,
            headers: msg.headers
        } as MsgInfo;
    }

    function handleError(srcMsg: Msg<TStructN>, err: any) {
        const errPayload = {
            error: err,
            source: getMsgInfo(srcMsg)
        } as Msg<TStructN>["payload"];
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
    // observables
    const subjects: Map<string, Subject<Msg<TStructN>>> = new Map();

    function createRoutingKey(channel: string, group: string) {
        return `${channel}${groupPrefix}${group}`;
    }

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

    function subscribe(params: MsgSubscriberParams<TStructN>) {
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

        applyThrottle(ops, params.config?.throttle, scheduler);

        applyDebounce(ops, channelConfig?.debounce, scheduler);

        applyDebounce(ops, params.config?.debounce, scheduler);

        if (channelConfig?.delay) {
            ops.push(delayOp(channelConfig.delay, scheduler));
        }

        if (scheduler) {
            ops.push(observeOn(scheduler));
        }

        if (params.config?.fetchCount) {
            ops.push(takeOp(params.config.fetchCount));
        }

        observable = pipeFromArray(ops)(subject);

        // TODO: support retryOp
        // TODO: support timeout
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

        const abortSignal = params.config?.abortSignal;
        abortSignal?.addEventListener("abort", (e) => {
            // TODO: publish debug (internal) message
            console.debug(
                `Listening aborted for channel: ${channel}, group: ${group}, topic: ${params.topic}. Reason: ${abortSignal.reason}` // e.target
            );
            sub.unsubscribe();
        });
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
        return msg;
    }

    function on(params: MsgSubscriberParams<TStructN>) {
        subscribe(params);
    }

    function onceAsync(params: MsgAsyncSubscriberParams<TStructN>) {
        const timeout = params.config?.timeout == undefined ? DEFAULT_PROMISE_TIMEOUT : params.config?.timeout;
        let settled = false;
        return Promise.race([delayErrorAsync(timeout, () => new TimeoutError()), new Promise<any>((res, rej) => {
            try {
                const abortSignal = params.config?.abortSignal;
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
                        rej(new Error("Cancelled", { cause: abortSignal.reason })); // e.target
                    };
                    abortSignal.addEventListener("abort", onAbort);
                }

                const subParams: MsgSubscriberParams<TStructN> = {
                    ...params,
                    ...{
                        config: {
                            ...params.config,
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
                                // sub.unsubscribe();
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
                subscribe(subParams);
            } catch (e) {
                rej(e);
            }
        })]);
    }

    function provide(params: MsgProviderParams<TStructN>) {
        const subParams: MsgSubscriberParams<TStructN> = {
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

    function dispatch(params: MsgDispatcherParams<TStructN>) {
        const msgId = uuid();
        if (params.callback) {
            const subParams: MsgSubscriberParams<TStructN, keyof TStructN, typeof $CG_OUT> = {
                channel: params.channel,
                group: $CG_OUT,
                topic: params.topic,
                config: {
                    ...params.config,
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
        const msgIn = publish({
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

    async function dispatchAsync(params: MsgAsyncDispatcherParams<TStructN>): Promise<any> {
        const timeout = params.config?.timeout == undefined ? DEFAULT_PROMISE_TIMEOUT : params.config?.timeout;
        let settled = false;
        return Promise.race([delayErrorAsync(timeout, () => new TimeoutError()), new Promise((res, rej) => {
            try {
                const abortSignal = params.config?.abortSignal;
                let cleanup: () => void = null;

                if (abortSignal) {
                    let onAbort: () => void = null;
                    const cleanup = () => {
                        abortSignal.removeEventListener("abort", onAbort);
                    };
                    onAbort = () => {
                        if (settled) {
                            return
                        };
                        settled = true;
                        cleanup();
                        rej(new Error("Cancelled", { cause: abortSignal.reason })); // e.target
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

    const msgBus: MsgBus<TStruct, THeaders> = {
        config: config,
        on: (params) => on(params as MsgSubscriberParams<TStructN>),
        onceAsync: (params) => onceAsync(params as MsgAsyncSubscriberParams<TStructN>),
        stream: (params) => {
            throw new Error("Not implemented");
        },
        provide: (params) => provide(params as MsgProviderParams<TStructN>),
        dispatch: (params) => dispatch(params as MsgDispatcherParams<TStructN>),
        dispatchAsync: (params) => dispatchAsync(params as MsgAsyncDispatcherParams<TStructN>),
    };

    // msgBus["#subjects"] = subjects;

    return msgBus;
}

// class MessageBus<TStruct extends MsgBusStruct>
//     implements IMsgBus<TStruct>
// {
//     constructor() {}
//     // ...
// }
