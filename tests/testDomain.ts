import { MsgBus, MsgBusConfig, MsgStruct, MsgStructNormalized, MsgHeaders } from "@/msgBusCore";
import { createMsgBus } from "@/msgBusFactory";
import { RequireExtends } from "@actdim/utico/typeCore";

export type TestBusStruct = RequireExtends<
    {
        "Test.ComputeSum": {
            in: { a: number; b: number };
            out: number;
        };
        "Test.DoSomeWork": {
            in: string;
            out: void;
        },
        "Test.TestTaskWithRepeat": {
            in: string;
            out: void;
        },
        "Test.Multiplexer": {
            in1: string;
            in2: number;
            out: number;
        }
    },
    MsgStruct
>;

export type TestMsgBus = MsgBus<TestBusStruct>;

export const createTestMsgBus = (config?: MsgBusConfig<MsgStructNormalized<TestBusStruct>>) => createMsgBus<TestBusStruct>(config);

export const sharedMsgBus = createTestMsgBus();