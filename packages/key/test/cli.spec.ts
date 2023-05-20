import { EP2Key } from "../src";
const { spawnSync } = require("child_process");
const path = require("path");
describe("[CLI] Utility", () => {
  let originalArgv: string[];
  const workspaceDir = process.cwd();

  // Construct the path to the file you want to execute
  const filePath = path.join(workspaceDir, "packages/key/out/cjs/cli.js");

  beforeEach(() => {
    originalArgv = process.argv.slice();
  });

  afterAll(() => {
    process.argv = originalArgv;
    jest.resetAllMocks();
    jest.clearAllMocks();
  });
  test("should run client - generate", async () => {
    const result = spawnSync("node", [filePath, ""]);
    const output = result.stdout.toString();
    const error: string = result.stderr.toString();

    process.argv[2] = "";
    await import("../src/cli");

    expect(error.length).toBe(0);

    expect(output).toEqual(
      expect.stringContaining("id:") &&
        expect.stringContaining("seed") &&
        expect.stringContaining("signKeyPair") &&
        expect.stringContaining("boxKeyPair")
    );
    expect(async () => (await EP2Key.fromJson(output)).id).not.toThrow();
  }, 1000);

  test("should run client - validate", async () => {
    const jsonKey = (await EP2Key.create()).toJSON();

    const result = spawnSync("node", [filePath, "validate", jsonKey]);
    const output = result.stdout.toString();
    const error: string = result.stderr.toString();
    expect(error).toEqual("");
    expect(output).toContain("Key Valid");
  });

  test("should not run client - unknown command", async () => {
    const result = spawnSync("node", [filePath, "do something else"]);
    const error: string = result.stderr.toString();
    expect(error).toContain("Unknown command: do something else");
  });   

  test("should run client - validate - nok", async () => {

    const result = spawnSync("node", [filePath, "validate",JSON.stringify({ key: "invalid" })]);
    const error: string = result.stderr.toString();
    expect(error).toContain("JSON does not contain valid EP2Key");
  });
});
