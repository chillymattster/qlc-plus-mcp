import { describe, it, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';
import { XMLParser } from 'fast-xml-parser';

// Use jest.unstable_mockModule for ESM-aware module mocking. Unlike `jest.mock`
// (which doesn't reliably intercept ESM imports under ts-jest's default-esm
// preset), `unstable_mockModule` registers the mock against Jest's ESM module
// loader BEFORE we dynamically import the system under test below. See
// KNOWN_ISSUES.md (bucket 1) for the historical context.
jest.unstable_mockModule('ws', async () => {
  const { MockWebSocket } = await import('../mocks/websocket.mock.js');
  return {
    __esModule: true,
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  };
});

// Module-scope bindings populated in beforeAll after the mock is registered.
let QLCClient: typeof import('../../src/qlc-client.js').QLCClient;
let MockWebSocket: typeof import('../mocks/websocket.mock.js').MockWebSocket;
let fetchMock: typeof import('../mocks/fetch.mock.js').fetchMock;
type QLCConfig = import('../../src/types.js').QLCConfig;

beforeAll(async () => {
  // Dynamic imports MUST come AFTER unstable_mockModule registration above so
  // qlc-client picks up the mocked `ws` instead of the real one.
  ({ QLCClient } = await import('../../src/qlc-client.js'));
  ({ MockWebSocket } = await import('../mocks/websocket.mock.js'));
  ({ fetchMock } = await import('../mocks/fetch.mock.js'));
});

describe('QLCClient', () => {
  let client: InstanceType<typeof QLCClient>;
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
      const freshClient = new QLCClient(config);
      // Stub out the next response by overriding the mock-table for the
      // upcoming command (one-shot via setMockResponse on the next instance).
      // Easier: just connect, then spy on any new MockWebSocket created.
      // Simpler approach: monkey-patch MockWebSocket.prototype.send for this
      // single test, then restore.
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage(''), 5);
      };
      try {
        const result = await freshClient.getFunctionsList();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });

    it('should handle HTML responses from QLC+', async () => {
      const freshClient = new QLCClient(config);
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage('<html><body>QLC+ Interface</body></html>'), 5);
      };
      try {
        const result = await freshClient.getFunctionsList();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });

    it('should handle OK responses correctly', async () => {
      const freshClient = new QLCClient(config);
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage('OK'), 5);
      };
      try {
        const result = await freshClient.setFunctionStatus(1, 1);
        expect(result.success).toBe(true);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });

    it('should handle QLC+API pipe-delimited responses', async () => {
      const freshClient = new QLCClient(config);
      const original = MockWebSocket.prototype.send;
      MockWebSocket.prototype.send = function (this: any) {
        setTimeout(() => this.simulateMessage('QLC+API|getFunctionsNumber|5'), 5);
      };
      try {
        const result = await freshClient.getFunctionsNumber();
        expect(result.success).toBe(true);
        expect(result.data).toBe(5);
      } finally {
        MockWebSocket.prototype.send = original;
      }
    });
  });

  describe('Workspace Generation with Chasers', () => {
    it('should generate workspace with fixtures, scenes, and chasers', () => {
      const config = {
        fixtures: [
          { name: 'LED 1', manufacturer: 'Generic', model: 'Dimmer', universe: 0, address: 0, channels: 1 },
          { name: 'LED 2', manufacturer: 'Generic', model: 'Dimmer', universe: 0, address: 1, channels: 1 }
        ],
        scenes: [
          { name: 'Scene A', fixtureId: 0, channels: { 0: 255 } },
          { name: 'Scene B', fixtureId: 1, channels: { 0: 255 } }
        ],
        chasers: [
          {
            name: 'Alternating Chase',
            steps: [
              { sceneIndex: 0, hold: 1000 },
              { sceneIndex: 1, hold: 1000 }
            ],
            runOrder: 'Loop' as const,
            direction: 'Forward' as const
          }
        ]
      };

      const xml = client.generateWorkspace(config);

      // Verify XML contains fixtures
      expect(xml).toContain('<Manufacturer>Generic</Manufacturer>');
      expect(xml).toContain('<Name>LED 1</Name>');
      expect(xml).toContain('<Name>LED 2</Name>');

      // Verify XML contains scenes with correct IDs
      expect(xml).toContain('Type="Scene"');
      expect(xml).toContain('Name="Scene A"');
      expect(xml).toContain('Name="Scene B"');
      expect(xml).toContain('ID="0"');
      expect(xml).toContain('ID="1"');

      // Verify XML contains chaser with correct structure
      expect(xml).toContain('Type="Chaser"');
      expect(xml).toContain('Name="Alternating Chase"');
      expect(xml).toContain('ID="2"');
      expect(xml).toContain('<Direction>Forward</Direction>');
      expect(xml).toContain('<RunOrder>Loop</RunOrder>');
      expect(xml).toContain('<SpeedModes');
      expect(xml).toContain('FadeIn="Common"');
      expect(xml).toContain('Duration="PerStep"');

      // Verify step structure
      expect(xml).toContain('Number="0"');
      expect(xml).toContain('Hold="1000"');
      expect(xml).toContain('Number="1"');
    });

    it('should handle chasers with fade times', () => {
      const config = {
        fixtures: [
          { name: 'RGB LED', manufacturer: 'Generic', model: 'RGB', universe: 0, address: 0, channels: 3 }
        ],
        scenes: [
          { name: 'Red', fixtureId: 0, channels: { 0: 255, 1: 0, 2: 0 } },
          { name: 'Green', fixtureId: 0, channels: { 0: 0, 1: 255, 2: 0 } },
          { name: 'Blue', fixtureId: 0, channels: { 0: 0, 1: 0, 2: 255 } }
        ],
        chasers: [
          {
            name: 'RGB Fade',
            steps: [
              { sceneIndex: 0, hold: 500, fadeIn: 250, fadeOut: 250 },
              { sceneIndex: 1, hold: 500, fadeIn: 250, fadeOut: 250 },
              { sceneIndex: 2, hold: 500, fadeIn: 250, fadeOut: 250 }
            ]
          }
        ]
      };

      const xml = client.generateWorkspace(config);

      expect(xml).toContain('Type="Chaser"');
      expect(xml).toContain('Name="RGB Fade"');
      expect(xml).toContain('FadeIn="250"');
      expect(xml).toContain('FadeOut="250"');
      expect(xml).toContain('Hold="500"');
    });

    it('should support PingPong run order', () => {
      const config = {
        fixtures: [
          { name: 'LED', manufacturer: 'Generic', model: 'Dimmer', universe: 0, address: 0, channels: 1 }
        ],
        scenes: [
          { name: 'Low', fixtureId: 0, channels: { 0: 50 } },
          { name: 'High', fixtureId: 0, channels: { 0: 200 } }
        ],
        chasers: [
          {
            name: 'PingPong Test',
            steps: [
              { sceneIndex: 0, hold: 1000 },
              { sceneIndex: 1, hold: 1000 }
            ],
            runOrder: 'PingPong' as const
          }
        ]
      };

      const xml = client.generateWorkspace(config);

      expect(xml).toContain('<RunOrder>PingPong</RunOrder>');
    });

    it('should support Backward direction', () => {
      const config = {
        fixtures: [
          { name: 'LED', manufacturer: 'Generic', model: 'Dimmer', universe: 0, address: 0, channels: 1 }
        ],
        scenes: [
          { name: 'S1', fixtureId: 0, channels: { 0: 100 } },
          { name: 'S2', fixtureId: 0, channels: { 0: 200 } }
        ],
        chasers: [
          {
            name: 'Backward Chase',
            steps: [
              { sceneIndex: 0, hold: 500 },
              { sceneIndex: 1, hold: 500 }
            ],
            direction: 'Backward' as const
          }
        ]
      };

      const xml = client.generateWorkspace(config);

      expect(xml).toContain('<Direction>Backward</Direction>');
    });

    it('should generate workspace without chasers when none provided', () => {
      const config = {
        fixtures: [
          { name: 'LED', manufacturer: 'Generic', model: 'Dimmer', universe: 0, address: 0, channels: 1 }
        ],
        scenes: [
          { name: 'Scene', fixtureId: 0, channels: { 0: 255 } }
        ]
      };

      const xml = client.generateWorkspace(config);

      expect(xml).toContain('Type="Scene"');
      expect(xml).not.toContain('Type="Chaser"');
    });

    it('should assign sequential function IDs', () => {
      const config = {
        fixtures: [
          { name: 'LED', manufacturer: 'Generic', model: 'Dimmer', universe: 0, address: 0, channels: 1 }
        ],
        scenes: [
          { name: 'S1', fixtureId: 0, channels: { 0: 50 } },
          { name: 'S2', fixtureId: 0, channels: { 0: 100 } },
          { name: 'S3', fixtureId: 0, channels: { 0: 150 } }
        ],
        chasers: [
          {
            name: 'Chase 1',
            steps: [{ sceneIndex: 0, hold: 500 }, { sceneIndex: 1, hold: 500 }]
          },
          {
            name: 'Chase 2',
            steps: [{ sceneIndex: 1, hold: 500 }, { sceneIndex: 2, hold: 500 }]
          }
        ]
      };

      const xml = client.generateWorkspace(config);

      // Parse the XML rather than regex-matching attribute strings — fast-xml-parser
      // doesn't guarantee attribute ordering in its output, so a regex like
      // /Type="Scene"[^>]*ID="(\d+)"/ is brittle (it returns null when ID is
      // emitted before Type). Parsing gives us a stable structural assertion.
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const parsed = parser.parse(xml);
      const functionsRaw = parsed?.Workspace?.Engine?.Function;
      const functions: any[] = Array.isArray(functionsRaw) ? functionsRaw : functionsRaw ? [functionsRaw] : [];

      const scenes = functions.filter((f) => f['@_Type'] === 'Scene');
      const chasers = functions.filter((f) => f['@_Type'] === 'Chaser');

      // Scenes should have IDs 0, 1, 2 (sequential, in declaration order)
      expect(scenes).toHaveLength(3);
      expect(scenes.map((s) => String(s['@_ID']))).toEqual(['0', '1', '2']);

      // Chasers should have IDs 3, 4 (continuing the function-ID sequence)
      expect(chasers).toHaveLength(2);
      expect(chasers.map((c) => ({ name: c['@_Name'], id: String(c['@_ID']) }))).toEqual([
        { name: 'Chase 1', id: '3' },
        { name: 'Chase 2', id: '4' },
      ]);
    });
  });
});
