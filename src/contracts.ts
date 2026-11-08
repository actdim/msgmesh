import { type HasKeys, type IsTuple, type MaybePromise } from '@actdim/utico/typeCore';
import { type ThrottleOptions } from '@/util';

export const $CG_IN = 'in' as const;

export const $CG_OUT = 'out' as const;

export const $CG_ERROR = 'error' as const;

export const $C_ERROR = 'MSGBUS.ERROR' as const;

export const $C_ANY = '*' as const; // $C_ALL

export const $SYSTEM_TOPIC = 'msgbus' as const;

export type ErrorPayload = {
    error: any;
    source?: any;
    handled?: boolean;
};

export const TIMEOUT_ERROR_NAME = 'TimeoutError' as const;
export const ABORT_ERROR_NAME = 'AbortError' as const;
export const OPERATION_CANCELED_ERROR_NAME = 'OperationCanceledError' as const;
export const $isTimeoutError = Symbol('isTimeoutError');
export const $isAbortError = Symbol('isAbortError');
export const $isOperationCanceledError = Symbol('isOperationCanceledError');

export class BaseError extends Error {
    readonly name: string = 'BaseError';

    constructor(
        message: string,
        options?: {
            cause?: unknown;
        },
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
        super(message || 'Timeout exceeded', { cause });
    }
}

export class AbortError extends BaseError {
    readonly name: string = ABORT_ERROR_NAME;
    readonly [$isAbortError] = true as const;

    constructor(message?: string, cause?: unknown) {
        super(message || 'Operation aborted', { cause });
    }
}

export class OperationCanceledError extends BaseError {
    readonly name: string = OPERATION_CANCELED_ERROR_NAME;
    readonly [$isOperationCanceledError] = true as const;

    constructor(message?: string, cause?: unknown) {
        super(message || 'Operation canceled', { cause });
    }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
    return typeof error === 'object' && error !== null && $isTimeoutError in error;
}

export function isAbortError(error: unknown): error is AbortError {
    return typeof error === 'object' && error !== null && $isAbortError in error;
}

export function isOperationCanceledError(error: unknown): error is OperationCanceledError {
    return typeof error === 'object' && error !== null && $isOperationCanceledError in error;
}

export const NO_PROVIDER_ERROR_NAME = 'NoProviderError' as const;
export const $isNoProviderError = Symbol('isNoProviderError');

export class NoProviderError extends BaseError {
    readonly name: string = NO_PROVIDER_ERROR_NAME;
    readonly [$isNoProviderError] = true as const;
    readonly channel: string;

    constructor(channel: string) {
        super(`No provider registered for channel "${channel}"`);
        this.channel = channel;
    }
}

export function isNoProviderError(error: unknown): error is NoProviderError {
    return typeof error === 'object' && error !== null && $isNoProviderError in error;
}

export const CHANNEL_BUSY_ERROR_NAME = 'ChannelBusyError' as const;
export const $isChannelBusyError = Symbol('isChannelBusyError');

/** Thrown by send()/request()/requestStream() when a flow-controlled channel
 * has no free in-flight slot and its overflow policy is 'error'. */
export class ChannelBusyError extends BaseError {
    readonly name: string = CHANNEL_BUSY_ERROR_NAME;
    readonly [$isChannelBusyError] = true as const;
    readonly channel: string;

    constructor(channel: string) {
        super(`Channel "${channel}" has no free in-flight slot`);
        this.channel = channel;
    }
}

export function isChannelBusyError(error: unknown): error is ChannelBusyError {
    return typeof error === 'object' && error !== null && $isChannelBusyError in error;
}

export type InChannelStruct = {
    [$CG_IN]: any;
};

export type OutChannelStruct = {
    [$CG_OUT]: any;
};

export type ErrorChannelStruct = {
    [$CG_ERROR]: ErrorPayload;
};

export type SystemChannelStruct = Partial<InChannelStruct & OutChannelStruct & ErrorChannelStruct>;

// ReservedChannelGroup
export type SystemChannelGroup = keyof SystemChannelStruct;

export type MsgChannelStruct = SystemChannelStruct & Record<string, any>;

export type SystemMsgStruct = {
    [$C_ERROR]?: {
        [$CG_IN]: ErrorPayload;
    };
    '*'?: never;
};

