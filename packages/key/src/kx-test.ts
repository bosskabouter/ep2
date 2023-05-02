import sodium from 'libsodium-wrappers'
import { type KeySet, SymmetricallyEncryptedMessage, AsymmetricallyEncryptedMessage, SecureChannel, EP2Key, EncryptedHandshake } from '.'

/**
 * Key pair used for secure communication between two peers.
 */
export class EP2KeyKX extends EP2Key {
  /**
   *
   * @param seed value to derive the key from. Can be a) a Uint8Array with seed for crypto_sign_seed_keypair, b) any string password to  derive the seed value from using crypto_generichash. Caution: this can results in a weak keyset if string doesn't contain enough entropy.
   * @returns Instance of the SecureChannelKey class
   */
  public static override async create(
    seed?: Uint8Array | string
  ): Promise<EP2KeyKX> {
    await sodium.ready
    // if seed is just a simple string password, convert it to full 32 byte seed value
    let signKeyPair, boxKeyPair, kxKeyPair

    if (typeof seed === 'string') {
      seed = sodium.crypto_generichash(32, seed)
    }
    if (seed != null) {
      signKeyPair = sodium.crypto_sign_seed_keypair(seed)
      boxKeyPair = sodium.crypto_box_seed_keypair(seed)
      kxKeyPair = sodium.crypto_kx_seed_keypair(seed)
    } else {
      signKeyPair = sodium.crypto_sign_keypair()
      boxKeyPair = sodium.crypto_box_keypair()
      kxKeyPair = sodium.crypto_kx_keypair()
    }

    return new this({ signKeyPair, boxKeyPair, kxKeyPair })
  }

  /**
   * @see create to initialize key
   */
  protected constructor(override readonly keySet: KXKeySet) {
    super(keySet)
  }

  
  /**
   *
   * @param peerId Destination Peer ID to initiate a new secure channel with. This public box key is used in the hybrid encryption/verification handshake to establish a shared secret.
   * @returns a shared secret (to be kept secret :), together with the handshake to send to the other peer in order for him to establish the same shared secret on his side.
   */
  override initiateHandshake(peerId: string): {
    secureChannel: SecureChannel
    handshake: EncryptedHandshake
  } {
    const kx = sodium.crypto_kx_client_session_keys(this.keySet.kxKeyPair.publicKey, this.keySet.kxKeyPair.privateKey, sodium.from_hex(peerId))
    return { secureChannel: new KXSecureChannel(kx.sharedTx, kx.sharedRx), handshake: { message: '', publicSignKey: '', signature: '' } }
  }


  /**
   * Established the same shared secret as the sending peerId, using given encrypted handshake message.
   * @param peerId
   * @param handshake
   * @returns the shared secret key
   * @throws Error if anything prevented from establishing shared secret from handshake
   */
  override receiveHandshake(peerId: string): SecureChannel {
    const kx = sodium.crypto_kx_server_session_keys(
      this.keySet.kxKeyPair.publicKey,
      this.keySet.kxKeyPair.privateKey,
      sodium.from_hex(peerId))
    return new KXSecureChannel(kx.sharedRx, kx.sharedTx)
  }

  /**
  In a normal SecureMessage, the public key of the sender is needed because it is used to encrypt the message for the intended recipient. This allows only the recipient, who possesses the private key corresponding to the public key used in the encryption, to decrypt and read the message.
   * @param publicKey - The recipient's public key.
   * @param obj - The message to be encrypted.
   * @returns The encrypted message and nonce.
   */
  override encrypt<T>(publicKey: string, obj: T): AsymmetricallyEncryptedMessage<T> {
    const nonce = (sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES))
    const cipherB64 = sodium.to_base64(sodium.crypto_box_easy(JSON.stringify(obj), nonce, sodium.from_hex(publicKey), this.keySet.boxKeyPair.privateKey))
    return new AsymmetricallyEncryptedMessage(sodium.to_base64(nonce), cipherB64)
  }

  /**
  * Decrypts a message originating from given sender's public key.
  * @param originPublicKey - The sender's public key.
  * @param encryptedMessage - The encrypted message and nonce.
  * @returns The decrypted message.
  */
  override decrypt<T>(originPublicKey: string, encryptedMessage: AsymmetricallyEncryptedMessage<T>): T {
    return JSON.parse(sodium.to_string(
      sodium.crypto_box_open_easy(
        sodium.from_base64(encryptedMessage.cipherB64),
        sodium.from_base64(encryptedMessage.nonceB64),
        sodium.from_hex(originPublicKey),
        this.keySet.boxKeyPair.privateKey
      )
    ))
  }

  /**
 *
 * @param publicKey
 * @param obj
 * @returns
 */
  static override encrypt<T>(publicKey: string, obj: T): SymmetricallyEncryptedMessage<T> {
    // Generate a random symmetric key for AES encryption
    const sharedSecret = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES)

    // Encrypt the message with AES
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    const cipherB64 = sodium.to_base64(sodium.crypto_secretbox_easy(JSON.stringify(obj), nonce, sharedSecret))

    // Encrypt the symmetric key with RSA public key of the relay server
    const encryptedKeyB64 = sodium.to_base64(sodium.crypto_box_seal(sharedSecret, sodium.from_hex(publicKey)))
    return new SymmetricallyEncryptedMessage(sodium.to_base64(nonce), cipherB64, encryptedKeyB64)
  }

  /**
  * Synonym for static encrypt
  * @see SecureChannel.encrypt
  * @param publicKey
  * @param obj
  * @returns
  */
  override encryptSymmetrically<T>(publicKey: string, obj: T): SymmetricallyEncryptedMessage<T> {
    return EP2KeyKX.encrypt(publicKey, obj)
  }
  /**
  *
  * @param relayedMessage
  * @returns
  */
  override decryptSymmetrically<T>(relayedMessage: SymmetricallyEncryptedMessage<T>): T {
    const decryptedKey = sodium.crypto_box_seal_open(sodium.from_base64(relayedMessage.encryptedKeyB64), this.keySet.boxKeyPair.publicKey, this.keySet.boxKeyPair.privateKey)

    // Decrypt the message with the recovered symmetric key
    return JSON.parse(sodium.to_string(sodium.crypto_secretbox_open_easy(sodium.from_base64(relayedMessage.cipherB64), sodium.from_base64(relayedMessage.nonceB64), decryptedKey)))
  }
}
/**
 * The key contains an encryption and a signing key, based on the same seed
 */
interface KXKeySet extends KeySet {
  signKeyPair: sodium.KeyPair
  boxKeyPair: sodium.KeyPair
  kxKeyPair: sodium.KeyPair
}

/**
 * Once a shared secret has been established in between two participants during handshake, a secure channel is able to encrypt and decrypt messages using this shared common secret
 */
export class KXSecureChannel extends SecureChannel {
  /**
     *
     * @param sharedSecret
     */
  constructor(x1: Uint8Array, x2: Uint8Array) {
    const hashConcat = new Uint8Array(x1.length + x2.length)
    hashConcat.set(x1)
    hashConcat.set(x2, x1.length)

    super(hashConcat)
    // super(sodium.crypto_generichash(
    //   sodium.crypto_kx_SESSIONKEYBYTES,
    //   hashConcat)
    // )
  }
}
