import { asyncScheduler, Observable, SchedulerLike, Subscriber, timer, UnaryFunction } from "rxjs";

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

export type ThrottleOptions = {
    leading?: boolean;
    trailing?: boolean;
}

export function throttleOp<T>(
    duration: number,
    options: ThrottleOptions = { leading: true, trailing: true },
    scheduler: SchedulerLike = asyncScheduler
) {
    const { leading = true, trailing = false } = options;

    return (source: Observable<T>) =>
        new Observable<T>((subscriber: Subscriber<T>) => {
            let throttling = false;
            let lastValue: T | undefined;
            let timerSub: any;

            const endWindow = () => {
                if (trailing && lastValue !== undefined) {
                    subscriber.next(lastValue);
                }
                lastValue = undefined;
                throttling = false;
            };

            const sourceSub = source.subscribe({
                next(value) {
                    if (!throttling) {
                        throttling = true;

                        if (leading) {
                            subscriber.next(value);
                        } else if (trailing) {
                            lastValue = value;
                        }

                        timerSub = timer(duration, scheduler).subscribe(() => {
                            endWindow();
                            timerSub?.unsubscribe();
                        });
                    } else if (trailing) {
                        lastValue = value;
                    }
                },
                error(err) {
                    subscriber.error(err);
                },
                complete() {
                    if (trailing && lastValue !== undefined) {
                        subscriber.next(lastValue);
                    }
                    subscriber.complete();
                }
            });

            return () => {
                sourceSub.unsubscribe();
                timerSub?.unsubscribe();
            };
        });
}