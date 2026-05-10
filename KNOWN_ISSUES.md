# Known Issues

Current state as of the most recent push: **52 tests passing, 39 failing.** Build is green; the actual MCP server runs against real QLC+ instances. Failures are concentrated in test-double plumbing rather than runtime behavior, but they are real and tracked here.

## 1. WebSocket mock returns `success: false` for happy-path QLCClient methods

**Affected files:** `__tests__/unit/qlc-client.test.ts`, `__tests__/unit/error-handling.test.ts`

**Symptom:** Tests like `should get functions number`, `should get widgets list`, `should set function status`, etc. call into `QLCClient` with a mocked `ws` module, and the mock's response simulator returns control before the client's promise resolves with `success: true`. The client correctly times out or reports failure.

**Suspected cause:** Mismatch between what `MockWebSocket.setupDefaultResponses` emits and what `QLCClient`'s pipe-delimited response parser expects. Mock infra was migrated in this push (the `jest.mock('ws', ...)` factory was previously hoisting above the `MockWebSocket` import — fixed) but the response-shape contract between mock and parser hasn't been re-verified end-to-end.

**Fix sketch:** Step through one failing test in a debugger and capture the actual `data` event payload the mock emits vs. what `qlc-client.ts:parseResponse()` expects. Likely a small protocol-string mismatch.

## 2. MCP SDK mock paths don't intercept handler registration

**Affected file:** `__tests__/unit/mcp-server.test.ts`

**Symptom:** `mockServer.setRequestHandler` is never called. Tests like `should register list tools handler`, `should register call tool handler`, and all of `Tool Handler Execution / *` fail because the handlers are never captured into the `toolHandlers` map.

**Suspected cause:** The `src/index.ts` source uses `.js` extension imports (`import { Server } from '@modelcontextprotocol/sdk/server/index.js'`) — ESM-style path resolution. The `jest.mock('@modelcontextprotocol/sdk/server/index.js', ...)` factory may not match Jest's module-resolver-normalized path under the current `ts-jest` config, so the real SDK loads instead of the mock.

**Fix sketch:** Try mocking with the bare-specifier form (`'@modelcontextprotocol/sdk/server'`) or extending `moduleNameMapper` in `jest.config.js` to map the `.js` extension imports to their TypeScript sources. The `dynamic await import()` inside `beforeEach` may also need to be hoisted alongside the mocks.

## 3. Workspace XML attribute order mismatch

**Affected file:** `__tests__/unit/qlc-client.test.ts` — `Workspace Generation with Chasers / should assign sequential function IDs`

**Symptom:** The test does `xml.match(/Type="Scene"[^>]*ID="(\d+)"/g)` on generated workspace XML and gets `null`. The XML *does* contain scene definitions, but the attributes are emitted in `ID="0" Type="Scene"` order rather than `Type="Scene" ID="0"`.

**Suspected cause:** `fast-xml-parser`'s build step doesn't guarantee attribute ordering, and the test was written against a specific historical attribute order.

**Fix sketch:** Make the regex order-independent (`(?=.*Type="Scene")(?=.*ID="(\d+)")`) or parse the XML in the test instead of regex-matching. The latter is the right move long-term.

## Other observations

- **Test runtime is slow (~100s).** Several `error-handling` tests rely on real timeouts (`5000ms`); replacing with `jest.useFakeTimers()` would cut total run time substantially.
- **`audio-analyzer.ts` has two `@ts-ignore` directives** for `wav-decoder` and `music-tempo` which lack TypeScript definitions. Replace with `declare module` shims under `src/types/`.
- **Console.error log messages bleed into test output.** Wrapping the server bootstrap in `if (require.main === module)` would prevent the `main()` call from running when the file is `import()`-ed by the test suite.

PRs targeting any of these are welcome.
