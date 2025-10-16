# Testing Documentation

## Test Overview

This project includes comprehensive unit tests covering all major components of the QLC+ MCP server. Tests are written using Jest and include mocks for WebSocket, HTTP fetch, and OSC communication.

## Test Structure

```
__tests__/
├── unit/
│   ├── types.test.ts           # Type definition tests
│   ├── qlc-client.test.ts      # QLC+ client API tests
│   ├── mcp-server.test.ts      # MCP server integration tests
│   └── error-handling.test.ts  # Error scenarios and edge cases
├── mocks/
│   ├── websocket.mock.ts       # WebSocket mock implementation
│   ├── fetch.mock.ts           # HTTP fetch mock
│   └── osc.mock.ts             # OSC mock
└── setup.ts                    # Global test configuration
```

## Test Coverage by File

### 1. Type Definitions Tests ([types.test.ts](/__tests__/unit/types.test.ts))

Tests the TypeScript type definitions for structure and compatibility.

#### What's Tested:

**QLCWidget Type**
- Widget structure validation (id, name, type properties)
- Type checking for widget properties
- Different widget types: Button, Slider, SpeedDial

**QLCFunction Type**
- Function structure validation (id, name, type properties)
- Different function types: Scene, Chaser, Sequence, EFX

**QLCConfig Type**
- Minimal configuration (host, port)
- Configuration with optional API key
- Different host formats (localhost, IP, domain)
- Different port numbers

**QLCResponse Type**
- Successful responses without data
- Successful responses with typed data
- Error responses with error messages
- Generic data types (string, number, object, array)
- Complex nested response structures

**Type Compatibility**
- Generic response type helpers
- Optional property handling
- Array type handling
- Type inference and safety

---

### 2. QLC+ Client Tests ([qlc-client.test.ts](/__tests__/unit/qlc-client.test.ts))

Tests the core QLC+ client functionality and API communication.

#### What's Tested:

**Constructor and Configuration**
- Client instantiation with valid config
- Custom host and port acceptance

**Health Check**
- Connection verification when QLC+ is accessible
- Failure detection when QLC+ is unreachable

**Functions API (Standard WebSocket)**
- `getFunctionsNumber()` - Returns total function count
- `getFunctionsList()` - Returns array of all functions
- `getFunctionType(id)` - Returns function type string
- `getFunctionStatus(id)` - Returns running status
- `setFunctionStatus(id, value)` - Start/stop functions
- `getFunctionByName(name)` - Find function by name

**Widgets API (Standard WebSocket)**
- `getWidgetsNumber()` - Returns total widget count
- `getWidgetsList()` - Returns array of all widgets
- `getWidgetType(id)` - Returns widget type string
- `getWidgetStatus(id)` - Returns widget status object
- `getWidgetSubIdList(id)` - Returns sub-widget array
- `getWidgetByName(name)` - Find widget by name

**Channels API (Standard WebSocket)**
- `getChannelsValues(universe, start, count)` - Get DMX channel range
- `getUniverseSnapshot(universe)` - Get all 512 channels

**High-Rate APIs (No QLC+API prefix)**
- `setChannelValue(universe, channel, value)` - Direct DMX control
  - Valid value acceptance (0-255)
  - Invalid value rejection (< 0, > 255)
- `setMultipleChannels(universe, channels)` - Bulk channel updates
  - Multiple channel setting
  - Invalid value rejection in batch operations
- `setWidgetValue(widgetId, value)` - Direct widget control
  - Valid value acceptance (0-255)
  - Invalid value rejection (< 0, > 255)

**Cue List Control**
- `cueListControl(id, operation)` - PLAY, NEXT, PREV operations
- `cueListGoToStep(id, step)` - Jump to specific cue

**Frame Control**
- `frameControl(id, operation)` - NEXT_PG, PREV_PG navigation

**Animation Widget Control**
- `animationControl(widgetId, controlId)` - Animation preset triggering

**Workspace Generation**
- `generateWorkspace(config)` - XML generation
  - XML format validation
  - Fixture inclusion
  - Scene inclusion
- `saveWorkspace(xml, path)` - File saving

**Effect Sequencing**
- `createEffectSequence(type, universe, channels, duration, fps)`
  - Fade effect rendering
  - Strobe effect rendering
  - Chase effect rendering
  - Color wash effect rendering
  - Frame count tracking
  - Effect type metadata

**Error Handling**
- Empty response handling
- HTML response filtering (from QLC+ web interface)
- OK response parsing
- Pipe-delimited response parsing (`QLC+API|command|data`)

