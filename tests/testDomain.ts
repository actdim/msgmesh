import { MsgBusStruct } from "@/msgBusCore";
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

export const createTestMsgBus = () => createMsgBus<TestBusStruct>({
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
    }
});

export const sharedMsgBus = createTestMsgBus();