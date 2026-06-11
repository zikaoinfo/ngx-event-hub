/** Jest + jest-preset-angular configuration for the zen-grid library. */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/projects/zen-grid'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^zen-grid$': '<rootDir>/projects/zen-grid/src/public-api.ts',
  },
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/projects/zen-grid/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  collectCoverageFrom: ['projects/zen-grid/src/lib/**/*.ts', '!**/*.spec.ts'],
};
