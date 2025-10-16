import { jest } from '@jest/globals';

// Mock WebSocket globally for all tests
class MockWebSocket {
  readyState = 1; // OPEN
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private listeners: Map<string, Function[]> = new Map();

  constructor(public url: string) {
    // Simulate connection opening after next tick
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
      this.emit('open');
    }, 0);
  }

  send(data: string | ArrayBuffer): void {
    // Mock send implementation
  }

  close(): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
    this.emit('close');
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  // Mock methods for simulating responses
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
    this.emit('error', new Error('Connection failed'));
  }
}

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Make MockWebSocket available globally
(global as any).MockWebSocket = MockWebSocket;
(global as any).WebSocket = MockWebSocket;

// Setup default console methods for cleaner test output
const originalConsole = { ...console };
beforeEach(() => {
  // Optionally suppress console output during tests
  if (process.env.SUPPRESS_CONSOLE === 'true') {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

afterEach(() => {
  // Restore console
  jest.restoreAllMocks();
});

// Global test timeout
jest.setTimeout(10000);