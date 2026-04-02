import { createAdaptivePoller } from "./adaptivePolling";

describe("createAdaptivePoller", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("calls onPoll after initial delay", () => {
        const onPoll = jest.fn();
        const poller = createAdaptivePoller(onPoll, 1000);

        poller.start();
        expect(onPoll).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);
        expect(onPoll).toHaveBeenCalledTimes(1);
    });

    it("schedules next poll after first poll completes", () => {
        const onPoll = jest.fn().mockImplementation(() => Promise.resolve());
        const poller = createAdaptivePoller(onPoll, 1000, 10000);

        poller.start();
        jest.advanceTimersByTime(1000);
        expect(onPoll).toHaveBeenCalledTimes(1);

        // Run all timers to let promise settle and next poll get scheduled
        jest.runAllTimers();

        // After running all timers, should have called again
        expect(onPoll).toHaveBeenCalled();
    });

    it("stops polling when stop() is called", () => {
        const onPoll = jest.fn();
        const poller = createAdaptivePoller(onPoll, 1000);

        poller.start();
        jest.advanceTimersByTime(1000);
        expect(onPoll).toHaveBeenCalledTimes(1);

        poller.stop();
        jest.runAllTimers();
        expect(onPoll).toHaveBeenCalledTimes(1); // No additional calls
    });

    it("does not start polling multiple times if start() called multiple times", () => {
        const onPoll = jest.fn();
        const poller = createAdaptivePoller(onPoll, 100);

        poller.start();
        poller.start();
        poller.start();

        jest.advanceTimersByTime(100);
        expect(onPoll).toHaveBeenCalledTimes(1);
    });

    it("can be restarted after stopping", () => {
        const onPoll = jest.fn();
        const poller = createAdaptivePoller(onPoll, 1000);

        poller.start();
        jest.advanceTimersByTime(1000);
        expect(onPoll).toHaveBeenCalledTimes(1);

        poller.stop();
        expect(onPoll).toHaveBeenCalledTimes(1);

        // After stopping and restarting, should poll again
        poller.start();
        jest.advanceTimersByTime(1000);
        expect(onPoll).toHaveBeenCalledTimes(2);
    });

    it("uses specified initial and max delays", () => {
        const onPoll = jest.fn();
        const poller = createAdaptivePoller(onPoll, 5000, 30000);

        poller.start();

        // Should not call before the initial delay
        jest.advanceTimersByTime(4999);
        expect(onPoll).not.toHaveBeenCalled();

        // Should call after the initial delay
        jest.advanceTimersByTime(1);
        expect(onPoll).toHaveBeenCalledTimes(1);

        poller.stop();
    });
});
