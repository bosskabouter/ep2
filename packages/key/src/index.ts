import sodium from "libsodium-wrappers";

/**
 * The core of the actual key holds the signKeyPair and boxKeyPair for a given key set.
 */
interface EP2KeySet {
  signKeyPair: sodium.KeyPair;
  boxKeyPair: sodium.KeyPair;
}

/**
 * `EP2Key`: a class representing the cryptographic keypair used by a peer during the protocol. It contains the peer's public and private keys for both signing and encryption, and it defines the `Peer ID` based on base64 encoded public encryption key. It can initiate a handshake with another peer, and receive a handshake from another peer to establish a common shared secret to be used with the `SecureChannel`.
 */
export class EP2Key {
  /**
   * Creates an EP2Key instance with a seed value used for keypair generation.
   * If no seed is provided, a random seed will be generated.
   *
   * @param {Uint8Array | string} seed - The seed value for keypair generation.
   * @returns {Promise<EP2Key>} The EP2Key instance with generated key pairs.
   */
  public static async create(seed?: Uint8Array | string): Promise<EP2Key> {
    await sodium.ready;

    // Generate a seed if none was provided
    if (seed == null) {
      seed = sodium.randombytes_buf(sodium.crypto_sign_SEEDBYTES);
    } else if (typeof seed === "string") {
      // Convert a string seed to a Uint8Array
      seed = sodium.crypto_generichash(sodium.crypto_sign_SEEDBYTES, seed);
    }

    const signKeyPair = sodium.crypto_sign_seed_keypair(seed);
    const boxKeyPair = sodium.crypto_box_seed_keypair(seed);

    return new this(seed, { signKeyPair, boxKeyPair });
  }

  id: string;
  protected constructor(readonly seed: Uint8Array, readonly keySet: EP2KeySet) {
    this.id = EP2Key.convertPublicKey2Id(keySet.boxKeyPair.publicKey);
  }

  static convertPublicKey2Id(publicBoxKey: Uint8Array): string {
    return sodium.to_hex(publicBoxKey);
  }
  static convertId2PublicKey(id: string): Uint8Array {
    try {
      return sodium.from_hex(id);
    } catch (error) {
      throw new Error(
        `Invalid peerId: ${id}. Error: ${
          error as string
        }. Did you create a key first? !sodium.ready`
      );
    }
  }

  static async fromJson(json: string): Promise<EP2Key> {
    await sodium.ready;
    const parsed = JSON.parse(json);

    const seed = Uint8Array.from(parsed.seed);
    const signPublicKey = Uint8Array.from(parsed.signKeyPair.publicKey);
    const signPrivateKey = Uint8Array.from(parsed.signKeyPair.privateKey);
    const boxPublicKey = Uint8Array.from(parsed.boxKeyPair.publicKey);
    const boxPrivateKey = Uint8Array.from(parsed.boxKeyPair.privateKey);

    const keySet: EP2KeySet = {
      signKeyPair: {
        privateKey: signPrivateKey,
        publicKey: signPublicKey,
        keyType: parsed.signKeyPair.keyType,
      },
      boxKeyPair: {
        privateKey: boxPrivateKey,
        publicKey: boxPublicKey,
        keyType: parsed.boxKeyPair.keyType,
      },
    };

    return new EP2Key(seed, keySet);
  }

  /**
   * Serialization to post to service worker required specific toJSON for Uint8Arrays.
   * @returns a JSON string with Array.from(Uint8Array)
   */
  toJSON(): string {
    const signPublicKey = Array.from(this.keySet.signKeyPair.publicKey);
    const signPrivateKey = Array.from(this.keySet.signKeyPair.privateKey);
    const boxPublicKey = Array.from(this.keySet.boxKeyPair.publicKey);
    const boxPrivateKey = Array.from(this.keySet.boxKeyPair.privateKey);
    const seedCopy = Array.from(this.seed);
    const ep2key = {
      id: this.id,
      seed: seedCopy,
      signKeyPair: {
        publicKey: signPublicKey,
        privateKey: signPrivateKey,
        keyType: this.keySet.signKeyPair.keyType,
      },
      boxKeyPair: {
        publicKey: boxPublicKey,
        privateKey: boxPrivateKey,
        keyType: this.keySet.boxKeyPair.keyType,
      },
    };
    return JSON.stringify(ep2key);
  }

  /* CONVENIENT DELEGATE METHODS TO HELPERS */

  /**
   *
   * @param receiverId
   * @returns
   */
  initSecureChannel(receiverId: string) {
    return new EP2SecureChannel(this, receiverId);
  }

