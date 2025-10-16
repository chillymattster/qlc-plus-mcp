import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { QLCClient } from '../../src/qlc-client.js';
import { QLCConfig } from '../../src/types.js';
import { MockWebSocket } from '../mocks/websocket.mock.js';
import { fetchMock } from '../mocks/fetch.mock.js';

// Mock ws module
jest.mock('ws', () => ({
  __esModule: true,
  default: MockWebSocket
}));

describe('QLCClient', () => {
  let client: QLCClient;
  let config: QLCConfig;

  beforeEach(() => {
    config = {
      host: 'localhost',
      port: 9999
    };
    client = new QLCClient(config);
    fetchMock.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create client with valid config', () => {
      expect(client).toBeInstanceOf(QLCClient);
    });

    it('should accept custom host and port', () => {
      const customConfig: QLCConfig = {
        host: '192.168.1.100',
        port: 8080
      };
      const customClient = new QLCClient(customConfig);
      expect(customClient).toBeInstanceOf(QLCClient);
    });
  });

  describe('Health Check', () => {
    it('should return true when QLC+ is accessible', async () => {
      fetchMock.setMockResponse('http://localhost:9999/', {
        ok: true,
        status: 200
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when QLC+ is not accessible', async () => {
      fetchMock.simulateNetworkError('http://localhost:9999/');

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('Functions API (Standard WebSocket)', () => {
    it('should get functions number', async () => {
      const result = await client.getFunctionsNumber();
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('number');
    });

    it('should get functions list', async () => {
      const result = await client.getFunctionsList();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get function type', async () => {
      const result = await client.getFunctionType(1);
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });

    it('should get function status', async () => {
      const result = await client.getFunctionStatus(1);
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });

    it('should set function status', async () => {
      const result = await client.setFunctionStatus(1, 1);
      expect(result.success).toBe(true);
    });

    it('should find function by name', async () => {
      const result = await client.getFunctionByName('Test Scene');
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data).toHaveProperty('id');
        expect(result.data).toHaveProperty('name');
      }
    });
  });

  describe('Widgets API (Standard WebSocket)', () => {
    it('should get widgets number', async () => {
      const result = await client.getWidgetsNumber();
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('number');
    });

    it('should get widgets list', async () => {
      const result = await client.getWidgetsList();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get widget type', async () => {
      const result = await client.getWidgetType(1);
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });

    it('should get widget status', async () => {
      const result = await client.getWidgetStatus(1);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status');
    });

    it('should get widget sub-ID list', async () => {
      const result = await client.getWidgetSubIdList(1);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should find widget by name', async () => {
      const result = await client.getWidgetByName('Test Button');
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data).toHaveProperty('id');
        expect(result.data).toHaveProperty('name');
      }
    });
  });

  describe('Channels API (Standard WebSocket)', () => {
    it('should get channels values', async () => {
      const result = await client.getChannelsValues(1, 1, 10);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should get universe snapshot', async () => {
      const result = await client.getUniverseSnapshot(0);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('High-Rate APIs (No QLC+API prefix)', () => {
    it('should set channel value with valid parameters', async () => {
      const result = await client.setChannelValue(0, 1, 255);
      expect(result.success).toBe(true);
    });

    it('should reject invalid channel values', async () => {
      const result1 = await client.setChannelValue(0, 1, -1);
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('0-255');

      const result2 = await client.setChannelValue(0, 1, 256);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('0-255');
    });

    it('should set multiple channels', async () => {
      const channels = { 1: 255, 2: 128, 3: 64 };
      const result = await client.setMultipleChannels(0, channels);
      expect(result.success).toBe(true);
      expect(result.data?.channelsSet).toBe(3);
    });

    it('should reject invalid values in multiple channels', async () => {
      const channels = { 1: 255, 2: -1, 3: 64 };
      const result = await client.setMultipleChannels(0, channels);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid value');
    });

    it('should set widget value', async () => {
      const result = await client.setWidgetValue(1, 128);
      expect(result.success).toBe(true);
    });

    it('should reject invalid widget values', async () => {
      const result1 = await client.setWidgetValue(1, -1);
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('0-255');

      const result2 = await client.setWidgetValue(1, 256);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('0-255');
    });
  });

  describe('Cue List Control', () => {
    it('should control cue list with PLAY', async () => {
      const result = await client.cueListControl(1, 'PLAY');
      expect(result.success).toBe(true);
    });

    it('should control cue list with NEXT', async () => {
      const result = await client.cueListControl(1, 'NEXT');
      expect(result.success).toBe(true);
    });

    it('should control cue list with PREV', async () => {
      const result = await client.cueListControl(1, 'PREV');
      expect(result.success).toBe(true);
    });

    it('should go to specific cue step', async () => {
      const result = await client.cueListGoToStep(1, 5);
      expect(result.success).toBe(true);
    });
  });

  describe('Frame Control', () => {
    it('should navigate frame pages', async () => {
      const result1 = await client.frameControl(1, 'NEXT_PG');
      expect(result1.success).toBe(true);

      const result2 = await client.frameControl(1, 'PREV_PG');
      expect(result2.success).toBe(true);
    });
  });

  describe('Animation Widget Control', () => {
    it('should trigger animation control', async () => {
      const result = await client.animationControl(1, 0);
      expect(result.success).toBe(true);
    });
  });

  describe('Workspace Generation', () => {
    it('should generate workspace XML', () => {
      const config = {
        fixtures: [
          { name: 'LED 1', manufacturer: 'Generic', model: 'RGB', universe: 0, address: 1, channels: 3 }
        ],
        scenes: [
          { name: 'Red', fixtureId: 0, channels: { 1: 255, 2: 0, 3: 0 } }
        ]
      };

      const xml = client.generateWorkspace(config);
      expect(typeof xml).toBe('string');
      expect(xml).toContain('<?xml');
      expect(xml).toContain('Workspace');
      expect(xml).toContain('LED 1');
    });

    it('should save workspace to file', () => {
      const xml = '<?xml version="1.0"?><Workspace></Workspace>';
      const result = client.saveWorkspace(xml, '/tmp/test.qxw');
      expect(result.success).toBe(true);
    });
  });

  describe('Effect Sequencing', () => {
    it('should create fade effect', async () => {
      const result = await client.createEffectSequence('fade', 0, [1, 2, 3], 1000, 40);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('framesRendered');
      expect(result.data).toHaveProperty('effectType', 'fade');
    });

    it('should create strobe effect', async () => {
      const result = await client.createEffectSequence('strobe', 0, [1], 500, 40);
      expect(result.success).toBe(true);
      expect(result.data?.effectType).toBe('strobe');
    });

    it('should create chase effect', async () => {
      const result = await client.createEffectSequence('chase', 0, [1, 2, 3, 4], 2000, 40);
      expect(result.success).toBe(true);
      expect(result.data?.effectType).toBe('chase');
    });

    it('should create color wash effect', async () => {
      const result = await client.createEffectSequence('color_wash', 0, [1, 2, 3], 3000, 40);
      expect(result.success).toBe(true);
      expect(result.data?.effectType).toBe('color_wash');
    });
  });

  describe('Error Handling', () => {
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

      // Restore original WebSocket
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

      // Restore original WebSocket
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

      // Restore original WebSocket
      (global as any).WebSocket = originalWebSocket;
    });

    it('should handle QLC+API pipe-delimited responses', async () => {
      const originalWebSocket = (global as any).WebSocket;
      (global as any).WebSocket = class extends MockWebSocket {
        send(data: string | ArrayBuffer): void {
          setTimeout(() => this.simulateMessage('QLC+API|getFunctionsNumber|5'), 10);
        }
      };

      const result = await client.getFunctionsNumber();
      expect(result.success).toBe(true);
      expect(result.data).toBe(5);

      // Restore original WebSocket
      (global as any).WebSocket = originalWebSocket;
    });
  });
});