
import type { JestConfigWithTsJest } from 'ts-jest'

const conf: JestConfigWithTsJest = {
  testMatch: ['**/**.spec.ts'],
  preset: 'ts-jest/presets/default-esm',
  forceExit: true,
  detectLeaks: false,
  detectOpenHandles: true

}

export default conf
