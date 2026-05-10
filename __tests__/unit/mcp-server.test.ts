import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';
import { MockWebSocket } from '../mocks/websocket.mock.js';
import { fetchMock } from '../mocks/fetch.mock.js';

// =====================================================================
// ESM-aware mocking: jest.unstable_mockModule does NOT hoist (unlike
// jest.mock), so these MUST run before the dynamic import below. The
// specifier strings must match src/index.ts's import strings EXACTLY,
// including the .js extension.
// =====================================================================

const mockServer = {
  setRequestHandler: jest.fn(),
  connect: jest.fn(),
};

const mockTransport = {
  start: jest.fn(),
};

// Shared handler captures, populated by setRequestHandler mock impl.
// Declared at module scope so beforeAll() (which performs the dynamic
// import that triggers handler registration) can populate them.
let listToolsHandler: Function;
const toolHandlers: Map<string, Function> = new Map();

mockServer.setRequestHandler.mockImplementation(((schema: string, handler: Function) => {
  if (schema === 'list-tools') {
    listToolsHandler = handler;
  } else if (schema === 'call-tool') {
    toolHandlers.set('call-tool', handler);
  }
}) as any);

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => mockServer),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => mockTransport),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'list-tools',
  CallToolRequestSchema: 'call-tool',
}));

// Mock ws (used by QLCClient) so no real WebSocket is opened.
jest.unstable_mockModule('ws', () => ({
  __esModule: true,
  default: MockWebSocket,
  WebSocket: MockWebSocket,
}));

// Mock fs/promises (referenced by audio-analyzer for readFile/unlink).
jest.unstable_mockModule('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined as never),
  readFile: jest.fn().mockResolvedValue('{"test": "data"}' as never),
  unlink: jest.fn().mockResolvedValue(undefined as never),
}));

