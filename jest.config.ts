import type { JestConfigWithTsJest } from 'ts-jest'

const conf: JestConfigWithTsJest = {
  verbose: true,
  // testMatch: ['<rootDir>/**/*.spec.ts'],

  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/packages/*/src/**/*.ts'],
  
  detectOpenHandles: true,
  detectLeaks: false,
  forceExit: true,
  projects: [
    {
      preset: 'ts-jest/presets/default-esm',
      displayName: '@ep2/key',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/key/**/*.(spec|test).ts?(x)']
      // other configuration options specific to the package
    },

    {
      preset: 'ts-jest',
      displayName: '@ep2/online-client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/online-client/**/*.(spec|test).ts?(x)']

    //   // other configuration options specific to the package
    },

    {
      preset: 'ts-jest',
      displayName: '@ep2/online-server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/online-server/**/**.(spec|test).ts?(x)'],
      detectLeaks: false,
      detectOpenHandles: true

      // other configuration options specific to the package
    },

    {
      preset: 'ts-jest',
      displayName: '@ep2/key-bip',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/key-bip/**/*.(spec|test).ts?(x)']
      // other configuration options specific to the package
    },
    {
      preset: 'ts-jest',
      displayName: '@ep2/offline-server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/offline-server/**/*.(spec|test).ts?(x)'],
      // other configuration options specific to the package
      detectLeaks: false,
      detectOpenHandles: true
    },
    {
      preset: 'ts-jest',
      displayName: '@ep2/offline-client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/offline-client/**/*.(spec|test).ts?(x)']
      // other configuration options specific to the package
    }
  ]

}

export default conf