  /**client.getToken()
   *
   * @param object
   * @param receiverId
   * @returns
   */
  cloak<T>(object: T, receiverId: string): EP2Cloaked<T> {
    return new EP2Cloaked(
      object,
      this.keySet.boxKeyPair.publicKey,
      EP2Key.convertId2PublicKey(receiverId)
    );
  }

  /**
   *
   * @param obj
   * @param receiverId
   * @returns
   */
  seal<T>(obj: T, receiverId: string): EP2Sealed<T> {
    return new EP2Sealed(obj, receiverId);
  }

  /**
   *
   * @param object
   * @param receiverId
   * @returns
   */
  anonymize<T>(object: T, receiverId: string): EP2Anonymized<T> {
    return new EP2Anonymized(object, this, receiverId);
  }
}
/**

The EP2SecureChannel class provides an encrypted channel for communication between two parties using public key cryptography. The class encrypts and decrypts messages using a shared secret key derived from the public box keys of both sides of the channel. 
 */
export class EP2SecureChannel {
  private readonly sharedKey: Uint8Array;
  /**
   * The shared secret key derived from the public box keys of both sides of the channel.
   * @param sharedKey
   */
  constructor(key: EP2Key, receiverId: string) {
    this.sharedKey = sodium.crypto_box_beforenm(
      EP2Key.convertId2PublicKey(receiverId),
      key.keySet.boxKeyPair.privateKey
    );
  }

  /**
   * Encrypts given object using the `sharedKey` of this `SecureChannel`.
   * @param obj the object to encrypt
   * @returns the encrypted object
   */
  encrypt<T>(obj: T): string {
    const message = JSON.stringify(obj);
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

    const ciphertext = sodium.crypto_box_easy_afternm(
      message,
      nonce,
      this.sharedKey
    );

    const encryptedMessage = new Uint8Array(nonce.length + ciphertext.length);
    encryptedMessage.set(nonce);
    encryptedMessage.set(ciphertext, nonce.length);
    return sodium.to_base64(encryptedMessage);
  }

  /**
   *
   * @param encryptedMessage as returned by EP2SecureChannel.encrypt
   * @returns
   */
  decrypt<T>(encryptedMessageString: string): T {
    const encryptedMessage = sodium.from_base64(encryptedMessageString);
    // Extract the nonce and ciphertext from the encrypted message
    const nonce = encryptedMessage.slice(0, sodium.crypto_box_NONCEBYTES);
    const ciphertext = encryptedMessage.slice(sodium.crypto_box_NONCEBYTES);

    // Decrypt the message
    const plaintext = sodium.crypto_box_open_easy_afternm(
      ciphertext,
      nonce,
      this.sharedKey
    );

    const object: T = JSON.parse(sodium.to_string(plaintext));

    return object;
  }
}

/**
 * Abstract class for all encryption types. Stringifies any object and decrypts it with JSON.parse().toJSON and fromJSON methods make sure the Uint8Arrays are correctly (de)serialized and methods are revived after serialization.
 */
export abstract class EP2Encrypted<ANY> {
  [key: string]: null | number[] | Uint8Array | Function | number | string;

  cipher: string;
  constructor(object: ANY) {
    this.cipher = JSON.stringify(object);
  }
  /**
   * This class doesn't need anything since nothing is encrypted yet, just stringified.
   * @param _ep2key unused in this abstract
   * @param _sender unused in this abstract
   * @returns
   */
  protected decrypt(_ep2key?: EP2Key, _sender?: string): ANY {
    return JSON.parse(this.cipher);
  }

  /**
   *
   * @param json a serialized `EP2Encrypted` message from toJSON()
   * @returns a valid `EP2Encrypted` with Uint8Arrays and working methods.
   */
  static async revive<T extends EP2Encrypted<any>>(t: T) {
    await sodium.ready;
    Object.setPrototypeOf(t, this.prototype);
  }
}
/**
 * The Anonymized class represents an asymmetrically encrypted, non-identifiable message sent from a known sender to a known receiver. Both parties must know their public box keys. Public signing key of the sender is encrypted to obfuscate the origin.
 */
export class EP2Anonymized<ANY> extends EP2Encrypted<ANY> {
  /**
   * encrypted Sender Public Signing Key
   */
  espsk: string;
  nonce: string;

