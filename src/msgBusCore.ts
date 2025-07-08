//##############################################################################
//# Copyright (c) Pavel Borodaev 2022                                         #
//##############################################################################
// SafeBus
import { IsTuple, MaybePromise, Overwrite, Skip } from "@actdim/utico/typeCore";

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

// MsgBusChannelStruct
export type MsgChannelStruct = Partial<{ [group: string]: any } & InParam & OutParam & ErrorParam>;

// type MsgChannelStruct = { [group: string]: any } & (
//   | InParam
//   | OutParam
//   | (InParam & OutParam)
// );

export type MsgBusStruct = {
    [channel: string]: MsgChannelStruct;
};

// SystemMsgBusStruct
export type MsgBusStructBase = {
    [$C_ERROR]: {
        [$CG_IN]: ErrorPayload;
    };
    // "*": {
    //     [$CG_IN]: any;
    // };
};

// MsgBusStructBuilder
export type MsgBusStructFactory<
    TStruct extends TStructBase,
    TStructBase extends MsgBusStruct = MsgBusStruct // & MsgBusStructBase
> = {
    [C in keyof TStruct]: TStruct[C] & ErrorParam;
};

// export type MsgBusStruct = Record<string, MsgChannelStruct>;

export type InStruct<TStruct extends MsgBusStruct, TChannel extends keyof TStruct> = TStruct[TChannel] extends InParam
    ? TStruct[TChannel]["in"] // keyof InParam or typeof $CG_IN
    : undefined; // never

// export type InStruct<
//   TStruct extends MsgBusStruct,
//   TChannel extends keyof TStruct
// > = TStruct[TChannel] extends InParam ? TStruct[TChannel]["in"] : never;

export type OutStruct<TStruct extends MsgBusStruct, TChannel extends keyof TStruct> = TStruct[TChannel] extends OutParam
    ? TStruct[TChannel][keyof OutParam]
    : undefined;

// export type OutStruct<
//   TStruct extends MsgBusStruct,
//   TChannel extends keyof TStruct
// > = TStruct[TChannel] extends OutParam ? TStruct[TChannel]["out"] : never;

// Options/Settings
export type MsgChannelConfig<TChannel> = {
    // (channel) message queue distribution and processing strategy
    replayCount?: number;
    initialValues?: { [TGroup in keyof TChannel]: TChannel[TGroup] };
    persistent?: boolean; // durable? (for durable queue)
    secure?: boolean; // encrypted
    federated?: boolean; // broadcasting
    autoDeleteTimeout?: number;
    noAck?: boolean; // noAutoAck
    // manualAck?: boolean;
    // prefetchCount?: number; // for manual acknowledgment
    // this can be used for some consumer or for all consumers of the channel
    maxConcurrentConsumers?: number; // Parallel? Processes? Handlers?
};

export type MsgDispatchConfig = {
    // MsgConfig
    priority?: number;
    fetchCount?: number;
};

export type MsgBusConfig<TStruct extends MsgBusStruct> = {
    [TChannel in keyof TStruct]?: MsgChannelConfig<TStruct[TChannel]>;
}; // Record<string, MsgChannelConfig>

export type MsgAddress<
    TStruct extends MsgBusStruct = MsgBusStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel] // typeof $CG_IN
> = {
    channel: TChannel;
    group?: TGroup; // typeGroup
    // supports wildcard matching (https://docs.nats.io/nats-concepts/subjects#wildcards)
    topic?: string;    
    version?: string;
};

// MsgEnvelope
export type Msg<
    TStruct extends MsgBusStruct = MsgBusStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel]
> = {
    address: MsgAddress<TStruct, TChannel, TGroup>;
    payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
    // status: MsgStatus;
    // inResponseToId
    requestId?: string;
    // correlationId
    traceId?: string;
    id: string;
    timestamp: number; // Date
    priority?: number;
    persistent?: boolean; // durable? (for durable queue)
};

// TODO: support un(subscribing) via Deferred<bool>

export type MsgBusSubscriberParams<
    TStruct extends MsgBusStruct = MsgBusStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel] // typeof $CG_IN
> = MsgAddress<TStruct, TChannel, TGroup> & {
    channelSelector?: string | ((channel: string) => boolean);
    // topicSelector?: string | ((channel: string) => boolean);
    callback?: (msg: Msg<TStruct, TChannel, TGroup>) => void;
    config?: MsgDispatchConfig;
    filter?: (msg: Msg<TStruct, TChannel, TGroup>) => boolean;
    signal?: AbortSignal;
};

// MsgBusSubscriberFn
export type MsgBusSubscriber<TStruct extends MsgBusStruct> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgBusSubscriberParams<TStruct, TChannel, TGroup>
) => void;

