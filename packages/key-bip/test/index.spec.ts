import { EP2KeyBIP } from "../src";

const VALID_MNEMONIC =
  "plastic seed stadium payment arrange inherit risk spend suspect alone debris very";
const INVALID_MNEMONIC =
  "111 222 333 444 555 ckm risk spend suspect alone debris very";

describe("BIP Key", () => {
  test("should have valid new key", async () => {
    const key = await EP2KeyBIP.create();
    testValidKey(key);
    expect(key).not.toEqual(EP2KeyBIP.create());
  });

  test("should restore", async () => {
    const k1 = await EP2KeyBIP.create(VALID_MNEMONIC);
    const k2 = await EP2KeyBIP.create(VALID_MNEMONIC);
    testValidKey(k1);
    expect(k1).toEqual(k2);
    expect(k1.id).toEqual(k2.id);
    expect(k1.masterKey).toEqual(k2.masterKey);
    expect(k1.keySet.signKeyPair).toEqual(k2.keySet.signKeyPair);
  });

  test("Entered wrong mnemonic", async () => {
    await expect(async () => {
      await EP2KeyBIP.create(INVALID_MNEMONIC);
    }).rejects.toThrow("Invalid mnemonic");
  });
});

function testValidKey(k: EP2KeyBIP | null): void {
  if (k == null) expect(k).toBeDefined();
  else {
    expect(k.mnemonic).toBeDefined();
    expect(k.mnemonic.split(" ").length).toBe(12);
    expect(k.id).toBeDefined();
    expect(k.keySet.signKeyPair).toBeDefined();
    expect(k.masterKey).toBeDefined();
  }
}
