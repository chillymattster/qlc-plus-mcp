# QLC+ MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that enables Claude Desktop to control [QLC+](https://www.qlcplus.org/) lighting control software programmatically. This allows AI-assisted lighting design and control through natural language.

## Features

- 🎭 **WebSocket & HTTP Communication** - Real-time control of QLC+ via its web API
- 🎨 **25 MCP Tools** - Comprehensive lighting control exposed to Claude Desktop
- 🔄 **Effect Sequencing** - Client-side rendering of fade, strobe, chase, and color wash effects
- 📦 **Workspace Generation** - Create QLC+ workspace files (.qxw) programmatically
- ✅ **Full Test Coverage** - Jest-based unit tests with mocks for reliable testing

## Installation

### Prerequisites

- **Node.js** v20 or higher
- **QLC+** 4.12.0 or higher installed
- **Claude Desktop** with MCP support

### Setup

1. Clone or download this repository:
```bash
cd /path/to/qlc-plus-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Configure Claude Desktop to use this MCP server by adding to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "qlc-plus": {
      "command": "node",
      "args": ["/path/to/qlc-plus-mcp/dist/index.js"],
      "env": {
        "QLC_HOST": "localhost",
        "QLC_PORT": "9999"
      }
    }
  }
}
```

5. Launch QLC+ with web interface enabled:
```bash
# macOS
/Applications/QLC+.app/Contents/MacOS/qlcplus -w

# Linux
qlcplus -w

# Windows
qlcplus.exe -w
```

## Available Tools

The following 25 tools are available to Claude Desktop:

### Connection & Health
- `qlc_health_check` - Check if QLC+ is accessible

### Functions API
- `qlc_get_functions_number` - Get total number of functions
- `qlc_list_functions` - List all functions with IDs and names
- `qlc_get_function_type` - Get function type (Scene, Chaser, EFX, etc.)
- `qlc_get_function_status` - Get running status (Running, Stopped, Undefined)
- `qlc_start_function` - Start a function by name
- `qlc_stop_function` - Stop a function by name
- `qlc_set_function_status` - Set function status by ID (0=stop, 1=start)

### Widgets API (Virtual Console)
- `qlc_get_widgets_number` - Get total number of widgets
- `qlc_list_widgets` - List all widgets with IDs and names
- `qlc_get_widget_type` - Get widget type (Button, Slider, CueList, etc.)
- `qlc_get_widget_status` - Get current widget status
- `qlc_get_widget_sub_id_list` - Get sub-widgets (presets)
- `qlc_set_widget_value` - Set widget value (0-255)

### DMX Channel Control
- `qlc_get_channels_values` - Get DMX channel values for a range
- `qlc_get_universe_snapshot` - Get all 512 channels for a universe
- `qlc_set_channel` - Set single DMX channel value
- `qlc_set_multiple_channels` - Set multiple channels at once

### Cue List Control
- `qlc_cue_list_control` - Control cue list (PLAY/NEXT/PREV)
- `qlc_cue_list_go_to_step` - Jump to specific cue step

### Frame & Animation Control
- `qlc_frame_control` - Navigate multipage frames (NEXT_PG/PREV_PG)
- `qlc_animation_control` - Control Animation/RGB Matrix widgets

### Workspace & Effects
- `qlc_generate_workspace` - Generate QLC+ workspace file (.qxw) with fixtures and scenes
- `qlc_reload_workspace` - Upload and reload workspace file into QLC+
- `qlc_create_effect_sequence` - Generate timed lighting effects (fade, strobe, chase, color_wash)

## API Coverage

### Officially Supported by QLC+ WebSocket API

The following commands use QLC+'s official WebSocket API (`QLC+API|command|params`):

- **Functions**: `getFunctionsNumber`, `getFunctionsList`, `getFunctionType`, `getFunctionStatus`, `setFunctionStatus`
- **Widgets**: `getWidgetsNumber`, `getWidgetsList`, `getWidgetType`, `getWidgetStatus`, `getWidgetSubIdList`
- **Channels**: `getChannelsValues` (with universe, start address, and count)

### High-Rate API (No Prefix)

These commands use QLC+'s high-rate API for real-time control:

