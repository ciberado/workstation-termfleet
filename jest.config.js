/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/server/(.*)$': '<rootDir>/src/server/$1',
    '^@/client/(.*)$': '<rootDir>/src/client/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          esModuleInterop: true,
        },
      },
    ],
  },
  testMatch: [
    '**/src/**/__tests__/**/*.test.ts',
    '**/src/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '.test.ts',
  ],
  collectCoverageFrom: [
    'src/server/**/*.ts',
    '!src/server/index.ts',
   '!src/server/config.ts',
  ],
  setupFilesAfterEnv: [],
  testTimeout: 10000,
};