  constructor(obj: ANY, ep2key: EP2Key, receiver: string) {
    super(obj);

    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

    const receiverKeyPublicKey = EP2Key.convertId2PublicKey(receiver);

    // encrypt the message with the receiver's public key
    //  let cipher = sodium.from_string(this.cipher);

    let cipher = sodium.crypto_box_easy(
      this.cipher,
      nonce,
      receiverKeyPublicKey,
      ep2key.keySet.boxKeyPair.privateKey
    );
    // encrypt signing public to remain incognito
    this.espsk = sodium.crypto_box_easy(
      ep2key.keySet.signKeyPair.publicKey,
      nonce,
      receiverKeyPublicKey,
      ep2key.keySet.boxKeyPair.privateKey,
      "base64"
    );
    this.nonce = sodium.to_base64(nonce);
    // sign the cipher with the sender's private signing key
    const signature = sodium.crypto_sign_detached(
      cipher,
      ep2key.keySet.signKeyPair.privateKey
    );

    // concatenate the signature and the cipher
    cipher = new Uint8Array([...signature, ...cipher]);
    this.cipher = sodium.to_base64(cipher);
  }
  /**
   * To decrypt an anonymized message the receiver must know the sender's id.
   * @param ep2key
   * @param sender
   * @returns
   */
  override decrypt(ep2key: EP2Key, sender: string): ANY {
    let cipher = sodium.from_base64(this.cipher);
    const nonce = sodium.from_base64(this.nonce);
    const espsk = sodium.from_base64(this.espsk);
    const senderPublicBoxKey = EP2Key.convertId2PublicKey(sender);

    const decryptedPublicSigningKey = sodium.crypto_box_open_easy(
      espsk,
      nonce,
      senderPublicBoxKey,
      ep2key.keySet.boxKeyPair.privateKey
    );
    // verify the signature with the sender's public signing key
    const signature = cipher.slice(0, sodium.crypto_sign_BYTES);
    const verified = sodium.crypto_sign_verify_detached(
      signature,
      cipher.slice(sodium.crypto_sign_BYTES),
      decryptedPublicSigningKey
    );

    if (!verified) throw Error("Failed to verify message signature");

    this.cipher = sodium.crypto_box_open_easy(
      cipher.slice(sodium.crypto_sign_BYTES),
      nonce,
      senderPublicBoxKey,
      ep2key.keySet.boxKeyPair.privateKey,
      "text"
    );
    return super.decrypt();
  }
}
/**
 * A message Sealed for a box key holder with given public key, but will not reveal sender
 */
export class EP2Sealed<ANY> extends EP2Encrypted<ANY> {
  constructor(obj: ANY, receiver: string) {
    super(obj);
    const receiverPublicBoxKey = EP2Key.convertId2PublicKey(receiver);
    this.cipher = sodium.crypto_box_seal(
      this.cipher,
      receiverPublicBoxKey,
      "base64"
    );
  }

  override decrypt(ep2key: EP2Key): ANY {
    let cipher = sodium.from_base64(this.cipher);
    this.cipher = sodium.crypto_box_seal_open(
      cipher,
      ep2key.keySet.boxKeyPair.publicKey,
      ep2key.keySet.boxKeyPair.privateKey,
      "text"
    );
    return super.decrypt(ep2key);
  }
}

/**
 * Message can be decrypted by the receiver without knowing the sender (like Sealed), but identifies, verifies and returns the sender together with the sent object.
 */
export class EP2Cloaked<ANY> extends EP2Encrypted<ANY> {
  encryptedSenderPublicBoxKey: string;
  /**
   * property filled in during uncloak
   */
  public sender: string | null = null;

  constructor(
    obj: ANY,
    senderPublicBoxKey: Uint8Array,
    receiverPublicBoxKey: Uint8Array
  ) {
    super(obj);
    this.cipher = sodium.crypto_box_seal(
      this.cipher,
      receiverPublicBoxKey,
      "base64"
    );
    this.encryptedSenderPublicBoxKey = sodium.crypto_box_seal(
      senderPublicBoxKey,
      receiverPublicBoxKey,
      "base64"
    );
  }

  override decrypt(ep2key: EP2Key): ANY & { sender: string } {
    const sender = sodium.crypto_box_seal_open(
      sodium.from_base64(this.encryptedSenderPublicBoxKey),
      ep2key.keySet.boxKeyPair.publicKey,
      ep2key.keySet.boxKeyPair.privateKey
    );
    this.sender = EP2Key.convertPublicKey2Id(sender);

    // let cipher = sodium.from_base64(this.cipher);
    this.cipher = sodium.crypto_box_seal_open(
      sodium.from_base64(this.cipher),
      ep2key.keySet.boxKeyPair.publicKey,
      ep2key.keySet.boxKeyPair.privateKey,
      "text"
    );
    return { ...super.decrypt(), sender: this.sender };
  }
}
