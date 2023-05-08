import sodium from "libsodium-wrappers";

interface KeySet {
  signKeyPair: sodium.KeyPair;
  boxKeyPair: sodium.KeyPair;
}

interface HandshakeMessage {
  nonceB64: string;
  encryptedSharedSecretB64: string;
}

export interface EncryptedHandshake {
  message: string;
  signature: string;
  publicSignKey: string;
}

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
 * `EP2Key`: a class representing the cryptographic keypair used by a peer during the protocol. It contains the peer's public and private keys for both signing and encryption, and it defines the `Peer ID` based on base64 encoded public encryption key. It can initiate a handshake with another peer, and receive a handshake from another peer to establish a common shared secret to be used with the `SecureChannel`.
 */
export class EP2Key {
  public static async create(seed?: Uint8Array | string): Promise<EP2Key> {
    await sodium.ready;

    // if seed is just a simple string password, convert it to full 32 byte seed value
    if (typeof seed === "string") {
      seed = sodium.crypto_generichash(32, seed);
    }
    let signKeyPair, boxKeyPair;

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

  protected constructor(readonly keySet: KeySet) {}

  get peerId(): string {
    return sodium.to_hex(this.keySet.boxKeyPair.publicKey);
  }

  static convertPeerId2PublicKey(peerId: string): Uint8Array {
    try {
      return sodium.from_hex(peerId);
    } catch (error) {
      throw new Error(`Invalid peerId: ${peerId}. Error: ${error as string}`);
    }
  }

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
    const secureChannel = new SecureChannel(sharedSecret);
    return { secureChannel, handshake };
  }

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

    return new SecureChannel(
      sodium.crypto_box_open_easy(
        sharedSecret,
        nonce,
        EP2Key.convertPeerId2PublicKey(peerId),
        this.keySet.boxKeyPair.privateKey
      )
    );
  }

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

  static encrypt<T>(
    publicKey: string,
    obj: T
  ): SymmetricallyEncryptedMessage<T> {
    const sharedSecret = sodium.randombytes_buf(
      sodium.crypto_secretbox_KEYBYTES
    );

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const cipherB64 = sodium.to_base64(
      sodium.crypto_secretbox_easy(JSON.stringify(obj), nonce, sharedSecret)
    );

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

  encryptSymmetrically<T>(
    publicKey: string,
    obj: T
  ): SymmetricallyEncryptedMessage<T> {
    return EP2Key.encrypt(publicKey, obj);
  }

  decryptSymmetrically<T>(relayedMessage: SymmetricallyEncryptedMessage<T>): T {
    const sharedSecret = sodium.crypto_box_seal_open(
      sodium.from_base64(relayedMessage.encryptedKeyB64),
      this.keySet.boxKeyPair.publicKey,
      this.keySet.boxKeyPair.privateKey
    );

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
 * A class representing a secure channel between two peers. It is initialized with a shared symmetric key and provides methods to encrypt and decrypt messages.
 */
export class SecureChannel {
  constructor(public readonly sharedSecret: Uint8Array) {}

  encrypt<T>(obj: T): AsymmetricallyEncryptedMessage<T> {
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    return new AsymmetricallyEncryptedMessage(
      sodium.to_base64(nonce),
      sodium.to_base64(
        sodium.crypto_secretbox_easy(
          sodium.from_string(JSON.stringify(obj)),
          nonce,
          this.sharedSecret
        )
      )
    );
  }

  decrypt<T>(encrypted: AsymmetricallyEncryptedMessage<T>): T {
    return JSON.parse(
      sodium.to_string(
        sodium.crypto_secretbox_open_easy(
          sodium.from_base64(encrypted.cipherB64),
          sodium.from_base64(encrypted.nonceB64),
          this.sharedSecret
        )
      )
    );
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
