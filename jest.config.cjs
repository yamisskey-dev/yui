/** Jest config for TypeScript (ESM, ts-jest recommended settings) */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: ['<rootDir>/built/'],
  // Treat TypeScript files as ESM
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: 'tsconfig.json'
    }
  },
  // No moduleNameMapper for local .ts imports; rely on ts-jest resolver
  // moduleNameMapper: { ... }
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true }]
  },
  // Ensure node_modules are ignored by default transformers
  transformIgnorePatterns: ['/node_modules/']
};