export type MsgStructBase = Record<string, MsgChannelStruct> & SystemMsgStruct;

// Factory type
export type MsgStruct<TStruct extends MsgStructBase = MsgStructBase> = {
    [C in keyof TStruct]: TStruct[C] &
    Partial<ErrorChannelStruct> &
    (typeof $CG_OUT extends keyof TStruct[C]
        ? {}
        : {
            // unknown?
            [$CG_OUT]?: void; // enforces explicit out type declaration when payload matters
        }) &
    (typeof $CG_IN extends keyof TStruct[C]
        ? {}
        : {
            // unknown?
            [$CG_IN]?: void; // enforces explicit in type declaration when payload matters
        });
} & SystemMsgStruct;

export type InStruct<
    TStruct extends MsgStructBase,
    TChannel extends keyof TStruct,
> = TStruct[TChannel] extends InChannelStruct
    ? TStruct[TChannel][keyof InChannelStruct]
    : undefined;

export type OutStruct<
    TStruct extends MsgStructBase,
    TChannel extends keyof TStruct,
> = TStruct[TChannel] extends OutChannelStruct
    ? TStruct[TChannel][keyof OutChannelStruct]
    : undefined;

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
    // prefetchCount -> see flowControl.maxInFlight
    // maxSubscribers?: number;
    replayBufferSize?: number;
    replayWindowTime?: number;

    mandatoryProvider?: boolean;
    timeout?: number;

    /** Backpressure for the channel's input groups (in/out pair). Opt-in; see MsgFlowControl. */
    flowControl?: MsgFlowControl;

    delay?: number;
    throttle?: number | (ThrottleOptions & { duration: number });
    debounce?: number;
};

/**
 * Credit-based flow control for a channel (in/out pair).
 * At most `maxInFlight` messages sent to the channel's input groups may be unanswered.
 * A slot is taken by send()/request()/requestStream() before publishing and released by the
 * matching "out" message (any status), by provider-side cancel (msgOut.status = 'canceled'),
 * by the lease timeout, or immediately when nobody is subscribed at publish time.
 * Publishes to "out"/"error" groups and cancel messages are never gated.
 */
export type MsgFlowControl = {
    /** Max messages sent to the channel's input groups and not yet answered in "out" (>= 1). */
    maxInFlight: number;
    /** Behavior when no slot is free: wait in FIFO order (default) or reject with ChannelBusyError. */
    overflow?: 'wait' | 'error';
    /** A slot is force-released if no "out" arrives in time (ms).
     * Default: channel timeout ?? defaultPromiseTimeout. */
    leaseTimeout?: number;
};

/** Snapshot of a flow-controlled channel (see MsgBus.getFlowStats). */
export type MsgFlowStats = {
    limit: number;
    inFlight: number;
    waiting: number;
    leases: number;
};

export type MsgSubOptions = {
    fetchCount?: number;
    abortSignal?: AbortSignal;

    throttle?: number | (ThrottleOptions & { duration: number });
    debounce?: number;

    priority?: number;
};

export type PromiseOptions = {
    abortSignal?: AbortSignal;
    timeout?: number;
};

export type MsgBusConfig<TStruct extends MsgStructBase> = {
    [TChannel in keyof TStruct]?: MsgChannelConfig<TStruct[TChannel]>;
} & {
    /** Default config applied to all channels. Channel-specific config always wins.
     * Can be a static object or a function that receives the channel name and returns config. */
    [$C_ANY]?: MsgChannelConfig<any> | ((channel: string) => MsgChannelConfig<any>);
};

export type MsgAddress<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
> = {
    channel: TChannel;
    group?: TGroup;
    // supports wildcard matching (https://docs.nats.io/nats-concepts/subjects#wildcards)
    topic?: string;
    version?: string;
};

export type MsgStatus =
    | 'handled'
    | 'failed'
    | 'canceled'
    | 'skipped'
    | 'timeout'
    // 'unknown'
    | 'pending';

