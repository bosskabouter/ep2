import EP2Key, {
  EP2Anonymized,
  EP2Cloaked,
  EP2Sealed,
  EP2Encrypted,
  EP2SecureChannel,
} from "../src";
import sodium from "libsodium-wrappers";
// A test object to encrypt and decrypt
const obj = {
  name: "Alice",
  age: 30,
  birthday: new Date().toJSON(),
  message: "Hello, World! ".repeat(300),
};
describe("EP2Key", () => {
  let key1: EP2Key;
  let key2: EP2Key;

  let anonymized: EP2Anonymized<typeof obj>;
  let sealed: EP2Sealed<typeof obj>;
  let cloaked: EP2Cloaked<typeof obj>;

  beforeEach(async () => {
    key1 = await EP2Key.create("some strong seed");
    key2 = await EP2Key.create();

    expect((anonymized = new EP2Anonymized(obj, key1, key2.id))).toBeDefined();
    expect((sealed = key1.seal(obj, key2.id))).toBeDefined();
    expect((cloaked = key1.cloak(obj, key2.id))).toBeDefined();
  });

  describe("SecureChannel", () => {
    let secureChannel: EP2SecureChannel;

    beforeAll(async () => {
      // Generate a shared secret key for testing
      //await sodium.ready;
      await EP2Key.create();
    });
    beforeEach(() => {
      // Create a new SecureChannel instance before each test
      secureChannel = key1.initSecureChannel(key2.id);
    });
    describe("encrypt()", () => {
      test("should encrypt an object and return a Uint8Array", () => {
        const encrypted = secureChannel.encrypt(obj);
        expect(typeof encrypted === "string").toBe(true);
      });
    });

    describe("decrypt()", () => {
      test("should decrypt an encrypted message and return the original object", () => {
        const encrypted = secureChannel.encrypt(obj);
        const decrypted = secureChannel.decrypt(encrypted);
        expect(decrypted).toEqual(obj);
      });

      test("should throw an error if the encrypted message has a different tag", () => {
        const obj = { foo: "bar" };
        const encrypted = secureChannel.encrypt(obj);
        // Change the tag to a different value

        expect(() => secureChannel.decrypt("blah" + encrypted)).toThrow(
          "incorrect secret key for the given ciphertext"
        );
      });
    });
  });

  test("should cloak/uncloak, seal/unseal, anonymize/reveal", () => {
    const unsealed = sealed.decrypt(key2);
    const uncloaked = cloaked.decrypt(key2);
    const verified = anonymized.decrypt(key2, key1.id);

    expect(uncloaked).toEqual(expect.objectContaining(obj));
    expect(uncloaked.sender).toEqual(key1.id);
    expect(unsealed).toEqual(obj);
    expect(verified).toEqual(obj);
  });

  describe("Anonymized", () => {
    it("Should Anonymize", () => {
      const encryptedMessage = key1.anonymize(obj, key2.id);
      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage).not.toContain(key1.id);
      expect(encryptedMessage).not.toContain(key1.keySet.boxKeyPair.publicKey);
      expect(encryptedMessage).not.toContain(key1.keySet.signKeyPair.publicKey);
      //just to be sure
      expect(encryptedMessage.toString()).not.toContain("private");
    });

    describe("Should reveal after decrypting", () => {
      it("Should encrypt with different nonce", () => {
        const anonymized2 = new EP2Anonymized(obj, key1, key2.id);
        expect(anonymized2).not.toEqual(anonymized);
        expect(anonymized2.espsk).not.toEqual(anonymized.espsk);
        expect(anonymized2.cipher).not.toEqual(anonymized.cipher);
      });

      it("Should Decrypt", () => {
        const decrypted = anonymized.decrypt(key2, key1.id);
        expect(decrypted).toBeDefined();
        expect(decrypted).toEqual(obj);
      });

      it("Should Not Decrypt > tampered key", () => {
        expect(() => anonymized.decrypt(key2, key2.id)).toThrow(
          "incorrect key pair for the given ciphertext"
        );
      });

      test("Anonymized message with tampered signature should throw error on decrypt", () => {
        const anonymized2 = new EP2Anonymized(obj, key1, key2.id);

        anonymized2.cipher.set(new Uint8Array([1, 2, 3]), 0);
        expect(() => anonymized2.decrypt(key2, key1.id)).toThrow(
          "Failed to verify message signature"
        );
      });

      describe("Serialization", () => {
        it("Should serialize", () => {
          expect(anonymized.toJSON()).toBeDefined();
        });
        it("Deserialize", () => {
          let deserialized: EP2Encrypted<typeof obj>;
          expect(
            (deserialized = EP2Anonymized.fromJSON(anonymized.toJSON()))
          ).toBeDefined();
          expect(deserialized).toEqual(anonymized);
        });
        it("Decrypt after deserialize", () => {
          const deserialized = EP2Anonymized.fromJSON(
            anonymized.toJSON()
          ) as EP2Anonymized<typeof obj>;
          let decrypted: typeof obj;

          expect(
            (decrypted = deserialized.decrypt(key2, key1.id))
          ).toBeDefined();
          expect(decrypted).toEqual(obj);
        });
      });
    });

    describe("Sealed", () => {
      describe("[SealedMessage] - unsealing", () => {
        let sealed: EP2Sealed<typeof obj>;
        beforeEach(() => {
          sealed = new EP2Sealed(obj, key2.id);
        });

        it("Should decrypt", () => {
          const unsealed = sealed.decrypt(key2);
          expect(unsealed).toEqual(obj);
        });

        it("Should create different sealed messages for same payload", () => {
          const sealed2 = new EP2Sealed(obj, key2.id);

          expect(sealed2).not.toEqual(sealed);
        });

        it("Should not contain private", () => {
          expect(sealed.toString()).not.toContain("private");
        });
      });
    });

    describe("Cloaked", () => {
      let cloaked2 = () =>
        new EP2Cloaked(
          obj,
          key1.keySet.boxKeyPair.publicKey,

          key2.keySet.boxKeyPair.publicKey
        );

      it("cloaks with equal content should differ", () => {
        expect(cloaked2()).not.toEqual(cloaked2());
      });

      it("cloaks with equal should differ encrypted public key", () => {
        expect(cloaked2().encryptedSenderPublicBoxKey).not.toEqual(
          cloaked2().encryptedSenderPublicBoxKey
        );
      });

      it("Should uncloak", () => {
        expect(() => cloaked2().decrypt(key2)).not.toThrow();
      });

      describe("[Uncloaked] Test case", () => {
        let uncloak = () => cloaked2().decrypt(key2);

        it("Should have same payload", () => {
          const uncloaked = uncloak();
          expect(uncloaked.sender).toEqual(key1.id);
        });
        it("Should identify sender after uncloak", () => {
          const uncloaked = uncloak();
          expect(uncloaked.sender).toEqual(key1.id);
        });
        it("Should deserialize and  uncloak", () => {
          let serialized = cloaked2().toJSON();
          expect(serialized).toBeDefined();
          let deserialized = EP2Cloaked.fromJSON(serialized) as EP2Cloaked<
            typeof obj
          >;
          expect(deserialized).toBeDefined();
          let uncloak: typeof obj;
          expect((uncloak = deserialized.decrypt(key2))).toBeDefined();
          expect(deserialized.sender).toEqual(key1.id);
          expect(uncloak).toBeDefined();
        });
      });
    });
  });

  it("should generate a new EP2Key instance", async () => {
    const keyPair = await EP2Key.create();

    expect(keyPair.seed).toBeInstanceOf(Uint8Array);
    expect(keyPair.keySet.signKeyPair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.keySet.signKeyPair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.keySet.boxKeyPair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.keySet.boxKeyPair.publicKey).toBeInstanceOf(Uint8Array);
  });

  it("should generate a new EP2Key instance with the given seed", async () => {
    const seed = sodium.randombytes_buf(sodium.crypto_sign_SEEDBYTES);
    const keyPair = await EP2Key.create(seed);

    expect(keyPair.seed).toBe(seed);
  });

  it("should serialize an EP2Key instance to a JSON string", async () => {
    const keyPair = await EP2Key.create();
    const json = keyPair.toJSON();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("seed");
    expect(parsed).toHaveProperty("signKeyPair");
    expect(parsed).toHaveProperty("boxKeyPair");

    expect(parsed.seed).toHaveLength(sodium.crypto_sign_SEEDBYTES);
    expect(parsed.signKeyPair.publicKey).toHaveLength(
      sodium.crypto_sign_PUBLICKEYBYTES
    );
    expect(parsed.signKeyPair.privateKey).toHaveLength(
      sodium.crypto_sign_SECRETKEYBYTES
    );
    expect(parsed.boxKeyPair.publicKey).toHaveLength(
      sodium.crypto_box_PUBLICKEYBYTES
    );
    expect(parsed.boxKeyPair.privateKey).toHaveLength(
      sodium.crypto_box_SECRETKEYBYTES
    );
  });

  it("should deserialize an EP2Key instance from a JSON string", async () => {
    const keyPair1 = await EP2Key.create();
    const json = keyPair1.toJSON();
    const keyPair2 = EP2Key.fromJson(json);

    expect(keyPair2.seed).toEqual(keyPair1.seed);
    expect(keyPair2.keySet.signKeyPair.publicKey).toEqual(
      keyPair1.keySet.signKeyPair.publicKey
    );
  });

  // it("Should Anonymize", () => {
  //   const anonymized = key1.anonymize(obj, key2.id);
  //   expect(anonymized).toBeDefined();
  //   const dec = anonymized.decrypt(key2, key1.id);
  //   expect(dec).toEqual(obj);
  // });

  // it("Should cloak", () => {
  //   const cloaked = key1.cloak(obj, key2.id);
  //   expect(cloaked).toBeDefined();
  //   const dec = cloaked.decrypt(key2);
  //   expect(dec).toEqual(expect.objectContaining(obj));
  //   expect(dec.sender).toEqual(key1.id);
  // });
  // it("Should Seal", () => {
  //   const sealed = key1.seal(obj, key2.id);
  //   expect(sealed).toBeDefined();
  //   const dec = sealed.decrypt(key2);
  //   expect(dec).toEqual(obj);
  // });

  test("should create equal keys from same seed string", async () => {
    const aSeed = "JuStAsEeD&!*^#^";
    const key = await EP2Key.create(aSeed);
    expect(key).toBeDefined();
    const peer2 = await EP2Key.create(aSeed);
    expect(peer2).toBeDefined();
    expect(key).toEqual(peer2);

    // generateRandomKey((key) => expect(key).toBeDefined());
  });

  test("should create different keys from different seed string", async () => {
    const aSeed = "JuStAsEeD&!*^#^";
    const key = await EP2Key.create(aSeed);
    expect(key).toBeDefined();
    const peer2 = await EP2Key.create(aSeed + aSeed);
    expect(peer2).toBeDefined();
    expect(key).not.toEqual(peer2);
  });

  test("Invalid peerId throws error", () => {
    expect(() => EP2Key.convertId2PublicKey("invalid key")).toThrow(
      "Invalid peerId: invalid key. Error: Error: incomplete input. Did you create a key first? !sodium.ready"
    );
  });
});
