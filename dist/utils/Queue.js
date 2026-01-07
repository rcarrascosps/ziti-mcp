/**
 * Simple async queue for message handling
 */
export class Queue {
    items = [];
    waiters = [];
    /**
     * Add an item to the queue
     */
    push(item) {
        const waiter = this.waiters.shift();
        if (waiter) {
            waiter(item);
        }
        else {
            this.items.push(item);
        }
    }
    /**
     * Get an item from the queue (blocks if empty)
     */
    async pop() {
        const item = this.items.shift();
        if (item !== undefined) {
            return item;
        }
        return new Promise((resolve) => {
            this.waiters.push(resolve);
        });
    }
    /**
     * Try to get an item without blocking
     */
    tryPop() {
        return this.items.shift();
    }
    /**
     * Check if the queue is empty
     */
    isEmpty() {
        return this.items.length === 0;
    }
    /**
     * Get the current queue length
     */
    get length() {
        return this.items.length;
    }
    /**
     * Clear all items from the queue
     */
    clear() {
        this.items = [];
    }
    /**
     * Get all items and clear the queue
     */
    drain() {
        const items = this.items;
        this.items = [];
        return items;
    }
}
export default Queue;
//# sourceMappingURL=Queue.js.map