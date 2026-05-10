import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock ws BEFORE importing anything that uses it transitively (see qlc-client.test.ts for explanation).
jest.mock('ws', () => ({
  __esModule: true,
  default: require('../mocks/websocket.mock').MockWebSocket,
}));

import { QLCClient } from '../../src/qlc-client.js';
import { QLCConfig } from '../../src/types.js';
import { MockWebSocket } from '../mocks/websocket.mock.js';
import { fetchMock } from '../mocks/fetch.mock.js';

describe('Error Handling and Edge Cases', () => {
  let client: QLCClient;
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
      const originalWebSocket = (global as any).WebSocket;

      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          // Never emit open event to simulate timeout
          this.onopen = null;
        }
      };

      const result = await client.getFunctionsList();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      (global as any).WebSocket = originalWebSocket;
    });

    it('should handle HTTP health check network errors', async () => {
      fetchMock.simulateNetworkError('http://localhost:9999/');

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    it('should handle WebSocket unexpected disconnection', async () => {
      const originalWebSocket = (global as any).WebSocket;

      (global as any).WebSocket = class extends MockWebSocket {
        send(data: string | ArrayBuffer): void {
          // Simulate disconnection during send
          this.readyState = MockWebSocket.CLOSED;
          setTimeout(() => {
            if (this.onclose) this.onclose(new CloseEvent('close', { code: 1006 }));
            this.emit('close');
          }, 0);
        }
      };

      const result = await client.setChannelValue(0, 1, 255);
      expect(result.success).toBe(true); // High-rate API doesn't wait for response

      (global as any).WebSocket = originalWebSocket;
    });
  });

  describe('Protocol and Response Errors', () => {
    it('should handle empty responses gracefully', async () => {
      const originalWebSocket = (global as any).WebSocket;

      (global as any).WebSocket = class extends MockWebSocket {
        send(data: string | ArrayBuffer): void {
          setTimeout(() => this.simulateMessage(''), 10);
        }
      };

      const result = await client.getFunctionsList();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      (global as any).WebSocket = originalWebSocket;
    });

    it('should handle HTML responses from QLC+', async () => {
      const originalWebSocket = (global as any).WebSocket;

      (global as any).WebSocket = class extends MockWebSocket {
        send(data: string | ArrayBuffer): void {
          setTimeout(() => this.simulateMessage('<html><body>QLC+ Interface</body></html>'), 10);
        }
      };

      const result = await client.getFunctionsList();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      (global as any).WebSocket = originalWebSocket;
    });

    it('should handle OK responses correctly', async () => {
      const originalWebSocket = (global as any).WebSocket;

      (global as any).WebSocket = class extends MockWebSocket {
        send(data: string | ArrayBuffer): void {
          setTimeout(() => this.simulateMessage('OK'), 10);
        }
      };

      const result = await client.setFunctionStatus(1, 1);
      expect(result.success).toBe(true);

      (global as any).WebSocket = originalWebSocket;
    });

    it('should handle QLC+API pipe-delimited responses', async () => {
      const originalWebSocket = (global as any).WebSocket;

      (global as any).WebSocket = class extends MockWebSocket {
        send(data: string | ArrayBuffer): void {
          setTimeout(() => this.simulateMessage('QLC+API|getFunctionsNumber|10'), 10);
        }
      };

      const result = await client.getFunctionsNumber();
      expect(result.success).toBe(true);
      expect(result.data).toBe(10);

      (global as any).WebSocket = originalWebSocket;
    });
  });

  describe('Input Validation Errors', () => {
    it('should reject invalid channel values', async () => {
      const tests = [
        { universe: 0, channel: 1, value: -1 },
        { universe: 0, channel: 1, value: 256 },
        { universe: 0, channel: 1, value: 999 }
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
      const result = await client.setMultipleChannels(0, channels);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid value');
    });
  });

  describe('Response Timeout Handling', () => {
    it('should timeout on slow responses', async () => {
      const originalWebSocket = (global as any).WebSocket;

      (global as any).WebSocket = class extends MockWebSocket {
        send(data: string | ArrayBuffer): void {
          // Never send response - let it timeout
          // Timeout is set to 5000ms in the client
        }
      };

      const result = await client.getFunctionsNumber();
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');

      (global as any).WebSocket = originalWebSocket;
    });
  });
});