---

### 3. MCP Server Tests ([mcp-server.test.ts](/__tests__/unit/mcp-server.test.ts))

Tests the Model Context Protocol server integration and tool exposure.

#### What's Tested:

**Tool Registration**
- List tools handler registration
- Call tool handler registration
- Comprehensive tools list (20+ tools)

**Tool Schemas**
- All tools have descriptions
- Input schemas with proper types
- Required parameter validation
- Example tools checked:
  - `qlc_health_check` - Empty schema
  - `qlc_set_channel` - universe, channel, value parameters

**Basic Tool Handlers**
- `qlc_health_check`
  - Success response (✅)
  - Failure response (❌)
- `qlc_list_functions` - JSON array response
- `qlc_set_channel` - Universe and channel in response
- `qlc_start_function` - Success confirmation
- `qlc_stop_function` - Success confirmation

**Advanced Tool Handlers**
- `qlc_cue_list_control` - NEXT/PREV/PLAY operations
- `qlc_cue_list_go_to_step` - Step navigation
- `qlc_generate_workspace` - Workspace generation confirmation
- `qlc_create_effect_sequence` - Effect completion message

**Widget Operations**
- `qlc_get_widgets_number` - Widget count display
- `qlc_set_widget_value` - Value setting confirmation

**Unknown Tool Handling**
- Error response for unknown tools
- `isError` flag set to true

**Server Initialization**
- Server created with correct name and version
- Capabilities configuration (tools)
- Transport connection

---

### 4. Error Handling Tests ([error-handling.test.ts](/__tests__/unit/error-handling.test.ts))

Tests error scenarios, edge cases, and resilience.

#### What's Tested:

**Network Connection Errors**
- WebSocket connection timeout
  - No open event simulation
  - Timeout error response
- HTTP health check network failures
  - Network error simulation
  - False return value
- WebSocket unexpected disconnection
  - Mid-transmission disconnection
  - Close event handling
  - High-rate API non-blocking behavior

**Protocol and Response Errors**
- Empty responses
  - Graceful handling
  - Empty array return for lists
- HTML responses from QLC+
  - Web interface HTML filtering
  - Data extraction from noise
- OK responses
  - Success interpretation
- Pipe-delimited responses
  - `QLC+API|command|data` parsing
  - Data extraction from parts

**Input Validation Errors**
- Channel value validation
  - Negative values rejected
  - Values > 255 rejected
  - Error message includes "0-255"
- Widget value validation
  - Same range validation as channels
- Multiple channel validation
  - Invalid value detection in batch
  - Error message includes "Invalid value"

**Response Timeout Handling**
- Slow response timeout (5000ms)
- Timeout error message includes "timeout"
- No response scenario handling

---

## Test Utilities and Mocks

### WebSocket Mock ([websocket.mock.ts](/__tests__/mocks/websocket.mock.ts))
- Simulates WebSocket connection
- Event emission (open, message, close, error)
- Message simulation helpers
- Connection state management

### Fetch Mock ([fetch.mock.ts](/__tests__/mocks/fetch.mock.ts))
- HTTP request mocking
- Response configuration
- Network error simulation
- Mock reset functionality

### OSC Mock ([osc.mock.ts](/__tests__/mocks/osc.mock.ts))
- OSC protocol mocking (for future use)

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose

# Run tests in CI environment
npm run test:ci
```

---

## Test Philosophy

The test suite follows these principles:

1. **Unit Isolation**: Each component is tested independently with mocked dependencies
2. **Comprehensive Coverage**: All public APIs and error paths are tested
3. **Type Safety**: TypeScript types are validated for correctness
4. **Protocol Compliance**: QLC+ WebSocket protocol responses are tested
5. **Error Resilience**: Edge cases and failure modes are explicitly tested
6. **MCP Integration**: Tool registration and execution are validated

---

## What's NOT Tested

The following are not covered by unit tests:

- **Integration with actual QLC+ server** (would require running QLC+ instance)
- **Real WebSocket communication** (mocked in tests)
- **File system operations** (mocked via fs/promises)
- **End-to-end tool execution** through Claude Desktop
- **Performance benchmarks** for effect sequencing
- **Real-time DMX output** to hardware

For these scenarios, manual testing with actual QLC+ hardware/software is required.

---

## Coverage Goals

The test suite aims for:
- **Line coverage**: > 80%
- **Branch coverage**: > 75%
- **Function coverage**: > 90%
- **Statement coverage**: > 80%

Run `npm run test:coverage` to generate a detailed coverage report.
