# Known Issues

Current state: **91 tests passing across 4 suites, 0 skipped, 0 failing.** `npm test` exits clean.

The three buckets previously documented here (ESM mocking under `ts-jest`, MCP SDK mock interception, XML attribute-order regex) are all resolved — see commit history. This file now tracks remaining smaller issues.

## Resolved

- ~~`jest.mock` doesn't intercept ESM imports under `ts-jest/presets/default-esm`~~ — fixed by migrating to `jest.unstable_mockModule` + dynamic `await import()` and enabling Jest's ESM module graph via `NODE_OPTIONS=--experimental-vm-modules`.
- ~~`MockWebSocket` response shape didn't match `qlc-client`'s pipe-delimited parser, and `simulateMessage()` only fired the browser-style `onmessage` property rather than the `EventEmitter 'message'` event~~ — fixed by protocol-aware `synthesizeQLCResponse()` and `emit('message', …)` in the mock.
- ~~XML attribute-order regex in the workspace generation test~~ — fixed by parsing with `fast-xml-parser` and asserting on the parsed structure.

## Open

- **`audio-analyzer.ts` has two `@ts-ignore` directives** for `wav-decoder` and `music-tempo` which lack TypeScript definitions. Replace with `declare module` shims under `src/types/`.
- **Worker process force-exit warning** at the end of `npm test` — harmless leaked timers in the WebSocket mock's setTimeout-driven message simulation. Cleanable with `clearTimeout` / `unref`.
- **`error-handling.test.ts` runtime is dominated by two real 5s timeout tests** because `qlc-client.ts`'s `connect()` timeout is hard-coded. Could be shaved by making the timeout injectable.

PRs targeting any of these are welcome.