export type MsgHeaders = {
    // similar to inReplyToId
    inResponseToId?: string;
    version?: string; // schemaVersion

    requestId?: string;

    // routing hints
    /** Stable id of the component, service, store, route, or worker that emitted the message. */
    sourceId?: string; // senderId/producerId
    targetId?: string; // receiverId/recipientId

    correlationId?: string;

    /** Message creation time as Unix timestamp in milliseconds. */
    timestamp?: number; // publishedAt

    /** Stable machine-readable name of what happened. */
    name?: string; // eventName
    severity?: string; // logLevel

    priority?: number;
    persistent?: boolean; // durable? (for durable queue)

    tags?: string | string[];

    ttl?: number;
    absoluteExpiration?: number;
    slidingExpiration?: number;

    // OTel:
    /** Trace id used to correlate this message with a distributed trace. */
    traceId?: string;

    /** Span id used to correlate this message with a specific operation/span. */
    spanId?: string; // activityId, operationId

    // discard policy (for dead-letter)?

    // ack/nack policy
    // requireAck: boolean;
    // ackMode: AckMode;

    // retryCount?: number;
    // deliveryAttempt?: number;

    // common extensions:
    // outcome
    // code
    // category
    // group
    // subject
    // audience
    // schema
    // scope
    // ownerId
    // originId
    // accessLevel
    // presentation

    error?:
    | string
    | {
        code?: string | number;
        message?: string;
    };
};

// MsgEnvelope
export type Msg<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = {
    /** Stable unique id for deduplication, updates, and dismissal. */
    id?: string;
    address: MsgAddress<TStruct, TChannel, TGroup>;
    payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
    headers?: THeaders;
    status?: MsgStatus;
};

export type MsgSubBaseParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    // topicSelector?: string | ((channel: string) => boolean);
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
};

export type MsgSubParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    callback?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => void;
    options?: MsgSubOptions;
};

export type MsgSub<TStruct extends MsgStructBase, THeaders extends MsgHeaders = MsgHeaders> = {
    <TChannel extends keyof TStruct, TGroup extends keyof TStruct[TChannel] = undefined>(
        params: MsgSubParams<TStruct, TChannel, TGroup, THeaders>,
    ): void;
};

export type AwaitableMsgSubOptions = MsgSubOptions & PromiseOptions;

// AwaitableMsgStreamOptions
export type MsgStreamOptions = AwaitableMsgSubOptions;

export type MsgStreamParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    options?: MsgStreamOptions;
};

export type MsgStream<TStruct extends MsgStructBase, THeaders extends MsgHeaders = MsgHeaders> = {
    <TChannel extends keyof TStruct, TGroup extends keyof TStruct[TChannel] = undefined>(
        params: MsgStreamParams<TStruct, TChannel, TGroup, THeaders>,
    ): AsyncIterableIterator<Msg<TStruct, TChannel, TGroup, THeaders>>;
};

export type AwaitableMsgSubParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    options?: AwaitableMsgSubOptions;
};

export type AwaitableMsgSub<
    TStruct extends MsgStructBase,
    THeaders extends MsgHeaders = MsgHeaders,
> = {
    <TChannel extends keyof TStruct, TGroup extends keyof TStruct[TChannel] = undefined>(
        params: AwaitableMsgSubParams<TStruct, TChannel, TGroup, THeaders>,
    ): Promise<Msg<TStruct, TChannel, TGroup, THeaders>>;
}; // TGroup extends undefined ? typeof $CG_IN : TGroup

export type MsgProviderOptions = MsgSubOptions;

export type MsgProviderParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgSubBaseParams<TStruct, TChannel, TGroup, THeaders> & {
    callback?: (
        inMsg: Msg<TStruct, TChannel, TGroup, THeaders>,
        outMsg: Msg<TStruct, TChannel, keyof OutChannelStruct, THeaders>,
    ) => MaybePromise<OutStruct<TStruct, TChannel> | undefined | void>;
    options?: MsgProviderOptions;
    headers?: THeaders;
};

export type MsgProvider<TStruct extends MsgStructBase, THeaders extends MsgHeaders = MsgHeaders> = {
    <TChannel extends keyof TStruct, TGroup extends keyof TStruct[TChannel] = undefined>(
        params: MsgProviderParams<TStruct, TChannel, TGroup, THeaders>,
    ): void;
};

/** For send(): `timeout` and `abortSignal` bound waiting for a free slot on a flow-controlled channel
 * (TimeoutError / OperationCanceledError). They have no effect on channels without flowControl. */
