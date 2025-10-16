#!/usr/bin/env node
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema,ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {QLCClient} from './qlc-client.js';

const client = new QLCClient({
  host: process.env.QLC_HOST || 'localhost',
  port: parseInt(process.env.QLC_PORT || '9999')
});

const server = new Server(
  { name: 'qlc-plus-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async (req: any) => ({
  tools: [
    {
      name: 'qlc_health_check',
      description: 'Check if QLC+ is accessible via HTTP',
      inputSchema: { type: 'object', properties: {} }
    },

    // ============ Functions API ============
    {
      name: 'qlc_get_functions_number',
      description: 'Get the total number of functions loaded in QLC+',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'qlc_list_functions',
      description: 'Get list of all functions with their IDs and names',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'qlc_get_function_type',
      description: 'Get the type of a specific function (Scene, Chaser, EFX, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          functionId: { type: 'number', description: 'Function ID' }
        },
        required: ['functionId']
      }
    },
    {
      name: 'qlc_get_function_status',
      description: 'Get running status of a function (Running, Stopped, or Undefined)',
      inputSchema: {
        type: 'object',
        properties: {
          functionId: { type: 'number', description: 'Function ID' }
        },
        required: ['functionId']
      }
    },
    {
      name: 'qlc_start_function',
      description: 'Start a function by name (searches by name, then starts)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Function name' }
        },
        required: ['name']
      }
    },
    {
      name: 'qlc_stop_function',
      description: 'Stop a function by name (searches by name, then stops)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Function name' }
        },
        required: ['name']
      }
    },
    {
      name: 'qlc_set_function_status',
      description: 'Set function status by ID (0=stop, 1=start)',
      inputSchema: {
        type: 'object',
        properties: {
          functionId: { type: 'number', description: 'Function ID' },
          status: { type: 'number', enum: [0, 1], description: '0=stop, 1=start' }
        },
        required: ['functionId', 'status']
      }
    },

    // ============ Widgets API ============
    {
      name: 'qlc_get_widgets_number',
      description: 'Get the total number of Virtual Console widgets',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'qlc_list_widgets',
      description: 'Get list of all Virtual Console widgets with their IDs and names',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'qlc_get_widget_type',
      description: 'Get the type of a Virtual Console widget (Button, Slider, CueList, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          widgetId: { type: 'number', description: 'Widget ID' }
        },
        required: ['widgetId']
      }
    },
    {
      name: 'qlc_get_widget_status',
      description: 'Get the current status of a Virtual Console widget',
      inputSchema: {
        type: 'object',
        properties: {
          widgetId: { type: 'number', description: 'Widget ID' }
        },
        required: ['widgetId']
      }
    },
    {
      name: 'qlc_get_widget_sub_id_list',
      description: 'Get sub-widgets (presets) of a Virtual Console widget',
      inputSchema: {
        type: 'object',
        properties: {
          widgetId: { type: 'number', description: 'Widget ID' }
        },
        required: ['widgetId']
      }
    },
    {
      name: 'qlc_set_widget_value',
      description: 'Set widget value (Buttons: 0/255, Sliders: 0-255, Audio Triggers: 0/255)',
      inputSchema: {
        type: 'object',
        properties: {
          widgetId: { type: 'number', description: 'Widget ID' },
          value: { type: 'number', minimum: 0, maximum: 255, description: 'Value 0-255' }
        },
        required: ['widgetId', 'value']
      }
    },

    // ============ Channels API ============
    {
      name: 'qlc_get_channels_values',
      description: 'Get DMX channel values for a range in a universe',
      inputSchema: {
        type: 'object',
        properties: {
          universe: { type: 'number', description: 'Universe index (1-based)' },
          startAddress: { type: 'number', description: 'DMX start address (1-512)' },
          count: { type: 'number', description: 'Number of channels to retrieve' }
        },
        required: ['universe', 'startAddress', 'count']
      }
    },
    {
      name: 'qlc_get_universe_snapshot',
      description: 'Get all 512 DMX channel values for a universe',
      inputSchema: {
        type: 'object',
        properties: {
          universe: { type: 'number', description: 'Universe index (1-based)' }
        },
        required: ['universe']
      }
    },
    {
      name: 'qlc_set_channel',
      description: 'Set a single DMX channel value in Simple Desk (uses absolute addressing)',
      inputSchema: {
        type: 'object',
        properties: {
          universe: { type: 'number', description: 'Universe (0-based for calculation)' },
          channel: { type: 'number', description: 'Channel within universe (1-512)' },
          value: { type: 'number', minimum: 0, maximum: 255, description: 'DMX value 0-255' }
        },
        required: ['universe', 'channel', 'value']
      }
    },
    {
      name: 'qlc_set_multiple_channels',
      description: 'Set multiple DMX channels at once in a universe',
      inputSchema: {
        type: 'object',
        properties: {
          universe: { type: 'number', description: 'Universe (0-based)' },
          channels: {
            type: 'object',
            description: 'Channel:value pairs (e.g., {"1": 255, "2": 128})',
            additionalProperties: { type: 'number', minimum: 0, maximum: 255 }
          }
        },
        required: ['universe', 'channels']
      }
    },

    // ============ Cue List Control ============
    {
      name: 'qlc_cue_list_control',
      description: 'Control cue list playback (PLAY/NEXT/PREV)',
      inputSchema: {
        type: 'object',
        properties: {
          cueListId: { type: 'number', description: 'Cue List widget ID' },
          operation: {
            type: 'string',
            enum: ['PLAY', 'NEXT', 'PREV'],
            description: 'PLAY toggles play/stop, NEXT/PREV change cues'
          }
        },
        required: ['cueListId', 'operation']
      }
    },
    {
      name: 'qlc_cue_list_go_to_step',
      description: 'Jump to a specific cue step in a cue list',
      inputSchema: {
        type: 'object',
        properties: {
          cueListId: { type: 'number', description: 'Cue List widget ID' },
          stepIndex: { type: 'number', description: 'Cue step index (0-based)' }
        },
        required: ['cueListId', 'stepIndex']
      }
    },

    // ============ Frame Control ============
    {
      name: 'qlc_frame_control',
      description: 'Navigate multipage Frame widget pages',
      inputSchema: {
        type: 'object',
        properties: {
          frameId: { type: 'number', description: 'Frame widget ID' },
          operation: {
            type: 'string',
            enum: ['NEXT_PG', 'PREV_PG'],
            description: 'Page navigation operation'
          }
        },
        required: ['frameId', 'operation']
      }
    },

    // ============ Animation Widget Control ============
    {
      name: 'qlc_animation_control',
      description: 'Control Animation (RGB Matrix) widget preset buttons',
      inputSchema: {
        type: 'object',
        properties: {
          animationId: { type: 'number', description: 'Animation widget ID' },
          controlId: { type: 'number', description: 'Preset button control ID' }
        },
        required: ['animationId', 'controlId']
      }
    },

    // ============ Workspace Generation ============
    {
      name: 'qlc_generate_workspace',
      description: 'Generate a QLC+ workspace (.qxw) file with fixtures and scenes. Creates the XML structure and saves to disk.',
      inputSchema: {
        type: 'object',
        properties: {
          fixtures: {
            type: 'array',
            description: 'Array of fixture definitions',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Fixture name (e.g., "LED 1")' },
                manufacturer: { type: 'string', description: 'Manufacturer (e.g., "Generic")' },
                model: { type: 'string', description: 'Model name (e.g., "RGB LED")' },
                universe: { type: 'number', description: 'Universe (0-based)' },
                address: { type: 'number', description: 'DMX address (0-511)' },
                channels: { type: 'number', description: 'Number of channels fixture uses' }
              },
              required: ['name', 'manufacturer', 'model', 'universe', 'address', 'channels']
            }
          },
          scenes: {
            type: 'array',
            description: 'Array of scene definitions',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Scene name (e.g., "Red Scene")' },
                fixtureId: { type: 'number', description: 'Fixture ID (0-based index from fixtures array)' },
                channels: {
                  type: 'object',
                  description: 'Channel values as {channel: value} pairs',
                  additionalProperties: { type: 'number', minimum: 0, maximum: 255 }
                },
                fadeIn: { type: 'number', description: 'Fade in time (ms)', default: 0 },
                fadeOut: { type: 'number', description: 'Fade out time (ms)', default: 0 }
              },
              required: ['name', 'fixtureId', 'channels']
            }
          },
          outputPath: {
            type: 'string',
            description: 'Full path where .qxw file should be saved (e.g., "/tmp/show.qxw")'
          }
        },
        required: ['fixtures', 'scenes', 'outputPath']
      }
    },
    {
      name: 'qlc_reload_workspace',
      description: 'Upload and reload a workspace file into QLC+ via HTTP. This replaces the currently loaded workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          workspacePath: {
            type: 'string',
            description: 'Full path to the .qxw file to load'
          }
        },
        required: ['workspacePath']
      }
    },
    {
      name: 'qlc_create_effect_sequence',
      description: 'Generate and execute a timed lighting effect sequence by sending rapid DMX commands',
      inputSchema: {
        type: 'object',
        properties: {
          effectType: {
            type: 'string',
            enum: ['fade', 'strobe', 'chase', 'color_wash'],
            description: 'Type of effect: fade (0->255), strobe (rapid on/off), chase (sequential), color_wash (rainbow)'
          },
          universe: {
            type: 'number',
            description: 'Universe (0-based)'
          },
          channels: {
            type: 'array',
            items: { type: 'number' },
            description: 'DMX channels to affect (1-512). For color_wash, provide RGB triplets [1,2,3,4,5,6...]'
          },
          durationMs: {
            type: 'number',
            description: 'Effect duration in milliseconds'
          },
          fps: {
            type: 'number',
            default: 40,
            description: 'Frames per second (default 40, max 60)'
          }
        },
        required: ['effectType', 'universe', 'channels', 'durationMs']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  const { name, arguments: args } = req.params;

  try {
    switch (name) {
      case 'qlc_health_check': {
        const ok = await client.healthCheck();
        return {
          content: [{ type: 'text', text: ok ? '✅ QLC+ is accessible' : '❌ QLC+ not found or not responding' }]
        };
      }

      // ============ Functions API ============

      case 'qlc_get_functions_number': {
        const result = await client.getFunctionsNumber();
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `Total functions: ${result.data}`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_list_functions': {
        const result = await client.getFunctionsList();
        return {
          content: [{
            type: 'text',
            text: result.success
              ? JSON.stringify(result.data, null, 2)
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_get_function_type': {
        const { functionId } = args as any;
        const result = await client.getFunctionType(functionId);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `Function ${functionId} type: ${result.data}`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_get_function_status': {
        const { functionId } = args as any;
        const result = await client.getFunctionStatus(functionId);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `Function ${functionId} status: ${result.data}`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_start_function': {
        const { name: funcName } = args as any;
        const funcResult = await client.getFunctionByName(funcName);
        if (!funcResult.success || !funcResult.data) {
          return {
            content: [{ type: 'text', text: `❌ Function "${funcName}" not found` }],
            isError: true
          };
        }
        const result = await client.setFunctionStatus(funcResult.data.id, 1);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Started function "${funcName}" (ID: ${funcResult.data.id})`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_stop_function': {
        const { name: funcName } = args as any;
        const funcResult = await client.getFunctionByName(funcName);
        if (!funcResult.success || !funcResult.data) {
          return {
            content: [{ type: 'text', text: `❌ Function "${funcName}" not found` }],
            isError: true
          };
        }
        const result = await client.setFunctionStatus(funcResult.data.id, 0);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Stopped function "${funcName}" (ID: ${funcResult.data.id})`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_set_function_status': {
        const { functionId, status } = args as any;
        const result = await client.setFunctionStatus(functionId, status);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Set function ${functionId} to ${status === 1 ? 'running' : 'stopped'}`
              : `❌ ${result.error}`
          }]
        };
      }

      // ============ Widgets API ============

      case 'qlc_get_widgets_number': {
        const result = await client.getWidgetsNumber();
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `Total widgets: ${result.data}`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_list_widgets': {
        const result = await client.getWidgetsList();
        return {
          content: [{
            type: 'text',
            text: result.success
              ? JSON.stringify(result.data, null, 2)
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_get_widget_type': {
        const { widgetId } = args as any;
        const result = await client.getWidgetType(widgetId);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `Widget ${widgetId} type: ${result.data}`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_get_widget_status': {
        const { widgetId } = args as any;
        const result = await client.getWidgetStatus(widgetId);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? JSON.stringify(result.data, null, 2)
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_get_widget_sub_id_list': {
        const { widgetId } = args as any;
        const result = await client.getWidgetSubIdList(widgetId);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? JSON.stringify(result.data, null, 2)
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_set_widget_value': {
        const { widgetId, value } = args as any;
        const result = await client.setWidgetValue(widgetId, value);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Set widget ${widgetId} to ${value}`
              : `❌ ${result.error}`
          }]
        };
      }

      // ============ Channels API ============

      case 'qlc_get_channels_values': {
        const { universe, startAddress, count } = args as any;
        const result = await client.getChannelsValues(universe, startAddress, count);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? JSON.stringify(result.data, null, 2)
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_get_universe_snapshot': {
        const { universe } = args as any;
        const result = await client.getUniverseSnapshot(universe);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? JSON.stringify(result.data, null, 2)
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_set_channel': {
        const { universe, channel, value } = args as any;
        const result = await client.setChannelValue(universe, channel, value);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Set universe ${universe} channel ${channel} to ${value}`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_set_multiple_channels': {
        const { universe, channels } = args as any;
        const result = await client.setMultipleChannels(universe, channels);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Set ${result.data?.channelsSet} channels in universe ${universe}`
              : `❌ ${result.error}`
          }]
        };
      }

      // ============ Cue List Control ============

      case 'qlc_cue_list_control': {
        const { cueListId, operation } = args as any;
        const result = await client.cueListControl(cueListId, operation);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Cue list ${cueListId}: ${operation}`
              : `❌ ${result.error}`
          }]
        };
      }

      case 'qlc_cue_list_go_to_step': {
        const { cueListId, stepIndex } = args as any;
        const result = await client.cueListGoToStep(cueListId, stepIndex);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Cue list ${cueListId} jumped to step ${stepIndex}`
              : `❌ ${result.error}`
          }]
        };
      }

      // ============ Frame Control ============

      case 'qlc_frame_control': {
        const { frameId, operation } = args as any;
        const result = await client.frameControl(frameId, operation);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Frame ${frameId}: ${operation}`
              : `❌ ${result.error}`
          }]
        };
      }

      // ============ Animation Widget Control ============

      case 'qlc_animation_control': {
        const { animationId, controlId } = args as any;
        const result = await client.animationControl(animationId, controlId);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Animation ${animationId} control ${controlId} triggered`
              : `❌ ${result.error}`
          }]
        };
      }

      // ============ Workspace Generation ============

      case 'qlc_generate_workspace': {
        const { fixtures, scenes, outputPath } = args as any;

        try {
          const xml = client.generateWorkspace({ fixtures, scenes });
          const saveResult = client.saveWorkspace(xml, outputPath);

          if (saveResult.success) {
            return {
              content: [{
                type: 'text',
                text: `✅ Workspace generated successfully\n` +
                      `📁 Saved to: ${outputPath}\n` +
                      `🎨 Fixtures: ${fixtures.length}\n` +
                      `🎭 Scenes: ${scenes.length}\n\n` +
                      `Use qlc_reload_workspace to load it into QLC+`
              }]
            };
          } else {
            return {
              content: [{ type: 'text', text: `❌ ${saveResult.error}` }],
              isError: true
            };
          }
        } catch (error: any) {
          return {
            content: [{ type: 'text', text: `❌ Error generating workspace: ${error.message}` }],
            isError: true
          };
        }
      }

      case 'qlc_reload_workspace': {
        const { workspacePath } = args as any;

        const result = await client.reloadWorkspace(workspacePath);
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Workspace reloaded from ${workspacePath}\n` +
                `⚠️  Note: All running functions were stopped during reload`
              : `❌ ${result.error}`
          }],
          isError: !result.success
        };
      }

      case 'qlc_create_effect_sequence': {
        const { effectType, universe, channels, durationMs, fps = 40 } = args as any;

        const result = await client.createEffectSequence(
          effectType,
          universe,
          channels,
          durationMs,
          fps
        );

        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✅ Effect completed\n` +
                `🎬 Type: ${effectType}\n` +
                `⏱️  Duration: ${result.data?.durationMs}ms\n` +
                `🎞️  Frames: ${result.data?.framesRendered}`
              : `❌ ${result.error}`
          }],
          isError: !result.success
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `❌ Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `❌ Error: ${error.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('QLC+ MCP Server running on stdio transport');
  console.error(`Connecting to QLC+ at ${process.env.QLC_HOST || 'localhost'}:${process.env.QLC_PORT || '9999'}`);
}

main().catch(console.error);
