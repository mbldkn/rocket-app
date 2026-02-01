module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@rocket-app/shared$': '<rootDir>/../../shared/index.ts',
    '^@rocket-app/shared/(.*)$': '<rootDir>/../../shared/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageThreshold: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
  silent: true,
};