// Inject `--experimental-vm-modules` into NODE_OPTIONS so that jest workers
// (which inherit env from this parent process) start with vm.Module enabled.
// jest.unstable_mockModule() relies on vm.Module to intercept ESM imports
// under the ts-jest/default-esm preset; the three ESM-mocked suites
// (qlc-client.test.ts, error-handling.test.ts, mcp-server.test.ts) all
// depend on this. Setting it here means `npx jest` works without callers
// having to export NODE_OPTIONS first; npm scripts in package.json also
// pass the explicit flag for clarity. Combined with `workerIdleMemoryLimit`
// below this works for both multi-file and single-file invocations.
if (!(process.env.NODE_OPTIONS || '').includes('--experimental-vm-modules')) {
  process.env.NODE_OPTIONS = ((process.env.NODE_OPTIONS || '') + ' --experimental-vm-modules').trim();
}

export default {
  preset: 'ts-jest/presets/default-esm',
  // Force jest to spawn worker processes even for single-file runs so the
  // injected NODE_OPTIONS (above) actually reaches the test code. Without
  // this, `npx jest <one-file>` runs in-band in the parent process which
  // was started before the flag was set, breaking ESM module mocks.
  // See @jest/core shouldRunInBand() — `workerIdleMemoryLimit` is the
  // documented escape hatch from the single-test-file in-band heuristic.
  workerIdleMemoryLimit: '512MB',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts' // Exclude main entry point from coverage
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext'
      }
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts']
};