// MsgBusAsyncSubIterator(Fn)
export type MsgBusStreamer<TStruct extends MsgBusStruct> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgBusSubscriberParams<TStruct, TChannel, TGroup>
) => AsyncIterableIterator<Msg<TStruct, TChannel, TGroup>>; // TGroup extends undefined ? typeof $CG_IN : TGroup

export type MsgBusAsyncSubscriberParams<
    TStruct extends MsgBusStruct = MsgBusStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel] // typeof $CG_IN
> = Skip<MsgBusSubscriberParams<TStruct, TChannel, TGroup>, "callback" | "filter">;

// MsgBusAsyncSubscriberFn
export type MsgBusAsyncSubscriber<TStruct extends MsgBusStruct> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgBusAsyncSubscriberParams<TStruct, TChannel, TGroup>
) => Promise<Msg<TStruct, TChannel, TGroup>>; // TGroup extends undefined ? typeof $CG_IN : TGroup

export type MsgBusProviderParams<
    TStruct extends MsgBusStruct = MsgBusStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel] // typeof $CG_IN
> = Overwrite<
    MsgBusSubscriberParams<TStruct, TChannel, TGroup>,
    {
        // resolve
        callback?: (msg: Msg<TStruct, TChannel, TGroup>) => MaybePromise<OutStruct<TStruct, TChannel>>;
    }
>;

// MsgBusProviderFn
export type MsgBusProvider<TStruct extends MsgBusStruct> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgBusProviderParams<TStruct, TChannel, TGroup>
) => void;

// MsgBusBinderFn
export type MsgBusBinder<TStruct extends MsgBusStruct> = <
    TSourceChannel extends keyof TStruct,
    TTargetChannel extends keyof TStruct,
    TSourceGroup extends keyof TStruct[TSourceChannel] = typeof $CG_IN,
    TTargetGroup extends keyof TStruct[TTargetChannel] = typeof $CG_IN
>(
    source: MsgBusSubscriberParams<TStruct, TSourceChannel, TSourceGroup>,
    target: MsgAddress<TStruct, TTargetChannel, TTargetGroup>
) => void;

export type MsgBusDispatcherParams<
    TStruct extends MsgBusStruct = MsgBusStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel] // typeof $CG_IN
> = Overwrite<
    MsgBusSubscriberParams<TStruct, TChannel, TGroup>,
    {
        payload?: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup];
        payloadFn?: IsTuple<TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup]> extends true
            ? (fn: (...args: TGroup extends undefined ? InStruct<TStruct, TChannel> : TStruct[TChannel][TGroup]) => void) => void
            : never;
        traceId?: string;
        priority?: number;
        persistent?: boolean;
        callback?: (msg: Msg<TStruct, TChannel, typeof $CG_OUT>) => void;
    }
>;

export type MsgBusAsyncDispatcherParams<
    TStruct extends MsgBusStruct = MsgBusStruct,
    TChannel extends keyof TStruct = keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = keyof TStruct[TChannel] // typeof $CG_IN
> = Skip<MsgBusDispatcherParams<TStruct, TChannel, TGroup>, "callback">;

// MsgBusDispatcherFn
export type MsgBusDispatcher<TStruct extends MsgBusStruct> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgBusDispatcherParams<TStruct, TChannel, TGroup>
) => void;

// MsgBusAsyncDispatcherFn
export type MsgBusAsyncDispatcher<TStruct extends MsgBusStruct> = <
    TChannel extends keyof TStruct,
    TGroup extends keyof TStruct[TChannel] = typeof $CG_IN
>(
    params: MsgBusAsyncDispatcherParams<TStruct, TChannel, TGroup>
) => Promise<Msg<TStruct, TChannel, typeof $CG_OUT>>;

export type MsgChannelStructNormalized<TStruct extends MsgChannelStruct> = {
    [G in keyof TStruct]: Awaited<TStruct[G]>;
};

export type MsgBusStructNormalized<TStruct extends MsgBusStruct> = {
    [C in keyof TStruct]: MsgChannelStructNormalized<TStruct[C]>;
};

// export interface
export type MsgBus<TStruct extends MsgBusStruct> = {
    readonly config: MsgBusConfig<MsgBusStructNormalized<TStruct>>;
    // subscribe, listen
    readonly on: MsgBusSubscriber<MsgBusStructNormalized<TStruct>>;
    readonly onceAsync: MsgBusAsyncSubscriber<MsgBusStructNormalized<TStruct>>;
    // listenStream, consume, receive
    readonly stream: MsgBusStreamer<MsgBusStructNormalized<TStruct>>;
    // handle, resolve
    readonly provide: MsgBusProvider<MsgBusStructNormalized<TStruct>>;
    // link, connect
    // dispatch (emit/publish + subscribe)
    readonly dispatch: MsgBusDispatcher<MsgBusStructNormalized<TStruct>>;
    readonly dispatchAsync: MsgBusAsyncDispatcher<MsgBusStructNormalized<TStruct>>;
};
