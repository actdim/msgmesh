//##############################################################################
//# Copyright (c) Pavel Borodaev 2022                                         #
//##############################################################################
// SafeBus
import { IsTuple, MaybePromise, Overwrite, Skip } from "@actdim/utico/typeCore";
import { ThrottleOptions } from "./util";

export const $CG_IN = "in";

export const $CG_OUT = "out";

export const $CG_ERROR = "error";

export const $C_ERROR = "error";

export type InParam = {
    // [key in typeof $CG_IN]: any;
    [$CG_IN]: any;
};

export type OutParam = {
    // [key in typeof $CG_OUT]: any;
    [$CG_OUT]: any;
};

export type ErrorPayload = {
    error: any; // reason
    source?: any;
    handled?: boolean;
};

export type ErrorParam<T extends ErrorPayload = ErrorPayload> = {
    // [key in typeof $CG_ERROR]: any;
    [$CG_ERROR]: T;
};

export class BaseError extends Error {
    readonly name: string = 'BaseError';

    constructor(
        message: string,
        options?: {
            cause?: unknown;
        }
    ) {
        super(message, options);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class TimeoutError extends BaseError {
    readonly name: string = 'TimeoutError';

    constructor(message?: string, cause?: unknown) {
        // Operation
        super(message || "Timeout exceeded", { cause });
    }
}

export class AbortError extends BaseError {
    readonly name: string = 'AbortError';

    constructor(message?: string, cause?: unknown) {
        super(message || "Operation aborted", { cause });
    }
}

// ReservedChannelGroup
export type SystemChannelGroup = `${keyof InParam | keyof OutParam | keyof OutParam}`;

// TODO:
// Point-to-Point (P2P): direct messaging with targeted, address delivery (exactly one recipient)
// Broadcast
// Queue group: Load Balancing, Round-Robin, Fan-out, Fan-in
// QoS
// Message Filtering
// Cross-tab message delivery:
// https://www.sitepen.com/blog/cross-tab-synchronization-with-the-web-locks-api
// https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
// LocalStorage
// https://github.com/GoogleChromeLabs/comlink

export type MsgChannelStruct = Partial<{ [group: string]: any } & InParam & OutParam & ErrorParam>;

// type MsgChannelStruct = { [group: string]: any } & (
//   | InParam
//   | OutParam
//   | (InParam & OutParam)
// );

// SystemMsgtruct
export type MsgStructBase = {
    [$C_ERROR]?: {
        [$CG_IN]: ErrorPayload;
    };
    // "*": {
    //     [$CG_IN]: any;
    // };
};

export type MsgStruct = {
    [channel: string]: MsgChannelStruct;
} & MsgStructBase;

// MsgStructBuilder
export type MsgStructFactory<
    TStruct extends TStructBase,
    TStructBase extends MsgStruct = MsgStruct
> = {
        [C in keyof TStruct]: TStruct[C] & ErrorParam;
    };

// export type MsgStruct = Record<string, MsgChannelStruct>;

export type InStruct<TStruct extends MsgStruct, TChannel extends keyof TStruct> = TStruct[TChannel] extends InParam
    ? TStruct[TChannel]["in"] // keyof InParam or typeof $CG_IN
    : undefined; // never

// export type InStruct<
//   TStruct extends MsgStruct,
//   TChannel extends keyof TStruct
// > = TStruct[TChannel] extends InParam ? TStruct[TChannel]["in"] : never;

export type OutStruct<TStruct extends MsgStruct, TChannel extends keyof TStruct> = TStruct[TChannel] extends OutParam
    ? TStruct[TChannel][keyof OutParam]
    : undefined;

// export type OutStruct<
//   TStruct extends MsgStruct,
//   TChannel extends keyof TStruct
// > = TStruct[TChannel] extends OutParam ? TStruct[TChannel]["out"] : never;

export type AckMode = 'atLeastOne' | 'all';

// Options/Settings
export type MsgChannelConfig<TChannel> = {
    // (channel) message queue distribution and processing strategy
    replayCount?: number;
    initialValues?: { [TGroup in keyof TChannel]: TChannel[TGroup] };
    // persistent?: boolean; // durable? (for durable queue)
    // secure?: boolean; // encrypted
    // federated?: boolean; // broadcasting
    // autoDeleteTimeout?: number;
    // ackMode: AckMode;
    // requireAck: boolean;
    // noAck?: boolean; // noAutoAck
    // manualAck?: boolean;
    // prefetchCount?: number; // for manual acknowledgment
    // this can be used for some consumer or for all consumers of the channel
    // maxConcurrentConsumers?: number; // Parallel? Processes? Handlers?
    replayBufferSize?: number;
    replayWindowTime?: number;

    delay?: number;
    throttle?: number | (ThrottleOptions & { duration: number; });
    debounce?: number;
};

export type MsgSubscriberConfig = {
    fetchCount?: number;
    abortSignal?: AbortSignal;

    throttle?: number | (ThrottleOptions & { duration: number; });
    debounce?: number;
};

export type MsgDispatcherConfig = MsgSubscriberConfig & {
    priority?: number;
};

export type MsgAsyncSubscriberConfig = {
    abortSignal?: AbortSignal;
    timeout?: number;
};

export type MsgAsyncDispatcherConfig = MsgAsyncSubscriberConfig & {
    priority?: number;
};

export type MsgBusConfig<TStruct extends MsgStruct> = {
    [TChannel in keyof TStruct]?: MsgChannelConfig<TStruct[TChannel]>;
}; // Record<string, MsgChannelConfig>

export type MsgAddress<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel] // typeof $CG_IN
> = {
    channel: TChannel;
    group?: TGroup; // typeGroup
    // supports wildcard matching (https://docs.nats.io/nats-concepts/subjects#wildcards)
    topic?: string;
    version?: string;
};

export type MsgHeaders = {

    // similar to inReplyToId
    inResponseToId?: string;
    version?: string; // schemaVersion

    requestId?: string;

    // routing hints
    sourceId?: string; // senderId/producerId
    targetId?: string; // receiverId/recipientId

    originId?: string;

    correlationId?: string; // activityId
    traceId?: string;

    // timestamps (unix epoch, ms):
    publishedAt?: number;

    priority?: number;
    persistent?: boolean; // durable? (for durable queue)

    tags?: string | string[];

    auth?: {
        userId?: string;
        token?: string;
    }

    absoluteExpiration?: number;
    ttl?: number;
    slidingExpiration?: number;

    // ack/nack policy
    // requireAck: boolean;
    // ackMode: AckMode;

    // retryCount?: number;
    // deliveryAttempt?: number;

    // audience
    // intent    
    // subject
    // group
    // schema
    // scope        
};

// TODO: support MsgStatus
// export type MsgStatus = "pending" | "sent" | "delivered" | "processed" | "failed" | "expired";

// TODO: support ack/nack
// TODO: integrate with https://github.com/connor4312/cockatiel 
// MsgEnvelope
export type Msg<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders // Record<string, string>
> = {
    // transportId
    id?: string;
    address: MsgAddress<TStruct, TChannel, TGroup>;
    payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
    headers?: THeaders;
};

export type MsgSubscriberParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
    THeaders extends MsgHeaders = MsgHeaders
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    // topicSelector?: string | ((channel: string) => boolean);
    callback?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => void;
    config?: MsgSubscriberConfig;
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
};

