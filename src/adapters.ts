import { MsgBus, MsgStruct } from "./contracts";
import { AddPrefix, Filter, Func, RemoveSuffix, Skip, ToUpper } from "@actdim/utico/typeCore";

const getMethodNames = (client: any) => {
    // return new Set(...)
    return Object.getOwnPropertyNames(client).filter(
        (name) => name !== 'constructor' && typeof client[name] === 'function',
    );
};

// const baseMethodNames = getMethodNames(ClientBase.prototype);

// ServiceMsgDispatcher
export type MsgProviderAdapter = {
    service: any;
    // channelResolver/channelMapper
    channelSelector: (service: any, methodName: string) => string;
};

export function registerAdapters(msgBus: MsgBus<MsgStruct>, adapters: MsgProviderAdapter[], abortSignal?: AbortSignal) {
    if (adapters) {
        for (const adapter of adapters) {
            const { service, channelSelector } = adapter;
            if (!service || !channelSelector) {
                throw new Error("Service and channelSelector are required for an adapter")
            }
            for (const methodName of getMethodNames(Object.getPrototypeOf(service))) {
                const channel = channelSelector?.(service, methodName);
                if (channel) {
                    msgBus.provide({
                        channel: channel,
                        topic: '/.*/',
                        callback: (msg) => {
                            return (service[methodName] as Func)(...((msg.payload || []) as any[]));
                        },
                        options: {
                            abortSignal: abortSignal
                        }
                    });
                }
            }
        }
    }
}

export type BaseServiceSuffix = 'CLIENT' | 'API' | 'SERVICE' | 'FETCHER' | 'CONTROLLER' | 'LOADER' | 'REPOSITORY' | 'PROVIDER';
export type BaseWordSeparator = "."; // "/"

// const suffixes = ['CLIENT', 'API', 'SERVICE'] satisfies Uppercase<BaseServiceSuffix>[];
// runtime version: `${prefix}${removeSuffix(serviceName.toUpperCase(), suffixes)}.`
export type ToMsgChannelPrefix<
    TServiceName extends string,
    Prefix extends string,
    Suffix extends string = BaseServiceSuffix,
    WordSeparator extends string = BaseWordSeparator
> = `${Prefix}${WordSeparator}${RemoveSuffix<Uppercase<TServiceName>, Suffix>}${WordSeparator}`;

type ToMsgStructSource<TService, TPrefix extends string, TSkip extends keyof TService = never> = Filter<
    ToUpper<AddPrefix<Skip<TService, TSkip>, TPrefix>>,
    Func
>;

export type ToMsgStruct<TService, TPrefix extends string, TSkip extends keyof TService = never, TMsgStructSource = ToMsgStructSource<TService, TPrefix, TSkip>> = MsgStruct<{
    [K in keyof TMsgStructSource as TMsgStructSource[K] extends Func ? (Uppercase<K extends string ? K : never>) : never]: {
        in: TMsgStructSource[K] extends Func ? Parameters<TMsgStructSource[K]> : never;
        out: TMsgStructSource[K] extends Func ? ReturnType<TMsgStructSource[K]> : never;
    };
}>;

export function getMsgChannelSelector<TTPrefix extends string>(
    services: Record<TTPrefix, any>,
) {
    return (service: any, methodName: string) => {
        const entry = Object.entries(services).find((entry) => entry[1] === service);
        if (!entry) {
            return null;
        }
        return `${entry[0]}${methodName.toUpperCase()}`;
    };
}