/**
 * Simple async queue for message handling
 */

export class Queue<T> {
  private items: T[] = [];
  private waiters: Array<(item: T) => void> = [];

  /**
   * Add an item to the queue
   */
  push(item: T): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
    } else {
      this.items.push(item);
    }
  }

  /**
   * Get an item from the queue (blocks if empty)
   */
  async pop(): Promise<T> {
    const item = this.items.shift();
    if (item !== undefined) {
      return item;
    }

    return new Promise<T>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /**
   * Try to get an item without blocking
   */
  tryPop(): T | undefined {
    return this.items.shift();
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Get the current queue length
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Get all items and clear the queue
   */
  drain(): T[] {
    const items = this.items;
    this.items = [];
    return items;
  }
}

export default Queue;
