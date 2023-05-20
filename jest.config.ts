import type { JestConfigWithTsJest } from "ts-jest";

const conf: JestConfigWithTsJest = {
  verbose: true,
  // testMatch: ['<rootDir>/**/*.spec.ts'],

  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/packages/*/src/**/*.ts"],

  detectOpenHandles: true,
  detectLeaks: false,
  forceExit: true,
  projects: [
    {
//      preset: "ts-jest/presets/default-esm",
      preset: "ts-jest",

      displayName: "@ep2/key",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/key/**/*.(spec|test).ts?(x)"],
      // other configuration options specific to the package
    },
    {
      preset: "ts-jest",
      displayName: "@ep2/key-bip",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/key-bip/**/*.(spec|test).ts?(x)"],
      // other configuration options specific to the package
    },

    {
      preset: "ts-jest",
      displayName: "@ep2/peer",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/packages/peer/**/*.(spec|test).ts?(x)"],

      //   // other configuration options specific to the package
    },

    {
      preset: "ts-jest",
      displayName: "@ep2/peerserver",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/peerserver/**/**.(spec|test).ts?(x)"],
      detectLeaks: false,
      detectOpenHandles: true,

      // other configuration options specific to the package
    },
    {
      preset: "ts-jest",
      displayName: "@ep2/push",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/packages/push/**/*.(spec|test).ts?(x)"],
      // other configuration options specific to the package
    },

    {
      preset: "ts-jest",
      displayName: "@ep2/pushserver",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/pushserver/**/*.(spec|test).ts?(x)"],
      // other configuration options specific to the package
      detectLeaks: false,
      detectOpenHandles: true,
    },
  ],
};

export default conf;
