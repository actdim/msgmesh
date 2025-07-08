import { MsgBusStruct, MsgBusStructBase } from "src/msgBusCore";
import { createMsgBus } from "src/msgBusFactory";
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
            };
            
        },
        MsgBusStruct
    > & MsgBusStructBase;

export const bus = createMsgBus<TestBusStruct>({
    "Test.ComputeSum": {
        initialValues: {
            in: {
                a: 0,
                b: 0
            },
            out: 0
        }
    }    
});