// MsgSubscriberFn
export type MsgSubscriber<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgSubscriberParams<TStruct, TChannel, TGroup, THeaders>
) => void;

// MsgAsyncSubIterator(Fn)
export type MsgStreamer<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgSubscriberParams<TStruct, TChannel, TGroup>
) => AsyncIterableIterator<Msg<TStruct, TChannel, TGroup, THeaders>>; // TGroup extends undefined ? typeof $CG_IN : TGroup

export type MsgAsyncSubscriberParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
    THeaders extends MsgHeaders = MsgHeaders
> = Overwrite<Skip<MsgSubscriberParams<TStruct, TChannel, TGroup, THeaders>, "callback">, {
    config?: MsgAsyncSubscriberConfig
}>;

// MsgAsyncSubscriberFn
export type MsgAsyncSubscriber<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgAsyncSubscriberParams<TStruct, TChannel, TGroup>
) => Promise<Msg<TStruct, TChannel, TGroup, THeaders>>; // TGroup extends undefined ? typeof $CG_IN : TGroup

export type MsgProviderParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
    THeaders extends MsgHeaders = MsgHeaders
> = Overwrite<
    MsgSubscriberParams<TStruct, TChannel, TGroup, THeaders>,
    {
        // resolve
        callback?: (msgIn: Msg<TStruct, TChannel, TGroup, THeaders>, headers?: THeaders) => MaybePromise<OutStruct<TStruct, TChannel>>;
        headers?: THeaders;
    }
