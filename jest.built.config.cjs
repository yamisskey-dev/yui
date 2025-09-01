module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(test).js?(x)'],
  rootDir: './built',
  // Map local parse.js imports to the compiled JS in built/
  moduleNameMapper: {
    '^\\.\\/parse\\.js$': '<rootDir>/modules/reminder/parse.js'
  },
  // No transforms needed for compiled JS
  transform: {}
};
