import { MsgBus, MsgBusConfig, MsgBusStruct, MsgBusStructNormalized, MsgHeaders } from "@/msgBusCore";
import { createMsgBus } from "@/msgBusFactory";
import { RequireExtends } from "@actdim/utico/typeCore";

export type TestBusStruct = RequireExtends<
    {
        "Test.ComputeSum": {
            in: { a: number; b: number };
            out: number;
        };
        "Test.DoSomeWork": {
            in: void;
            out: void;
        }
    },
    MsgBusStruct
>;

export type TestMsgBus = MsgBus<TestBusStruct>;

export const createTestMsgBus = (config?: MsgBusConfig<MsgBusConfig<MsgBusStructNormalized<TestBusStruct>>>) => createMsgBus<TestBusStruct>({
    "Test.ComputeSum": {
        initialValues: {
            in: {
                a: 0,
                b: 0
            },
            out: 0
        },
        replayBufferSize: Infinity,
        replayWindowTime: 60000
    },
    "Test.DoSomeWork": {
        initialValues: {
            in: undefined,
            out: undefined
        },
        replayBufferSize: Infinity,
        replayWindowTime: 60000
    }
});

export const sharedMsgBus = createTestMsgBus();