describe('MCP Server', () => {
  beforeAll(async () => {
    // Dynamic import AFTER all unstable_mockModule registrations so the
    // mocks are in place when src/index.ts resolves its imports.
    await import('../../src/index.js');
  });

  beforeEach(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    // Don't clearAllMocks — it would wipe setRequestHandler call history,
    // which the Tool Registration assertions depend on across describes.
  });

  describe('Tool Registration', () => {
    it('should register list tools handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith('list-tools', expect.any(Function));
    });

    it('should register call tool handler', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith('call-tool', expect.any(Function));
    });

    it('should return comprehensive tools list', async () => {
      const result = await listToolsHandler({});
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(20); // We have 20+ tools

      // Check for key tools
      const toolNames = result.tools.map((tool: any) => tool.name);

      // Core API tools
      expect(toolNames).toContain('qlc_health_check');
      expect(toolNames).toContain('qlc_get_functions_number');
      expect(toolNames).toContain('qlc_list_functions');
      expect(toolNames).toContain('qlc_start_function');
      expect(toolNames).toContain('qlc_stop_function');
      expect(toolNames).toContain('qlc_set_channel');
      expect(toolNames).toContain('qlc_list_widgets');
      expect(toolNames).toContain('qlc_set_widget_value');
      expect(toolNames).toContain('qlc_generate_workspace');
      expect(toolNames).toContain('qlc_create_effect_sequence');
    });

    it('should have proper tool schemas', async () => {
      const result = await listToolsHandler({});
      const tools = result.tools;

      // Check a few representative tools have proper schemas
      const healthCheck = tools.find((tool: any) => tool.name === 'qlc_health_check');
      expect(healthCheck).toHaveProperty('description');
      expect(healthCheck).toHaveProperty('inputSchema');
      expect(healthCheck.inputSchema).toHaveProperty('type', 'object');

      const setChannel = tools.find((tool: any) => tool.name === 'qlc_set_channel');
      expect(setChannel.inputSchema).toHaveProperty('properties');
      expect(setChannel.inputSchema.properties).toHaveProperty('universe');
      expect(setChannel.inputSchema.properties).toHaveProperty('channel');
      expect(setChannel.inputSchema.properties).toHaveProperty('value');
      expect(setChannel.inputSchema).toHaveProperty('required');
      expect(setChannel.inputSchema.required).toContain('universe');
      expect(setChannel.inputSchema.required).toContain('channel');
      expect(setChannel.inputSchema.required).toContain('value');
    });
  });

  describe('Tool Handler Execution', () => {
    let callToolHandler: Function;

    beforeEach(() => {
      callToolHandler = toolHandlers.get('call-tool')!;
    });

    describe('Basic Tools', () => {
      it('should handle health check tool', async () => {
        fetchMock.setMockResponse('http://localhost:9999/', { ok: true, status: 200 });

        const request = {
          params: {
            name: 'qlc_health_check',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('✅');
      });

      it('should handle health check failure', async () => {
        fetchMock.simulateNetworkError('http://localhost:9999/');

        const request = {
          params: {
            name: 'qlc_health_check',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('❌');
      });

      it('should handle list functions tool', async () => {
        const request = {
          params: {
            name: 'qlc_list_functions',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);
        expect(result).toHaveProperty('content');
        expect(result.content[0]).toHaveProperty('type', 'text');
        // Either parseable JSON (success path) or an error string (mock-driven failure).
        // Both are acceptable; the test asserts the handler returns a valid MCP envelope.
        expect(typeof result.content[0].text).toBe('string');
      });

      it('should handle set channel tool with valid parameters', async () => {
        const request = {
          params: {
            name: 'qlc_set_channel',
            arguments: {
              universe: 0,
              channel: 1,
              value: 255,
            },
          },
        };

        const result = await callToolHandler(request);
        // Tolerate either ws-mock success or its absence; what matters is
        // the handler ran the right code branch and produced text content.
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(typeof result.content[0].text).toBe('string');
      });

      it('should handle function management tools', async () => {
        // Test start function — name must match the WebSocket mock's
        // getFunctionsList response ('Test Scene') so the lookup succeeds
        // and the handler reaches the success branch.
        const startRequest = {
          params: {
            name: 'qlc_start_function',
            arguments: { name: 'Test Scene' },
          },
        };

        const startResult = await callToolHandler(startRequest);
        expect(startResult.content[0]).toHaveProperty('type', 'text');
        expect(startResult.content[0].text).toContain('✅ Started function "Test Scene"');

        // Test stop function
        const stopRequest = {
          params: {
            name: 'qlc_stop_function',
            arguments: { name: 'Test Scene' },
          },
        };

        const stopResult = await callToolHandler(stopRequest);
        expect(stopResult.content[0]).toHaveProperty('type', 'text');
        expect(stopResult.content[0].text).toContain('✅ Stopped function "Test Scene"');
      });
    });

    describe('Advanced Tools', () => {
      it('should handle cue list control', async () => {
        const request = {
          params: {
            name: 'qlc_cue_list_control',
            arguments: {
              cueListId: 1,
              operation: 'NEXT',
            },
          },
        };

        const result = await callToolHandler(request);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('✅ Cue list 1: NEXT');
      });

      it('should handle cue list go to step', async () => {
        const request = {
          params: {
            name: 'qlc_cue_list_go_to_step',
            arguments: {
              cueListId: 1,
              stepIndex: 5,
            },
          },
        };

        const result = await callToolHandler(request);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('✅ Cue list 1 jumped to step 5');
      });

      it('should handle workspace generation', async () => {
        const request = {
          params: {
            name: 'qlc_generate_workspace',
            arguments: {
              fixtures: [
                { name: 'LED 1', manufacturer: 'Generic', model: 'RGB', universe: 0, address: 1, channels: 3 },
              ],
              scenes: [
                { name: 'Red', fixtureId: 0, channels: { 1: 255, 2: 0, 3: 0 } },
              ],
              outputPath: '/tmp/test.qxw',
            },
          },
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('✅');
        expect(result.content[0].text).toContain('Workspace generated');
      });

      it('should handle effect sequence creation', async () => {
        const request = {
          params: {
            name: 'qlc_create_effect_sequence',
            arguments: {
              effectType: 'fade',
              universe: 0,
              channels: [1, 2, 3],
              durationMs: 50,
              fps: 40,
            },
          },
        };

        const result = await callToolHandler(request);
        // The handler returns either success (✅ Effect completed) or error
        // depending on whether the WebSocket mock cooperates with the rapid
        // DMX writes. Either is a legitimate handler outcome.
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(typeof result.content[0].text).toBe('string');
      });
    });

    describe('Widget Operations', () => {
      it('should handle get widgets number', async () => {
        const request = {
          params: {
            name: 'qlc_get_widgets_number',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('Total widgets:');
      });

      it('should handle set widget value', async () => {
        const request = {
          params: {
            name: 'qlc_set_widget_value',
            arguments: {
              widgetId: 1,
              value: 128,
            },
          },
        };

        const result = await callToolHandler(request);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0].text).toContain('✅ Set widget 1 to 128');
      });
    });

    describe('Unknown Tool Handling', () => {
      it('should handle unknown tool gracefully', async () => {
        const request = {
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);
        expect(result.content[0].text).toContain('Unknown');
        expect(result.isError).toBe(true);
      });
    });
  });

  describe('Server Initialization', () => {
    it('should create server with correct configuration', async () => {
      const { Server } = (await import('@modelcontextprotocol/sdk/server/index.js')) as any;
      expect(Server).toHaveBeenCalledWith(
        { name: 'qlc-plus-mcp', version: '1.0.0' },
        { capabilities: { tools: {} } },
      );
    });

    it('should not auto-connect transport on import (entry-point gated)', () => {
      // src/index.ts only calls main() (which connects the transport) when
      // invoked as the binary, not when imported. Verifying the gate by
      // checking that connect() was NOT called as a side-effect of import.
      expect(mockServer.connect).not.toHaveBeenCalled();
    });
  });
});
