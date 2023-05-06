import sodium from "libsodium-wrappers";

/**
 * An unencrypted envelope that contains a signed and encrypted HandshakeMessage.
 */
export interface EncryptedHandshake {
  /**
   * The base64-encoded encrypted HandshakeMessage.
   */
  message: string;
  /**
   * The base64-encoded signature of the encrypted HandshakeMessage.
   */
  signature: string;
  /**
   * The public signing key of the sender.
   */
  publicSignKey: string;
}

/**
 *  To Decrypt a SecureMessage, the public key of the sender is needed because it is used to encrypt the message for the intended recipient. This allows only the recipient, who possesses the private key corresponding to the public key used in the encryption, to decrypt and read the message.
 *
AsymmetricallyEncryptedMessage is encrypted using the public key of the intended recipient. While this provides confidentiality, it does not provide protection against potential attacks on the communication channel or on the recipient's private key.

 */
export class AsymmetricallyEncryptedMessage<T> {
  constructor(readonly nonceB64: string, readonly cipherB64: string) {}

  decrypt(EP2Key: EP2Key, sender: string): T {
    return EP2Key.decrypt<T>(sender, this);
  }
}

export class SymmetricallyEncryptedMessage<
  T
> extends AsymmetricallyEncryptedMessage<T> {
  constructor(
    override readonly nonceB64: string,
    override readonly cipherB64: string,
    readonly encryptedKeyB64: string
  ) {
    super(nonceB64, cipherB64);
  }
  override decrypt(EP2Key: EP2Key): T {
    return EP2Key.decryptSymmetrically<T>(this);
  }
}

/**
 * Key pair used for secure communication between two peers.
 */
export class EP2Key {
  /**
   *
   * @param seed value to derive the key from. Can be a) a Uint8Array with seed for crypto_sign_seed_keypair, b) any string password to  derive the seed value from using crypto_generichash. Caution: this can results in a weak keyset if string doesn't contain enough entropy. c) undefined: A unique 32 byte hash is generated.
   * @returns Instance of the EP2Key class
   */
  public static async create(seed?: Uint8Array | string): Promise<EP2Key> {
    await sodium.ready;
    // if seed is just a simple string password, convert it to full 32 byte seed value
    let signKeyPair, boxKeyPair;

    if (typeof seed === "string") {
      seed = sodium.crypto_generichash(32, seed);
    }
    if (seed != null) {
      signKeyPair = sodium.crypto_sign_seed_keypair(seed);
      boxKeyPair = sodium.crypto_box_seed_keypair(seed);
    } else {
      signKeyPair = sodium.crypto_sign_keypair();
      boxKeyPair = sodium.crypto_box_keypair();
    }

    return new this({ signKeyPair, boxKeyPair });
  }

