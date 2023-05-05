# EP2KeyBIP

EP2KeyBIP extends the [EP2Key](../packages/key) library, providing support for [BIP32](https://github.com/bitcoinjs/bip32) hierarchical deterministic wallets and [BIP39](https://github.com/bitcoinjs/bip39) mnemonic seed recovery phrases to the peer-to-peer encryption component.

## Installation

```bash
npm i @ep2/key-bip
```

## Importing the library

```javascript
import { EP2KeyBIP } from "@ep2/key-bip";
```

## Creating a new key instance

To create a new key instance, you can use the static `create` method, which generates a new key with a key strength of 128 bits. The mnemonic seed recovery phrase can be obtained from the `mnemonic` property.

```typescript
const ep2Key = await EP2KeyBIP.create();

const recoveryPhrase = ep2Key.mnemonic;

console.log(recoveryPhrase);

// donkey eager potato discover stuff govern ill token gentle gas peasant orient
```

## Mnemonic seed

The `create` method also accepts a `string` value as a mnemonic recovery seed. It overrides the [_create with a simple seed_](../packages/key) from the superclass and validates this seed value for a valid mnemonic value and uses it to create the HD master key and normal key.

```typescript
const recoveredKey = await EP2KeyBIP.create(
  "donkey eager potato discover stuff govern ill token gentle gas peasant orient"
);

console.log(recoveredKey.mnemonic);

// donkey eager potato discover stuff govern ill token gentle gas peasant orient
```

## HD wallet

The `masterKey` property of EP2KeyBIP implements the [`BIP32Interface`](https://github.com/bitcoinjs/bip32#example), allowing keys to be derived easily.

```typescript
import { EP2KeyBIP } from "@ep2/key-bip";

// Create a new instance of EP2KeyBIP
const ep2Key = await EP2KeyBIP.create();

// Use the HD wallet to generate a new key
const childKey = ep2Key.masterKey.derivePath("m/44'/0'/0'/0/0");
```

## Encryption/Decryption

Encryption and decryption works according the `EP2Key` library;

```typescript
// Use the key to encrypt and decrypt messages, just like the normal EP2Key

const key1 = await EP2Key.create();
const key2 = await EP2KeyBIP.create();

const encryptedMessage = await key1.encrypt(
  "Hello, World!",
  "recipientPublicKey"
);
const decryptedMessage = await key2.decrypt(encryptedMessage, key1.peerId);
```

## License

EP2KeyBIP is open-source software released under the MIT license. Please see the LICENSE file for more details.
