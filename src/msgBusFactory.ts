import {
    MsgBus,
    MsgBusStruct,
    Msg,
    $CG_IN,
    $CG_OUT,
    MsgBusConfig,
    MsgBusSubscriberParams,
    MsgBusAsyncSubscriberParams,
    MsgBusProviderParams,
    MsgBusDispatcherParams,
    MsgBusAsyncDispatcherParams,
    MsgBusStructNormalized,
    $CG_ERROR,
    $C_ERROR,
    MsgHeaders
} from "./msgBusCore";
import { v4 as uuid } from "uuid";
import { MonoTypeOperatorFunction, Observable, Subject, ReplaySubject, asyncScheduler, queueScheduler, OperatorFunction, UnaryFunction, timer } from "rxjs";
import { filter as filterOp, take as takeOp, retry as retryOp, observeOn as observeOnOp, delay as delayOp, throttle as throttleOp, auditTime as auditTimeOp, switchMap as switchMapOp, concatMap as concatMapOp, mergeMap as mergeMapOp, groupBy as groupByOp, timeout as timeoutOp, takeUntil as takeUntilOp } from "rxjs/operators";

import { Skip } from "@actdim/utico/typeCore";

export function identity<T>(x: T): T {
    return x;
}

export function pipeFromArray<T, R>(fns: Array<UnaryFunction<T, R>>): UnaryFunction<T, R> {
    if (fns.length === 0) {
        return identity as UnaryFunction<any, any>;
    }

    if (fns.length === 1) {
        return fns[0];
    }

    return function piped(input: T): R {
        return fns.reduce((prev: any, fn: UnaryFunction<T, R>) => fn(prev), input as any);
    };
}

const getMatchTest = (pattern: string) => {
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

// see also https://www.npmjs.com/package/p-queue
// https://github.com/postaljs/postal.js

// createServiceBus
const groupPrefix = ":"; // "/", ":", "::"
export function createMsgBus<TStruct extends MsgBusStruct, THeaders extends MsgHeaders = MsgHeaders>(config?: MsgBusConfig<MsgBusStructNormalized<TStruct>>) {
    type TStructN = MsgBusStructNormalized<TStruct>;
    type MsgInfo = Skip<Msg<TStructN>, "payload">;
    const errTopic = "msgbus";

    function now() {
        return Date.now(); // new Date().getTime() or +new Date()
    }

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
            const channelConfig = config[channel];
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

    function subscribe(params: MsgBusSubscriberParams<TStructN>) {
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

        const channelConfig = config[channel];
        switch (channelConfig?.deliveryType || "async") {
            case "async":
                ops.push(observeOnOp(asyncScheduler));
                break;
            case "queue":
                ops.push(observeOnOp(queueScheduler));
                break;
            case "inline":
                break;
        }

        if (params.config?.fetchCount) {
            ops.push(takeOp(params.config.fetchCount));
        }

        observable = pipeFromArray(ops)(subject);

        // TODO: support retryOp
        // TODO: observeOnOp(asyncScheduler)
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
            console.log(
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

    function on(params: MsgBusSubscriberParams<TStructN>) {
        subscribe(params);
    }

    function onceAsync(params: MsgBusAsyncSubscriberParams<TStructN>) {
        return new Promise<any>((res, rej) => {
            try {
                const abortSignal = params.config?.abortSignal;
                abortSignal?.addEventListener("abort", (e) => {
                    rej(new Error("Cancelled", { cause: abortSignal.reason })); // e.target
                });
                const subParams: MsgBusSubscriberParams<TStructN> = {
                    ...params,
                    ...{
                        config: {
                            ...params.config,
                            ...{
                                fetchCount: 1
                            }
                        },
                        callback: (msg) => {
                            // sub.unsubscribe();
                            res(msg);
                        }
                    }
                };
                subscribe(subParams);
            } catch (e) {
                rej(e);
            }
        });
    }

    function provide(params: MsgBusProviderParams<TStructN>) {
        const subParams: MsgBusSubscriberParams<TStructN> = {
            ...params,
            ...{
                callback: async (msgIn) => {
                    try {
                        const msgOut: Msg<TStructN, keyof TStructN, typeof $CG_OUT> = {
                            address: {
                                channel: msgIn.address.channel,
                                group: $CG_OUT,
                                topic: msgIn.address.topic
                            },
                            headers: {
                                ...msgIn.headers,
                                requestId: msgIn.id,
                            }
                        };
                        const payload = (await Promise.resolve(params.callback(msgIn, msgOut)));
                        msgOut.payload = payload;
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

    function dispatch(params: MsgBusDispatcherParams<TStructN>) {
        const msgId = uuid();
        if (params.callback) {
            const subParams: MsgBusSubscriberParams<TStructN, keyof TStructN, typeof $CG_OUT> = {
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
            params.payloadFn((args) => {
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

    async function dispatchAsync(params: MsgBusAsyncDispatcherParams<TStructN>): Promise<any> {
        return new Promise((res, rej) => {
            try {
                const abortSignal = params.config?.abortSignal;
                abortSignal?.addEventListener("abort", (e) => {
                    rej(new Error("Cancelled", { cause: abortSignal.reason })); // e.target
                });
                const dispatchParams: MsgBusDispatcherParams<TStructN> = {
                    ...params,
                    callback: (msg) => {
                        try {
                            res(msg);
                        } catch (err) {
                            rej(err);
                        }
                    }
                };
                dispatch(dispatchParams);
            } catch (err) {
                rej(err);
            }
        });
    }

    const msgBus: MsgBus<TStruct, THeaders> = {
        config: config,
        on: (params) => on(params as MsgBusSubscriberParams<TStructN>),
        onceAsync: (params) => onceAsync(params as MsgBusAsyncSubscriberParams<TStructN>),
        stream: (params) => {
            throw new Error("Not implemented");
        },
        provide: (params) => provide(params as MsgBusProviderParams<TStructN>),
        dispatch: (params) => dispatch(params as MsgBusDispatcherParams<TStructN>),
        dispatchAsync: (params) => dispatchAsync(params as MsgBusAsyncDispatcherParams<TStructN>),
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
