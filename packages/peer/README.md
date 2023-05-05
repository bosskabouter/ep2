# [`EP2Peer`](./packages/peer)

## Introduction

`EP2Peer` is part of [ep² - encrypted online & offline p2p](../../) and creates and manages encrypted peer-to-peer connections between browsers. It is based on the [`peerjs`](https://github.com/peers/peerjs) library and uses [`libsodium`](https://github.com/jedisct1/libsodium.js) to handle encryption and decryption of data. The package provides two main classes: `EP2Peer` and `SecureLayer`.

## Installation

```bash
npm i @ep2/peer
```

## Usage

```typescript
const somePeerId = "cfc3e61a6faca1f4667d7...";
const serverId = "aca1f4667d7cfc3e61a6f...";
const myKey = await EP2Key.create();

const onlineClient = new EP2Peer(myKey, serverId);
const secureLayer = onlineClient.connectSecurely(somePeerId);
secureLayer.send("Hi Peer");
secureLayer.on("decrypted", (msg) => {
  console.log(msg);
});
```

## EP2Peer

The `EP2Peer` class represents an endpoint that can connect to other endpoints and create secure channels for data transfer. It takes an [`EP2Key`](../key/) object as input which contains the necessary information to uniquely identify the endpoint.

### Constructor

```typescript
const peer1 = new EP2Peer(key: EP2Key)
```

Creates a new `EP2Peer` instance with the provided `EP2Key` object. The `EP2Key` object contains a unique identifier for the endpoint and the necessary cryptographic keys to establish secure connections.

### Methods

#### `connectSecurely(peerId: string): SecureLayer`

```typescript
const secureLayer: SecureLayer = peer1.connectSecurely(key2.peerId);
```

Attempts to establish a secure connection with another endpoint using the `peerId` provided. Returns a `SecureLayer` object if the connection is successful.

#### `disconnect()`

```typescript
peer1.disconnect();
```

Closes all active connections and disconnects the endpoint from the signaling server.

#### `destroy()`

```typescript
peer1.destroy();
```

Closes all active connections and completely destroys the `EP2Peer` instance.

#### `isEp2PeerServer(): Promise<boolean>`

```typescript
const isEp2: boolean = await peer1.isEp2PeerServer();
```

Returns a promise that resolves to `true` if the connected signaling server is an `ep2online` server and `false` otherwise.

## SecureLayer

The `SecureLayer` class represents a secure channel for data transfer between two endpoints. It handles encryption and decryption of data using the cryptographic keys provided in the `EP2Key` objects of the endpoints.

### Constructor

```typescript
new SecureLayer(secureChannel: SecureChannel, dataConnection: DataConnection)
```

Creates a new `SecureLayer` instance with the provided `SecureChannel` object and `DataConnection` object.

### Events

#### `decrypted`

```typescript
secureLayer.on("decrypted", (data: any) => {
  /* handle decrypted data */
});
```

Emitted when encrypted data is received and successfully decrypted by the `SecureLayer`. The `data` argument contains the decrypted data.

### Methods

#### `send(data: any)`

```typescript
secureLayer.send("Data to encrypt");
```

Encrypts the provided `data` and sends it over the secure channel.

## Testing

The package includes tests for the `EP2Peer` and `SecureLayer` classes. The tests are located in the `__tests__` directory and can be run using Jest. The tests use mocks to simulate connections between endpoints and to test the encryption and decryption functionality.