export type MsgSenderOptions = PromiseOptions;

export type MsgSenderParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    // topicSelector?: string | ((channel: string) => boolean);
    payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
    payloadFn?: IsTuple<
        TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup]
    > extends true
    ? (
        fn: (
            ...args: TGroup extends undefined
                ? InStruct<TStruct, TChannel>
                : TStruct[TChannel][TGroup]
        ) => void,
    ) => void
    : never;
    options?: MsgSenderOptions;
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
    headers?: THeaders;
};

export type MsgSender<TStruct extends MsgStructBase, THeaders extends MsgHeaders = MsgHeaders> = {
    <TChannel extends keyof TStruct, TGroup extends keyof TStruct[TChannel] = undefined>(
        params: MsgSenderParams<TStruct, TChannel, TGroup, THeaders>,
    ): Promise<Msg<TStruct, TChannel, TGroup, THeaders>>;
};

export type MsgRequestOptions = PromiseOptions & {
    /** Max time (ms) to wait for a free slot on a flow-controlled channel. The overall `timeout` still applies. */
    sendTimeout?: number;
    responseTimeout?: number;
    throwIfNoProvider?: boolean;
};

export type MsgRequestStreamOptions = MsgStreamOptions & {
    throwIfNoProvider?: boolean;
};

export type MsgRequestDispatcherParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    // topicSelector?: string | ((channel: string) => boolean);
    payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
    payloadFn?: IsTuple<
        TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup]
    > extends true
    ? (
        fn: (
            ...args: TGroup extends undefined
                ? InStruct<TStruct, TChannel>
                : TStruct[TChannel][TGroup]
        ) => void,
    ) => void
    : never;
    options?: MsgRequestOptions;
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
    headers?: THeaders;
};

export type MsgRequestDispatcher<
    TStruct extends MsgStructBase,
    THeaders extends MsgHeaders = MsgHeaders,
> = {
    <TChannel extends keyof TStruct, TGroup extends keyof TStruct[TChannel] = undefined>(
        params: MsgRequestDispatcherParams<TStruct, TChannel, TGroup, THeaders>,
    ): Promise<Msg<TStruct, TChannel, keyof OutChannelStruct>>;
};

export type MsgRequestStreamParams<
    TStruct extends MsgStructBase = MsgStructBase,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel],
    THeaders extends MsgHeaders = MsgHeaders,
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
    payloadFn?: IsTuple<
        TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup]
    > extends true
    ? (
        fn: (
            ...args: TGroup extends undefined
                ? InStruct<TStruct, TChannel>
                : TStruct[TChannel][TGroup]
        ) => void,
    ) => void
    : never;
    options?: MsgRequestStreamOptions;
    filter?: (msg: Msg<TStruct, TChannel, TGroup, THeaders>) => boolean;
    headers?: THeaders;
};

export type MsgRequestStream<
    TStruct extends MsgStructBase,
    THeaders extends MsgHeaders = MsgHeaders,
> = {
    <TChannel extends keyof TStruct, TGroup extends keyof TStruct[TChannel] = undefined>(
        params: MsgRequestStreamParams<TStruct, TChannel, TGroup, THeaders>,
    ): AsyncIterableIterator<Msg<TStruct, TChannel, keyof OutChannelStruct>>;
};

export type MsgChannelStructNormalized<TStruct extends MsgChannelStruct> = {
    [G in keyof TStruct]: Awaited<TStruct[G]>;
};

export type MsgStructNormalized<TStruct extends MsgStructBase> = {
    [C in keyof TStruct as HasKeys<TStruct[C]> extends false
    ? never
    : C]: MsgChannelStructNormalized<TStruct[C]>;
};

export const $TypeArgStruct = Symbol('<TStruct>');
export const $TypeArgHeaders = Symbol('<THeaders>');

export type MsgBus<TStruct extends MsgStructBase, THeaders extends MsgHeaders = MsgHeaders> = {
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
    // publish + stream of responses
    readonly requestStream: MsgRequestStream<MsgStructNormalized<TStruct>, THeaders>;
    /** Flow control snapshot for a channel; undefined if the channel has no flowControl or was never used. */
    readonly getFlowStats: (channel: keyof MsgStructNormalized<TStruct> & string) => MsgFlowStats | undefined;

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