>;

// MsgProviderFn
export type MsgProvider<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgProviderParams<TStruct, TChannel, TGroup, THeaders>
) => void;

// MsgBinderFn
export type MsgBinder<TStruct extends MsgStruct> = <
    TSourceChannel extends keyof TStruct,
    TTargetChannel extends keyof TStruct,
    TSourceGroup extends keyof TStruct[TSourceChannel] = typeof $CG_IN,
    TTargetGroup extends keyof TStruct[TTargetChannel] = typeof $CG_IN
>(
    source: MsgSubscriberParams<TStruct, TSourceChannel, TSourceGroup>,
    target: MsgAddress<TStruct, TTargetChannel, TTargetGroup>
) => void;

export type MsgDispatcherParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
    THeaders extends MsgHeaders = MsgHeaders
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    // topicSelector?: string | ((channel: string) => boolean);
    payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
    payloadFn?: IsTuple<TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup]> extends true
    ? (fn: (...args: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup]) => void) => void
    : never;
    callback?: (msg: Msg<TStruct, TChannel, typeof $CG_OUT, THeaders>) => void;
    config?: MsgDispatcherConfig;
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
    headers?: THeaders;
};

export type MsgAsyncDispatcherParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
    THeaders extends MsgHeaders = MsgHeaders
> = Overwrite<Skip<MsgDispatcherParams<TStruct, TChannel, TGroup, THeaders>, "callback">,
    {
        config?: MsgAsyncDispatcherConfig
    }>;

// MsgDispatcherFn
export type MsgDispatcher<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgDispatcherParams<TStruct, TChannel, TGroup, THeaders>
) => void;

// MsgAsyncDispatcherFn
export type MsgAsyncDispatcher<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgAsyncDispatcherParams<TStruct, TChannel, TGroup, THeaders>
) => Promise<Msg<TStruct, TChannel, typeof $CG_OUT>>;

export type MsgChannelStructNormalized<TStruct extends MsgChannelStruct> = {
    [G in keyof TStruct]: Awaited<TStruct[G]>;
};

export type MsgStructNormalized<TStruct extends MsgStruct> = {
    [C in keyof TStruct]: MsgChannelStructNormalized<TStruct[C]>;
};

export const $TypeArgStruct = Symbol("__<TStruct>");
export const $TypeArgHeaders = Symbol("__<THeaders>");

// export interface
export type MsgBus<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = {
    readonly config: MsgBusConfig<MsgStructNormalized<TStruct>>;
    // subscribe, listen
    readonly on: MsgSubscriber<MsgStructNormalized<TStruct>, THeaders>;
    readonly onceAsync: MsgAsyncSubscriber<MsgStructNormalized<TStruct>, THeaders>;
    // listenStream, consume, receive
    readonly stream: MsgStreamer<MsgStructNormalized<TStruct>, THeaders>;
    // handle, resolve
    readonly provide: MsgProvider<MsgStructNormalized<TStruct>, THeaders>;
    // link, connect
    // dispatch (emit/publish + subscribe)
    readonly dispatch: MsgDispatcher<MsgStructNormalized<TStruct>, THeaders>;
    readonly dispatchAsync: MsgAsyncDispatcher<MsgStructNormalized<TStruct>, THeaders>;
    // TODO: support suspend/resume methods
    /**
     * @internal
     * Type-level only. Do not access at runtime.
     */
    readonly [$TypeArgStruct]?: TStruct;
    /**
     * @internal
     * Type-level only. Do not access at runtime.
     */
    readonly [$TypeArgHeaders]?: THeaders;
};
