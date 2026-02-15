//##############################################################################
//# Copyright (c) Pavel Borodaev 2022                                         #
//##############################################################################
// SafeBus
import { IsTuple, MaybePromise, Overwrite, Skip } from "@actdim/utico/typeCore";
import { ThrottleOptions } from "./util";

export const $CG_IN = "in" as const;

export const $CG_OUT = "out" as const;

export const $CG_ERROR = "error" as const;

export const $C_ERROR = "MSGBUS.ERROR" as const;

export const $SYSTEM_TOPIC = "msgbus" as const;

export type InParam = {
    // [key in typeof $CG_IN]: any;
    [$CG_IN]: any;
};

export type OutParam = {
    // [key in typeof $CG_OUT]: any;
    [$CG_OUT]: any;
};

export type ErrorPayload = {
    error: any;
    source?: any;
    handled?: boolean;
};

export type ErrorParam<T extends ErrorPayload = ErrorPayload> = {
    // [key in typeof $CG_ERROR]: any;
    [$CG_ERROR]: T;
};

export const TIMEOUT_ERROR_NAME = "TimeoutError" as const;
export const ABORT_ERROR_NAME = "AbortError" as const;
export const OPERATION_CANCELED_ERROR_NAME = "OperationCanceledError" as const;
export const $isTimeoutError = Symbol("isTimeoutError");
export const $isAbortError = Symbol("isAbortError");
export const $isOperationCanceledError = Symbol("isOperationCanceledError");

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
    readonly name: string = TIMEOUT_ERROR_NAME;
    readonly [$isTimeoutError] = true as const;

    constructor(message?: string, cause?: unknown) {
        // Operation
        super(message || "Timeout exceeded", { cause });
    }
}

export class AbortError extends BaseError {
    readonly name: string = ABORT_ERROR_NAME;
    readonly [$isAbortError] = true as const;

    constructor(message?: string, cause?: unknown) {
        super(message || "Operation aborted", { cause });
    }
}

export class OperationCanceledError extends BaseError {
    readonly name: string = OPERATION_CANCELED_ERROR_NAME;
    readonly [$isOperationCanceledError] = true as const;

    constructor(message?: string, cause?: unknown) {
        super(message || "Operation canceled", { cause });
    }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
    return typeof error === "object" && error !== null && $isTimeoutError in error;
}

export function isAbortError(error: unknown): error is AbortError {
    return typeof error === "object" && error !== null && $isAbortError in error;
}

export function isOperationCanceledError(error: unknown): error is OperationCanceledError {
    return typeof error === "object" && error !== null && $isOperationCanceledError in error;
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

export type MsgChannelConfig<TChannel> = {
    // (channel) message queue distribution and processing strategy
    initialValues?: { [TGroup in keyof TChannel]: TChannel[TGroup] };
    // persistent?: boolean; // durable? (for durable queue)
    // secure?: boolean; // encrypted
    // federated?: boolean; // broadcasting
    // autoDeleteTimeout?: number;

    // requireAck: boolean;
    // noAck?: boolean; // noAutoAck
    // manualAck?: boolean;
    // prefetchCount?: number; // for manual acknowledgment (max messages in flight without ack)    
    // maxSubscribers?: number;
    replayBufferSize?: number;
    replayWindowTime?: number;

    delay?: number;
    throttle?: number | (ThrottleOptions & { duration: number; });
    debounce?: number;
};

export type MsgSubOptions = {
    fetchCount?: number;
    abortSignal?: AbortSignal;

    throttle?: number | (ThrottleOptions & { duration: number; });
    debounce?: number;

    priority?: number;
};

export type PromiseOptions = {
    abortSignal?: AbortSignal;
    timeout?: number;
};

export type MsgBusConfig<TStruct extends MsgStruct> = {
    [TChannel in keyof TStruct]?: MsgChannelConfig<TStruct[TChannel]>;
};

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

export type ResponseStatus = "ok" | "error" | "canceled" | "timeout";
export type MsgHeaders = {

    status?: ResponseStatus;
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

    // timestamp (unix epoch, ms):
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

    // discard policy (for dead-letter)?

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
    error?: string | {
        code?: string | number;
        message?: string;
    }
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

export type MsgSubBaseParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    // topicSelector?: string | ((channel: string) => boolean);    
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
};

export type MsgSubParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    callback?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => void;
    options?: MsgSubOptions;
};

