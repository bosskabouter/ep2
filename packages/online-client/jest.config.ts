
import type { JestConfigWithTsJest } from 'ts-jest'

const conf: JestConfigWithTsJest = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom'
}

export default conf
