/**
 * Simple async queue for message handling
 */
export declare class Queue<T> {
    private items;
    private waiters;
    /**
     * Add an item to the queue
     */
    push(item: T): void;
    /**
     * Get an item from the queue (blocks if empty)
     */
    pop(): Promise<T>;
    /**
     * Try to get an item without blocking
     */
    tryPop(): T | undefined;
    /**
     * Check if the queue is empty
     */
    isEmpty(): boolean;
    /**
     * Get the current queue length
     */
    get length(): number;
    /**
     * Clear all items from the queue
     */
    clear(): void;
    /**
     * Get all items and clear the queue
     */
    drain(): T[];
}
export default Queue;
//# sourceMappingURL=Queue.d.ts.map