# EP2Key

`EP2Key` is a TypeScript package that provides a key pair for secure communication between `peers` using the [`sodium`](https://github.com/jedisct1/libsodium.js) cryptography library. It offers two types of encryption: asymmetric encryption, where the message is encrypted with the recipient's public key, and symmetric encryption, where the message is encrypted with a shared secret key.

## Installation

To install `EP2Key` with `npm`, run:

```bash
npm install @ep2/key
```

To use the package, import it in your TypeScript file as follows:

```typescript
import { EP2Key } from "@ep2/key";
```

## Usage

### Creating an EP2Key

To create an `EP2Key` instance, you can use the `create` static async method:

```typescript
const keyPair = await EP2Key.create();
```

The `create` method generates a key pair consisting of a public and a private key for asymmetric encryption and a public and a private key for symmetric encryption. It returns a promise that resolves to an instance of `EP2Key`.

You can also specify a seed value from which to derive the key pair:

```typescript
const seed = new Uint8Array([1, 2, 3, 4]);
const keyPair = await EP2Key.create(seed);
```

Alternatively, you can use a string password to derive the seed value:

```typescript
const password = "my-password";
const keyPair = await EP2Key.create(password);
```

Note that deriving the seed value from a string password using `crypto_generichash` can result in a weak keyset if the password does not contain enough entropy.

### Peer ID

The `peerId` property of the `EP2Key` is a unique identifier used to identify peers in the network.

```typescript
const peerId = ep2Key.peerId;
```

Peers share their public IDs as part of the P2P key exchange process. When initiating a new secure channel with a peer, the `peerId` of the destination peer is passed to the `initiateHandshake` method. This `peerId` is then used to retrieve the public key of the destination peer from the `EP2Key` object and to encrypt the shared secret key with the public key of the destination peer during the handshake process. The encrypted shared secret key is then sent to the destination peer along with the signed handshake message. When receiving a handshake from a peer, the `peerId` of the sender is also required to decrypt the encrypted shared secret key using the private key of the receiver. This ensures that only the intended recipient can access the shared secret key and establish a secure channel with the sender.

### Encrypting and Decrypting Messages

#### Asymmetric Encryption

To encrypt a message using asymmetric encryption, you need to know the public key of the recipient. You can then create an instance of `AsymmetricallyEncryptedMessage` and call its `decrypt` method with the recipient's `EP2Key` instance to decrypt the message.

```typescript
const message = "Hello, world!";
const recipientPublicKey = "..."; // base64-encoded public key of the recipient
const encryptedMessage = keyPair.encryptAsymmetrically(
  message,
  recipientPublicKey
);
const decryptedMessage = recipientKey.decryptAsymmetrically<string>(
  keyPair.peerId,
  encryptedMessage
);
```

The `encryptAsymmetrically` method returns an instance of `AsymmetricallyEncryptedMessage`, which contains the encrypted message and a nonce. The nonce is used to ensure that each message encrypted with the same key is unique. The `decryptAsymmetrically` method takes the sender's peer ID and the encrypted message as arguments

### Encrypting and Decrypting Messages

#### Asymmetric Encryption

To encrypt a message using asymmetric encryption, you need to know the public key of the recipient. You can then create an instance of `AsymmetricallyEncryptedMessage` and call its `decrypt` method with the recipient's `EP2Key` instance to decrypt the message.

```typescript
const message = "Hello, world!";
const recipientPublicKey = "..."; // base64-encoded public key of the recipient
const encryptedMessage = keyPair.encryptAsymmetrically(
  message,
  recipientPublicKey
);
const decryptedMessage = recipientKey.decryptAsymmetrically<string>(
  keyPair.peerId,
  encryptedMessage
);
```

The `encryptAsymmetrically` method returns an instance of `AsymmetricallyEncryptedMessage`, which contains the encrypted message and a nonce. The nonce is used to ensure that each message encrypted with the same key is unique. The `decryptAsymmetrically` method takes the sender's peer ID and the encrypted message as arguments and returns the decrypted message.

#### Symmetric Encryption

To encrypt a message using symmetric encryption, you need to generate a shared secret key and use it to encrypt the message. You can then create an instance of `SymmetricallyEncryptedMessage` and call its `decrypt` method with the recipient's `EP2Key` instance to decrypt the message.

```typescript
const message = "Hello, world!";
const sharedSecret = "..."; // base64-encoded shared secret
const encryptedMessage = keyPair.encryptSymmetrically(message, sharedSecret);
const decryptedMessage =
  recipientKey.decryptSymmetrically<string>(encryptedMessage);
```

The `encryptSymmetrically` method returns an instance of `SymmetricallyEncryptedMessage`, which contains the encrypted message, a nonce, and the encrypted shared secret. The `decryptSymmetrically` method takes the encrypted message as an argument and returns the decrypted message.

### Initiating a Secure Channel

To initiate a new secure channel with a peer, the `initiateHandshake` method is used by a participant to initiate a secure channel with another participant.
import { EP2Key } from 'ep2-js'
import { initiateHandshake, receiveHandshake, SecureChannel } from './secure-channel'

// Peer A generates a new key set and initiates a handshake with Peer B
const peerAKey = new EP2Key()
const peerAHandshake = initiateHandshake('peerB', peerAKey)

// Peer A sends the handshake message to Peer B using some communication channel
// ...

// Peer B receives the handshake message from Peer A
const peerBKey = new EP2Key()
const peerBSecureChannel = receiveHandshake('peerA', peerAHandshake, peerBKey)

// Now, both peers have established a shared secret and can start communicating securely using the SecureChannel class
const message = { text: 'Hello, World!' }
const encryptedMessage = peerASecureChannel.encrypt(message)

// Peer A sends the encrypted message to Peer B using some communication channel
// ...

// Peer B receives the encrypted message from Peer A
const decryptedMessage = peerBSecureChannel.decrypt(encryptedMessage)
console.log(decryptedMessage) // { text: 'Hello, World!' }

The `peerId` parameter specifies the destination peer ID that the participant wants to communicate with. The method generates a shared secret and uses it to establish a secure channel with the other participant. It returns an object containing the `secureChannel` and a `handshake` message to be sent to the other participant for them to establish the same shared secret.

The `receiveHandshake` method is used by a participant to establish the same shared secret as the sending peer. The method takes the `peerId` and the `handshake` message as parameters. It verifies the signature of the `handshake` message, decrypts the shared secret, and returns a `SecureChannel` object.

Once a shared secret has been established, the `SecureChannel` object can be used to encrypt and decrypt messages between the two participants. The `encrypt` method takes an object as input, encrypts it using the shared secret, and returns an `AsymmetricallyEncryptedMessage` object containing the encrypted message and a nonce. The `decrypt` method takes an `AsymmetricallyEncryptedMessage` object as input, decrypts it using the shared secret and the nonce, and returns the original object.

## Dependencies

This code uses the [`sodium`](https://github.com/jedisct1/libsodium.js) library for cryptographic operations.

## Contributing

Contributions to this code are welcome. Please open an issue or a pull request for any bug fixes or feature requests.

## License

This code is licensed under the MIT License. See the `LICENSE` file for details.
