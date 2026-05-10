# QLC+ MCP Server

> Control [QLC+](https://www.qlcplus.org/) professional lighting software with natural language, via [Claude Desktop](https://claude.ai/download) or any MCP-compatible client.

This is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes 25 tools for QLC+: scene control, DMX channel writes, widget manipulation, workspace generation, frame-accurate effect sequencing. The repo also includes a standalone Gemini-powered CLI agent (`src/agent/`) that drives QLC+ in a REPL — useful for testing the tool surface without Claude Desktop.

```
You: turn channel 1 to full and run the strobe scene for 5 seconds
🛠️  Calling tool: qlc_set_channel
🛠️  Calling tool: qlc_create_effect_sequence
🤖 Channel 1 is at 255. Strobe is running on channels 2–10.
```

## Status

This is an active personal project, not a finished product. Built October 2025 as a way to drive a real DMX rig with Claude.

- **Build:** ✅ TypeScript compiles cleanly (`npm run build`)
- **Tests:** ✅ green — 16 passing, 75 explicitly skipped. The skipped suites are blocked on a structural test-double problem (`jest.mock` doesn't intercept ESM imports under `ts-jest`), not on broken runtime code. The skips are documented inline at each `describe.skip` and inventoried in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md). The MCP server runs against real QLC+ instances; the skipped tests are infrastructure, not behavior. PRs welcome.
- **Coverage:** scenes, functions, widgets, channels (single + bulk), cue lists, frame nav, animation control, workspace XML generation with chasers, effect sequencing.

## Features

- **25 MCP tools** — full surface of QLC+'s WebSocket + high-rate APIs
- **Workspace generation** — programmatically build `.qxw` files (fixtures, scenes, chasers) with `fast-xml-parser`
- **Effect sequencing** — frame-by-frame DMX rendering at configurable FPS (default 40, max 60)
- **Chaser support** — multi-step chases with run orders (Loop/SingleShot/PingPong), directions, configurable hold/fade timing
- **Standalone Gemini agent** (`src/agent/`) — REPL that connects to the MCP server via stdio and lets you drive QLC+ in plain English
- **Audio-reactive prototype** (`src/audio-analyzer.ts`) — extracts BPM and beats from audio files via `wav-decoder` + `music-tempo` for tempo-synced effects (work in progress)

## Quick start

Prereqs: Node.js 20+, [QLC+](https://www.qlcplus.org/) 4.12+, Claude Desktop *or* a Gemini API key for the standalone agent.

```bash
git clone https://github.com/guac395/qlc-plus-mcp.git
cd qlc-plus-mcp
npm install
npm run build
```

Launch QLC+ with the web interface enabled:

```bash
# macOS
/Applications/QLC+.app/Contents/MacOS/qlcplus -w
# Linux
qlcplus -w
# Windows
qlcplus.exe -w
```

### Use as an MCP server (Claude Desktop)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "qlc-plus": {
      "command": "node",
      "args": ["/absolute/path/to/qlc-plus-mcp/dist/index.js"],
      "env": { "QLC_HOST": "localhost", "QLC_PORT": "9999" }
    }
  }
}
```

Restart Claude Desktop. The 25 tools become available.

### Use as a standalone CLI agent (Gemini)

```bash
cp .env.example .env
# Add your GEMINI_API_KEY (https://aistudio.google.com/app/apikey)
npx tsx src/agent/index.ts
```

## Repo layout

```
src/
├── index.ts            MCP server + tool handlers
├── qlc-client.ts       QLC+ WebSocket / HTTP client
├── types.ts            Shared interfaces
├── audio-analyzer.ts   BPM/beat extraction (WIP)
└── agent/
    ├── client.ts       MCP stdio client
    └── index.ts        Gemini-powered REPL
__tests__/              Jest unit tests + mocks
docs/
├── README.md           Long-form documentation (tools list, technical details, troubleshooting)
└── TESTINGDOCS.md      Test architecture notes
```

For the long-form documentation — full tool reference, DMX addressing, chaser schema, effect-sequencing internals, troubleshooting — see [`docs/README.md`](./docs/README.md).

## Development

```bash
npm run build           # tsc → dist/
npm test                # jest (see KNOWN_ISSUES.md for failures)
npm run test:watch
npm run test:coverage
```

## License

MIT — see [LICENSE](./LICENSE).

## Related

- [QLC+](https://www.qlcplus.org/) — the lighting software being controlled
- [QLC+ Web API docs](https://docs.qlcplus.org/v4/advanced/web-interface)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