- **Channel Set**: `CH|{absoluteAddress}|{value}` - Direct DMX channel control
- **Widget Value**: `{widgetId}|{value}` - Widget value updates
- **Cue List**: `{cueListId}|PLAY|NEXT|PREV|STEP` - Cue list navigation
- **Frame**: `{frameId}|NEXT_PG|PREV_PG` - Page navigation
- **Animation**: `{animationId}|MATRIX_PUSHBUTTON|{controlId}` - Animation presets

### Client-Side Features

These features are implemented client-side by this MCP server:

- **Workspace Generation** - XML generation using fast-xml-parser
- **Workspace Reload** - HTTP multipart/form-data upload to `/loadProject`
- **Effect Sequencing** - Frame-by-frame DMX value calculation and transmission

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run verbose tests
npm run test:verbose
```

### Project Structure

```
qlc-plus-mcp/
├── src/
│   ├── index.ts          # MCP server and tool handlers (770 lines)
│   ├── qlc-client.ts     # QLC+ WebSocket/HTTP client (634 lines)
│   └── types.ts          # TypeScript interfaces (45 lines)
├── __tests__/
│   ├── unit/             # Unit tests for all components
│   │   ├── types.test.ts
│   │   ├── qlc-client.test.ts
│   │   ├── mcp-server.test.ts
│   │   └── error-handling.test.ts
│   ├── mocks/            # Mock implementations
│   │   ├── websocket.mock.ts
│   │   ├── fetch.mock.ts
│   │   └── osc.mock.ts
│   └── setup.ts          # Global test configuration
├── dist/                 # Compiled JavaScript (gitignored)
├── package.json
├── tsconfig.json
└── jest.config.js
```

### Building

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Usage Examples

Once configured in Claude Desktop, you can use natural language to control QLC+:

**"Show me all available functions in QLC+"**
- Claude will call `qlc_list_functions`

**"Start the 'Main Scene' function"**
- Claude will call `qlc_start_function` with name="Main Scene"

**"Set DMX channel 1 in universe 0 to full brightness"**
- Claude will call `qlc_set_channel` with universe=0, channel=1, value=255

**"Create a strobe effect on channels 1-10 in universe 0 for 5 seconds"**
- Claude will call `qlc_create_effect_sequence` with effectType="strobe", channels=[1-10], durationMs=5000

**"Generate a workspace with 4 RGB LED fixtures and create red, green, blue scenes"**
- Claude will call `qlc_generate_workspace` with appropriate fixture and scene definitions

## Technical Details

### DMX Addressing

QLC+ uses absolute DMX addressing for the `CH|` command:
- Universe 0: addresses 1-512
- Universe 1: addresses 513-1024
- Universe 2: addresses 1025-1536
- etc.

The `setChannelValue()` method handles this conversion automatically.

### WebSocket Connection

The client maintains a persistent WebSocket connection to `ws://{host}:{port}/qlcplusWS` with:
- Automatic reconnection
- 5-second timeout on operations
- Response parsing for QLC+ pipe-delimited format

### Effect Sequencing

The `createEffectSequence()` method:
1. Calculates frame-by-frame DMX values
2. Sends high-rate `CH|` commands at specified FPS (default 40fps, max 60fps)
3. Uses precise timing with `setTimeout` for frame pacing
4. Returns total frames rendered and actual duration

## Limitations

- **No fixture creation** - QLC+ WebSocket API doesn't support programmatic fixture creation
- **No scene editing** - Scenes must be created in QLC+ UI or via workspace files
- **No real-time monitoring streams** - Must poll for status updates
- **No master intensity/blackout** - Not exposed via WebSocket API
- **Workspace reload stops all functions** - This is a QLC+ limitation

## Troubleshooting

### "QLC+ not found or not responding"

1. Ensure QLC+ is running with `-w` flag
2. Check that port 9999 is not blocked by firewall
3. Verify `QLC_HOST` and `QLC_PORT` environment variables

### "Function not found"

- Function names are case-sensitive
- Use `qlc_list_functions` to see exact names

### "Channel value must be 0-255"

- DMX values must be in valid range
- Check universe and channel numbers are correct

## License

This project is provided as-is for use with QLC+ and Claude Desktop.

## Related Links

- [QLC+ Official Website](https://www.qlcplus.org/)
- [QLC+ Web API Documentation](https://docs.qlcplus.org/v4/advanced/web-interface)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
