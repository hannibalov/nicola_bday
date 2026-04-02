/**
 * Adaptive polling: increases delay on failures, resets on success.
 * Prevents hammering the server when network is poor.
 * 
 * @param onPoll Function to call on each poll (can be async)
 * @param initialDelayMs Initial polling interval in milliseconds (default 4000ms)
 * @param maxDelayMs Maximum polling interval in milliseconds (default 30000ms)
 * @returns Object with start() and stop() methods to control the poller
 */
export function createAdaptivePoller(
    onPoll: () => void | Promise<void>,
    initialDelayMs = 4000,
    maxDelayMs = 30000,
) {
    let currentDelay = initialDelayMs;
    let timeout: NodeJS.Timeout | null = null;
    let isActive = false;
    let isScheduled = false;

    const executePoll = async () => {
        isScheduled = false;
        if (!isActive) return;

        try {
            await onPoll();
            // Success: reset to initial delay
            currentDelay = initialDelayMs;
        } catch {
            // Failure: increase delay by 50% (backoff)
            currentDelay = Math.min(currentDelay * 1.5, maxDelayMs);
        }

        if (isActive) {
            timeout = setTimeout(executePoll, currentDelay);
            isScheduled = true;
        }
    };

    const start = () => {
        if (!isActive) {
            isActive = true;
            currentDelay = initialDelayMs;
            if (!isScheduled) {
                timeout = setTimeout(executePoll, initialDelayMs);
                isScheduled = true;
            }
        }
    };

    const stop = () => {
        isActive = false;
        if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
        }
        isScheduled = false;
    };

    return { start, stop };
}
