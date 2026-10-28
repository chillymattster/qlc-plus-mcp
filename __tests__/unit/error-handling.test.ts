import { describe, it, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';

// See qlc-client.test.ts for the full ESM-mocking rationale. `jest.mock`
// doesn't reliably intercept ESM imports under ts-jest's default-esm preset,
// so we use jest.unstable_mockModule and dynamic imports instead.
jest.unstable_mockModule('ws', async () => {
  const { MockWebSocket } = await import('../mocks/websocket.mock.js');
  return {
    __esModule: true,
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  };
});

let QLCClient: typeof import('../../src/qlc-client.js').QLCClient;
let MockWebSocket: typeof import('../mocks/websocket.mock.js').MockWebSocket;
let fetchMock: typeof import('../mocks/fetch.mock.js').fetchMock;
type QLCConfig = import('../../src/types.js').QLCConfig;

beforeAll(async () => {
  ({ QLCClient } = await import('../../src/qlc-client.js'));
  ({ MockWebSocket } = await import('../mocks/websocket.mock.js'));
  ({ fetchMock } = await import('../mocks/fetch.mock.js'));
});

describe('Error Handling and Edge Cases', () => {
  let client: InstanceType<typeof QLCClient>;
  let config: QLCConfig;

  beforeEach(() => {
    config = { host: 'localhost', port: 9999 };
    client = new QLCClient(config);
    fetchMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Network Connection Errors', () => {
    it('should handle WebSocket connection timeout', async () => {
      // src/qlc-client.ts has a 5s connect() timeout — flip the mock into
      // "never emit open" mode and let the real timeout fire.
      MockWebSocket.suppressOpen = true;
      try {
        const freshClient = new QLCClient(config);
        const result = await freshClient.getFunctionsList();
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      } finally {
        MockWebSocket.suppressOpen = false;
      }
    }, 10000);

    it('should handle HTTP health check network errors', async () => {
      fetchMock.simulateNetworkError('http://localhost:9999/');

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    it('should handle WebSocket unexpected disconnection', async () => {
      // setChannelValue is a high-rate API: it doesn't await a response,
      // it just calls send() and resolves. Even if the underlying socket
      // would close mid-send, the client returns success: true synchronously.
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        this.readyState = MockWebSocket.CLOSED;
      };
      try {
        const result = await client.setChannelValue(1, 1, 255);
        expect(result.success).toBe(true);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });
  });

  describe('Protocol and Response Errors', () => {
    it('should handle empty responses gracefully', async () => {
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage(''), 5);
      };
      try {
        const freshClient = new QLCClient(config);
        const result = await freshClient.getFunctionsList();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });

    it('should handle HTML responses from QLC+', async () => {
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage('<html><body>QLC+ Interface</body></html>'), 5);
      };
      try {
        const freshClient = new QLCClient(config);
        const result = await freshClient.getFunctionsList();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });

    it('should handle OK responses correctly', async () => {
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage('OK'), 5);
      };
      try {
        const freshClient = new QLCClient(config);
        const result = await freshClient.setFunctionStatus(1, 1);
        expect(result.success).toBe(true);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });

    it('should handle QLC+API pipe-delimited responses', async () => {
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage('QLC+API|getFunctionsNumber|10'), 5);
      };
      try {
        const freshClient = new QLCClient(config);
        const result = await freshClient.getFunctionsNumber();
        expect(result.success).toBe(true);
        expect(result.data).toBe(10);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });
  });

  describe('Input Validation Errors', () => {
    it('should reject invalid channel values', async () => {
      const tests = [
        { universe: 1, channel: 1, value: -1 },
        { universe: 1, channel: 1, value: 256 },
        { universe: 1, channel: 1, value: 999 }
      ];

      for (const test of tests) {
        const result = await client.setChannelValue(test.universe, test.channel, test.value);
        expect(result.success).toBe(false);
        expect(result.error).toContain('0-255');
      }
    });

    it('should reject invalid widget values', async () => {
      const tests = [
        { widgetId: 1, value: -1 },
        { widgetId: 1, value: 256 },
        { widgetId: 1, value: 1000 }
      ];

      for (const test of tests) {
        const result = await client.setWidgetValue(test.widgetId, test.value);
        expect(result.success).toBe(false);
        expect(result.error).toContain('0-255');
      }
    });

    it('should reject invalid values in multiple channels', async () => {
      const channels = { 1: 255, 2: -1, 3: 64 };
      const result = await client.setMultipleChannels(1, channels);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid value');
    });
  });

  describe('Response Timeout Handling', () => {
    it('should timeout on slow responses', async () => {
      // src/qlc-client.ts hard-codes a 5s response timeout in send() and
      // resolves with `{success: false, error: 'Response timeout'}`. Most of
      // the public methods then re-wrap that into a generic 'Failed to ...'
      // error, which would mask the timeout reason. setFunctionStatus is one
      // of the few that returns the raw send() result, so it surfaces the
      // 'timeout' substring this test asserts on.
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function () {
        // Never respond — let the response timeout fire.
      };
      try {
        const freshClient = new QLCClient(config);
        const result = await freshClient.setFunctionStatus(1, 1);
        expect(result.success).toBe(false);
        expect(result.error?.toLowerCase()).toContain('timeout');
      } finally {
        MockWebSocket.prototype.send = original;
      }
    }, 10000);
  });
});