  static fromJson(json: string): EP2Key {
    const parsed = JSON.parse(json);
    const signPublicKey = Uint8Array.from(parsed.signKeyPair.publicKey);
    const signPrivateKey = Uint8Array.from(parsed.signKeyPair.privateKey);
    const boxPublicKey = Uint8Array.from(parsed.boxKeyPair.publicKey);
    const boxPrivateKey = Uint8Array.from(parsed.boxKeyPair.privateKey);
    const keySet: KeySet = {
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

    return new EP2Key(keySet);
  }

  toJSON(): string {
    const signPublicKey = Array.from(this.keySet.signKeyPair.publicKey);
    const signPrivateKey = Array.from(this.keySet.signKeyPair.privateKey);
    const boxPublicKey = Array.from(this.keySet.boxKeyPair.publicKey);
    const boxPrivateKey = Array.from(this.keySet.boxKeyPair.privateKey);
    const keySet = {
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
    return JSON.stringify(keySet);
  }

  /**
   * @see create to initialize key
   */
  protected constructor(readonly keySet: KeySet) {}

  /**
   * @returns Public identifier of this peer, based on the urlsafe base64 value of public box key (asymmetric encryption key - x25519). Used to initiate a secure channel and establish a shared secret through hybrid encryption/verification.
   */
  get peerId(): string {
    return sodium.to_hex(this.keySet.boxKeyPair.publicKey);
  }

  /**
   *
   * @param peerId
   */
  static convertPeerId2PublicKey(peerId: string): Uint8Array {
    try {
      return sodium.from_hex(peerId);
    } catch (error) {
      throw new Error(`Invalid peerId: ${peerId}. Error: ${error as string}`);
    }
  }

  /**
   *
   * @param peerId Destination Peer ID to initiate a new secure channel with. This public box key is used in the hybrid encryption/verification handshake to establish a shared secret.
   * @returns a shared secret (to be kept secret :), together with the handshake to send to the other peer in order for him to establish the same shared secret on his side.
   */
  initiateHandshake(peerId: string): {
    secureChannel: SecureChannel;
    handshake: EncryptedHandshake;
  } {
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const sharedSecret = sodium.crypto_secretstream_xchacha20poly1305_keygen();

    const encryptedSharedSecret = sodium.crypto_box_easy(
      sharedSecret,
      nonce,
      EP2Key.convertPeerId2PublicKey(peerId),
      this.keySet.boxKeyPair.privateKey
    );

    const { encryptedSharedSecretB64, nonceB64 } = {
      encryptedSharedSecretB64: sodium.to_base64(encryptedSharedSecret),
      nonceB64: sodium.to_base64(nonce),
    };

    const handshakeMessage: HandshakeMessage = {
      encryptedSharedSecretB64,
      nonceB64,
    };
    const signedMessageBytes = sodium.from_string(
      JSON.stringify(handshakeMessage)
    );

    const signature = sodium.crypto_sign_detached(
      signedMessageBytes,
      this.keySet.signKeyPair.privateKey
    );

    const handshake: EncryptedHandshake = {
      message: sodium.to_base64(signedMessageBytes),
      publicSignKey: sodium.to_base64(this.keySet.signKeyPair.publicKey),
      signature: sodium.to_base64(signature),
    };
    return { secureChannel: new SecureChannel(sharedSecret), handshake };
  }

  /**
   * Established the same shared secret as the sending peerId, using given encrypted handshake message.
   * @param peerId
   * @param handshake
   * @returns the shared secret key
   */
  receiveHandshake(
    peerId: string,
    handshake: EncryptedHandshake
  ): SecureChannel {
    {
      const signature = sodium.from_base64(handshake.signature);
      const verified = sodium.crypto_sign_verify_detached(
        signature,
        sodium.from_base64(handshake.message),
        sodium.from_base64(handshake.publicSignKey)
      );
      if (!verified) throw Error("Invalid signature!");
    }

    const message: HandshakeMessage = JSON.parse(
      sodium.to_string(sodium.from_base64(handshake.message))
    );

    const nonce = sodium.from_base64(message.nonceB64);
    const sharedSecret = sodium.from_base64(message.encryptedSharedSecretB64);

    // The receiver uses their private box key to decrypt the shared key
    return new SecureChannel(
      sodium.crypto_box_open_easy(
        sharedSecret,
        nonce,
        EP2Key.convertPeerId2PublicKey(peerId),
        this.keySet.boxKeyPair.privateKey
      )
    );
  }

  /**
   * In a normal SecureMessage, the public key of the sender is needed because it is used to encrypt the message for the intended recipient. This allows only the recipient, who possesses the private key corresponding to the public key used in the encryption, to decrypt and read the message.
   * @param publicKey - The recipient's public key.
   * @param message - The message to be encrypted.
   * @returns The encrypted message and nonce.
   */
  encrypt<T>(publicKey: string, object: T): AsymmetricallyEncryptedMessage<T> {
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const cipherB64 = sodium.to_base64(
      sodium.crypto_box_easy(
        JSON.stringify(object),
        nonce,
        EP2Key.convertPeerId2PublicKey(publicKey),
        this.keySet.boxKeyPair.privateKey
      )
    );
    return new AsymmetricallyEncryptedMessage<T>(
      sodium.to_base64(nonce),
      cipherB64
    );
  }

  /**
   * Decrypts a message originating from given sender's public key.
   * @param originPublicKey - The sender's public key.
   * @param encryptedMessage - The encrypted message and nonce.
   * @returns The decrypted message.
   */
  decrypt<T>(
    originPublicKey: string,
    encryptedMessage: AsymmetricallyEncryptedMessage<T>
  ): T {
    return JSON.parse(
      sodium.to_string(
        sodium.crypto_box_open_easy(
          sodium.from_base64(encryptedMessage.cipherB64),
          sodium.from_base64(encryptedMessage.nonceB64),
          EP2Key.convertPeerId2PublicKey(originPublicKey),
          this.keySet.boxKeyPair.privateKey
        )
      )
    );
  }

  /**
   * 1. Generate a random symmetric key for AES encryption
   * 2. Encrypt the message with AES
   * 3. Encrypt the given symmetric key with RSA public key
   * @param publicKey public key to seal the symmetric key with
   * @param message a message to be encrypted for given public key
   * @returns an encrypted message with symmetric key sealed for given public key
   */
  static encrypt<T>(
    publicKey: string,
    obj: T
  ): SymmetricallyEncryptedMessage<T> {
    // Generate a random symmetric key for AES encryption
    const sharedSecret = sodium.randombytes_buf(
      sodium.crypto_secretbox_KEYBYTES
    );

    // Encrypt the message with AES
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const cipherB64 = sodium.to_base64(
      sodium.crypto_secretbox_easy(JSON.stringify(obj), nonce, sharedSecret)
    );

    // Encrypt the symmetric key with RSA public key of the relay server
    const encryptedKeyB64 = sodium.to_base64(
      sodium.crypto_box_seal(
        sharedSecret,
        EP2Key.convertPeerId2PublicKey(publicKey)
      )
    );
    return new SymmetricallyEncryptedMessage(
      sodium.to_base64(nonce),
      cipherB64,
      encryptedKeyB64
    );
  }

  /**
   * Synonym for static encrypt
   * @see SecureChannel.encrypt
   * @param publicKey
   * @param obj
   * @returns
   */
  encryptSymmetrically<T>(
    publicKey: string,
    obj: T
  ): SymmetricallyEncryptedMessage<T> {
    return EP2Key.encrypt(publicKey, obj);
  }

  /**
   *
   * @param relayedMessage
   * @returns
   */
  decryptSymmetrically<T>(relayedMessage: SymmetricallyEncryptedMessage<T>): T {
    const sharedSecret = sodium.crypto_box_seal_open(
      sodium.from_base64(relayedMessage.encryptedKeyB64),
      this.keySet.boxKeyPair.publicKey,
      this.keySet.boxKeyPair.privateKey
    );

    // Decrypt the message with the recovered symmetric key
    return JSON.parse(
      sodium.to_string(
        sodium.crypto_secretbox_open_easy(
          sodium.from_base64(relayedMessage.cipherB64),
          sodium.from_base64(relayedMessage.nonceB64),
          sharedSecret
        )
      )
    );
  }
}
/**
 * The key contains an encryption and a signing key, based on the same seed
 */
export interface KeySet {
  signKeyPair: sodium.KeyPair;
  boxKeyPair: sodium.KeyPair;
}

/**
 * A handshake message that is sent between peers during the secure handshake process.
 */
interface HandshakeMessage {
  /**
   * prevent replay attacks.
   */
  nonceB64: string;
  /**
   * A string representing the shared secret key.
   */
  encryptedSharedSecretB64: string;
}

/**
 * Once a shared secret has been established in between two participants during handshake, a secure channel is able to encrypt and decrypt messages using this shared common secret
 */
export class SecureChannel {
  /**
   *
   * @param sharedSecret
   */
  constructor(public readonly sharedSecret: Uint8Array) {}

  encrypt<T>(obj: T): AsymmetricallyEncryptedMessage<T> {
    // Generate a new random nonce for each message
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    // Encrypt the message with the shared secret and nonce
    const cipherB64 = sodium.to_base64(
      sodium.crypto_secretbox_easy(
        sodium.from_string(JSON.stringify(obj)),
        nonce,
        this.sharedSecret
      )
    );
    return new AsymmetricallyEncryptedMessage(
      sodium.to_base64(nonce),
      cipherB64
    );
  }

  decrypt<T>(encrypted: AsymmetricallyEncryptedMessage<T>): T {
    // Decrypt the message with the shared secret and nonce
    const decryptedBytes = sodium.crypto_secretbox_open_easy(
      sodium.from_base64(encrypted.cipherB64),
      sodium.from_base64(encrypted.nonceB64),
      this.sharedSecret
    );
    return JSON.parse(sodium.to_string(decryptedBytes));
  }
}

export function generateRandomKey(callback?: (key: EP2Key) => void): void {
  EP2Key.create()
    .then((key) => {
      console.log(key.toJSON());
      callback?.(key);
    })
    .catch(console.error);
}
