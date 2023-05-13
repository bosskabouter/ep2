# `EP2Key`

`EP2Key` is a TypeScript library that provides secure communication between key holders using the [`sodium`](https://github.com/jedisct1/libsodium.js) cryptography library. It is the core component of  [ep² - encrypted peer*push](../../) library
.

It offers two types of encryption:

- `asymmetric` encryption, where the message is encrypted with the recipient's public key, and
- `symmetric` encryption, where the message is encrypted with a shared secret key.

A `SecureChannel` between two key holders can be established for symmetric encryption after a successful asymmetric handshake.

## Installation

```bash
npm i @ep2/key
```

## Usage

```typescript
import {EP2Key} from '@ep2/key';


const key1 = await EP2Key.create(); //seed is securely generated
console.log(key1.id); // prints out: "4614e5446e57bce4432a92b9be4c5884d3ec8d82a97367abe4995d5812b7aa2e"

const key2 = await EP2Key.create('A *strong* seed'); // or UInt8Array(128)

const encrypted = AsymmetricallyEncryptedMessage<string> = key1.encrypt(key2.id, "Hello, World!")

const message:string = key2.decrypt(key1.id, encrypted)
console.log(message); // prints out: "Hello, World!"


```

## Installation

To install `EP2Key` in your project using `npm`, run:

```bash
npm install @ep2/key
```

Or install globally:

```bash
npm install @ep2/key -g
```

Run `ep2key` from the command line to generate a new id, seed, private and public signing and encryption keys:

``` bash
boss@boss-XPS-13-9360:~/Develop/ep2$ ep2key
{"id":"4614e5446e57bce4432a92b9be4c5884d3ec8d82a97367abe4995d5812b7aa2e","seed":[170,75,48,65,76,82,225,136,233,60,124,14,39,162,120,230,65,143,161,177,4,69,12,151,97,158,167,72,24,147,63,217],"signKeyPair":{"publicKey":[106,1,26,108,179,156,245,28,154,214,250,33,211,131,224,58,200,172,232,55,235,234,83,213,239,189,72,201,170,218,15,129],"privateKey":[170,75,48,65,76,82,225,136,233,60,124,14,39,162,120,230,65,143,161,177,4,69,12,151,97,158,167,72,24,147,63,217,106,1,26,108,179,156,245,28,154,214,250,33,211,131,224,58,200,172,232,55,235,234,83,213,239,189,72,201,170,218,15,129],"keyType":"ed25519"},"boxKeyPair":{"publicKey":[70,20,229,68,110,87,188,228,67,42,146,185,190,76,88,132,211,236,141,130,169,115,103,171,228,153,93,88,18,183,170,46],"privateKey":[164,250,29,48,138,203,53,201,144,240,107,99,54,64,108,86,30,96,206,29,15,69,125,126,177,63,182,47,253,194,188,249],"keyType":"x25519"}}

```

To use the package, import it in your TypeScript file as follows:

```typescript
import { EP2Key } from "@ep2/key";
```

## Usage

### Creating an EP2Key

To create an `EP2Key` instance, use the `create` static async method:

```typescript
const ep2key = await EP2Key.create();
```

The `create` method generates a key pair consisting of a public and a private key for asymmetric encryption and a public and a private key for symmetric encryption. It returns a promise that resolves to an instance of `EP2Key`.

You can also specify a seed value from which to derive the key pair. Please note that the size of the key must have 128 bytes:

```typescript
const seed = new Uint8Array(128);
const ep2key = await EP2Key.create(seed);
```

Alternatively, you can use a string password to derive the seed value:

```typescript
const password = "my-password";
const ep2key = await EP2Key.create(password);
```

Note that deriving the seed value from a string password using `crypto_generichash` can result in a weak keyset if the password does not contain enough entropy.

## Peer ID

The `peerId` property of the `EP2Key` is a unique identifier used to identify communicating endpoints in the network.

```typescript
const peerId = ep2Key.peerId;
console.log(peerId);
//7d40fd9b1ad0a98e5d2aa5042f972c5d25b3295086af57aba476be449bbc430b
```

Peers share their public IDs as part of the peer-to-peer key exchange process. When initiating a new secure channel with a peer, the `peerId` of the destination peer is passed to the `initiateHandshake` method. This `peerId` is then used to retrieve the public key of the destination peer from the `EP2Key` object and to encrypt the shared secret key with the public key of the destination peer during the handshake process. The encrypted shared secret key is then sent to the destination peer along with the signed handshake message. When receiving a handshake from a peer, the `peerId` of the sender is also required to decrypt the encrypted shared secret key using the private key of the receiver. This ensures that only the intended recipient can access the shared secret key and establish a secure channel with the sender.

## Encrypting and Decrypting Messages

### `AsymmetricallyEncryptedMessage<T>`

To create a `AsymmetricallyEncryptedMessage`, both sender and receiver need to know the others public [Peer ID](#peer-id).

```typescript
const message = "Hello, world!";

const key1 = await EP2Key.create();
const key2 = await EP2Key.create();

const encryptedMessage = key1.encrypt<string>(message, key2.peerId);
const decryptedMessage = key2.decrypt<string>(key1.peerId, encryptedMessage);
```

Using the public key of the intended recipient provides confidentiality but not protection against potential attacks on the communication channel or on the recipient's private key. The message is constructed with a nonce (a unique number used once) and the cipher, which is the result of encrypting the plaintext message using the recipient's public key.

### `SymmetricallyEncryptedMessage<T>`

To encrypt a message for an intended recipient without revealing your identity, use the static `EP2Key.encrypt` function to retrieve an instance of the `SymmetricallyEncryptedMessage` that contains the encrypted message, the nonce used in the encryption, and the encrypted key.

```typescript
const message = "Hello, world!";

const key2 = await EP2Key.create();

const encryptedMessage = EP2Key.encrypt<string>(message, key2.peerId);
const decryptedMessage = key2.decryptSymmetrically<string>(encryptedMessage);
```

To decrypt a message, you need to have the private key corresponding to the public key used in the encryption. You can then use the decrypt function of the SymmetricallyEncryptedMessage class to decrypt the message. This enables anonymous relay of messages.

## `SecureChannel`

Establishing a Secure Channel between two parties involves a handshake to agree on the encryption keys, after which both parties can encrypt and decrypt messages sent between them.

```typescript
import { EP2Key, initiateHandshake, receiveHandshake } from "@ep2/key";

// Party A initiates the handshake
const partyAKey = await EP2Key.create();
const { secret, handshake } = await initiateHandshake(partyAKey);

// Party B receives the handshake from party A and sends back its own handshake
const partyBKey = await EP2Key.create();
const partyBHandshake = receiveHandshake(partyBKey, partyAHandshake);
const partyBResponse = await initiateHandshake(partyBKey, partyBHandshake);

// Party A receives party B's handshake response
const partyAFinalHandshake = await receiveHandshake(partyAKey, partyBResponse);

// The Secure Channel is now established and can be used to encrypt and decrypt messages between the two parties
const secureChannel = partyAFinalHandshake.secureChannel;
```

After the handshake is complete, a SecureChannel object is returned, which can be used to encrypt and decrypt messages between the two parties.

Here is an example of how to encrypt and decrypt a message using a SecureChannel:

```typescript
// Party A encrypts a message and sends it to party B
const message = "Hello, Party B!";
const encryptedMessage = secureChannel.encrypt(message);
partyB.receive(encryptedMessage);

// Party B receives the encrypted message, decrypts it, and reads the plaintext
const encryptedMessage = partyB.getNextMessage();
const plaintext = secureChannel.decrypt(encryptedMessage);
console.log(plaintext); // 'Hello, Party B!'
```

## API Reference

The `EP2Key` class has the following methods:

- `create(seed?: Uint8Array | string): Promise<EP2Key>`: Generates a new key pair for asymmetric and symmetric encryption. Optionally takes a seed value from which to derive the key pair.
- `encryptAsymmetrically<T>(message: T, recipientPublicKey: string): AsymmetricallyEncryptedMessage<T>`: Encrypts a message using asymmetric encryption with the recipient's public key. Returns an instance of `AsymmetricallyEncryptedMessage`, which contains the encrypted message and a nonce.
- `decryptAsymmetrically<T>(senderId: string, encryptedMessage: AsymmetricallyEncryptedMessage<T>): T`: Decrypts a message using asymmetric encryption with the private key of the recipient. Takes the sender's peer ID and the encrypted message as arguments and returns the decrypted message.
- `encryptSymmetrically<T>(message: T, sharedSecret: string): SymmetricallyEncryptedMessage<T>`: Encrypts a message using symmetric encryption with a shared secret key. Returns an instance of `SymmetricallyEncryptedMessage`, which contains the encrypted message and a nonce.
- `decryptSymmetrically<T>(encryptedMessage: SymmetricallyEncryptedMessage<T>): T`: Decrypts a message using symmetric encryption with the shared secret key. Takes the encrypted message as an argument and returns the decrypted message.

The `AsymmetricallyEncryptedMessage` class has the following properties:

- `encryptedMessage: string`: The base64-encoded encrypted message.
- `nonce: string`: The base64-encoded nonce used for encryption.

The `SymmetricallyEncryptedMessage` class has the following properties:

- `encryptedMessage: string`: The base64-encoded encrypted message.
- `nonce: string`: The base64-encoded nonce used for encryption.

## Conclusion

`EP2Key` provides a simple and secure way to establish a secure channel between peers using asymmetric and symmetric encryption. It's easy to use and integrates well with other TypeScript projects. If you need to secure your peer-to-peer communication, give `EP2Key` a try!