export type MsgSub<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgSubParams<TStruct, TChannel, TGroup, THeaders>
) => void;

export type AwaitableMsgSubOptions = MsgSubOptions & PromiseOptions;

// AwaitableMsgStreamOptions
export type MsgStreamOptions = AwaitableMsgSubOptions;

export type MsgStreamParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    options?: MsgStreamOptions;
};

export type MsgStream<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgStreamParams<TStruct, TChannel, TGroup>
) => AsyncIterableIterator<Msg<TStruct, TChannel, TGroup, THeaders>>; // TGroup extends undefined ? typeof $CG_IN : TGroup

export type AwaitableMsgSubParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    options?: AwaitableMsgSubOptions;
};

export type AwaitableMsgSub<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: AwaitableMsgSubParams<TStruct, TChannel, TGroup>
) => Promise<Msg<TStruct, TChannel, TGroup, THeaders>>; // TGroup extends undefined ? typeof $CG_IN : TGroup

export type MsgProviderOptions = MsgSubOptions;

export type MsgProviderParams<
    TStruct extends MsgStruct = MsgStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel], // typeof $CG_IN
    THeaders extends MsgHeaders = MsgHeaders
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    // resolve
    callback?: (msgIn: Msg<TStruct, TChannel, TGroup, THeaders>, headers?: THeaders) => MaybePromise<OutStruct<TStruct, TChannel>>;
    options?: MsgProviderOptions;
    headers?: THeaders;
};

export type MsgProvider<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgProviderParams<TStruct, TChannel, TGroup, THeaders>
) => void;

export type MsgSenderOptions = PromiseOptions;

export type MsgSenderParams<
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
    options?: MsgSenderOptions;
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
    headers?: THeaders;
};

export type MsgSender<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgSenderParams<TStruct, TChannel, TGroup, THeaders>
) => Promise<Msg<TStruct, TChannel, TGroup, THeaders>>;

export type MsgRequestOptions = PromiseOptions & {
    sendTimeout?: number;
    responseTimeout?: number;
};

export type MsgRequestDispatcherParams<
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
    options?: MsgRequestOptions;
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
    headers?: THeaders;
};

export type MsgRequestDispatcher<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgRequestDispatcherParams<TStruct, TChannel, TGroup, THeaders>
) => Promise<Msg<TStruct, TChannel, typeof $CG_OUT>>;

export type MsgChannelStructNormalized<TStruct extends MsgChannelStruct> = {
    [G in keyof TStruct]: Awaited<TStruct[G]>;
};

export type MsgStructNormalized<TStruct extends MsgStruct> = {
    [C in keyof TStruct]: MsgChannelStructNormalized<TStruct[C]>;
};

export const $TypeArgStruct = Symbol("__<TStruct>");
export const $TypeArgHeaders = Symbol("__<THeaders>");

export type MsgBus<TStruct extends MsgStruct, THeaders extends MsgHeaders = MsgHeaders> = {
    readonly config: MsgBusConfig<MsgStructNormalized<TStruct>>;
    // subscribe, listen
    readonly on: MsgSub<MsgStructNormalized<TStruct>, THeaders>;
    // listen once
    readonly once: AwaitableMsgSub<MsgStructNormalized<TStruct>, THeaders>;
    // listenStream, consume, receive
    readonly stream: MsgStream<MsgStructNormalized<TStruct>, THeaders>;
    // handle
    readonly provide: MsgProvider<MsgStructNormalized<TStruct>, THeaders>;
    // publish + delivery guarantee
    readonly send: MsgSender<MsgStructNormalized<TStruct>, THeaders>;
    // publish + subscribe
    readonly request: MsgRequestDispatcher<MsgStructNormalized<TStruct>, THeaders>;

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
