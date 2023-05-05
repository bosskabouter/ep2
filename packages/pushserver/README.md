# [`EP2PushServer`](./packages/pushserver/)

This package is part of the `ep2` library, which provides **offline** and **online** **encrypted** **peer to peer** communication in between **browsers**.

The [`@ep2/push`](../push/) package is the client-side of this server and is responsible for encrypting the `PushSubscription` with the server's public key and sharing his encrypted subscription endpoint with other clients, allowing them to push notifications to the sharing peer, using this `@ep2/pushserver` to relay the message.

This package is the offline server component of the `ep2` library, which is used to relay the encrypted subscription to the destination peer. It can read the endpoint to push, but not the payload, and simply relays it to the destination peer.

The `EP2PushServer` package creates an `Express` app with a request handler capable of **_`relaying`_** encrypted push messages between peers. It has a configuration similar to that of the [`EP2PeerServer`](../peerserver/) package.

The server needs besides the usual VAPID keypair, an [EP2Key](../key/) to be able to decrypt the endpoint of the receiving client. The client therefore needs to know the peerId of this EP2PushServer so that only the server can read use the endpoint. Peers who where gicnn a received to run, an is needed. The `Peer ID` of this is key is needed for client to encrypt their subscription endpoint with, using an `SymmetricallyEncryptedMessage<T>` needs To start a server, you can call;

```typescript
EP2PushServer(await EP2Key.create("some seed value"), {
  keys: VAPID_KEYS,
  subject: "mailto:test@test.com",
});
```

An [**`EP2Push`**](../push/) making a request to send an encrypted message, the request must contain the client's handshake, the message, and its endpoint. The endpoint is encrypted using the public key of the relay server and then decrypted by the offline client to retrieve the payload.

## Usage

### Installation

To install this package, you can use NPM:

```
npm install @ep2/push-server
```

### Example

```typescript
import express from "express";
import { EP2PushServer, EP2Key } from "@ep2/push-server";
import VAPID_KEYS from "./vapid-keys.json";

const app = express();

// Create a new key pair for the server
const serverKey = await EP2Key.create("A *strong* recovery phrase");

app.use("/", EP2PushServer(serverKey, VAPID_KEYS, { port: 3000 }));

app.listen(3000, () => {
  console.log("EP2Push server listening on port 3000");
});
```

### API

#### `EP2PushServer(serverKey: EP2Key, vapidKeys: {publicKey: string, privateKey: string}, options?: ServerOptions): ExpressEP2PushServer`

Creates a new `EP2PushServer` instance with the specified server key and VAPID keys.

- `serverKey` - The key pair used by the server.
- `vapidKeys` - The VAPID keys used to authenticate push requests.
- `options` - An optional object containing server options.

#### `ExpressEP2PushServer`

An instance of `EP2PushServer` that can be mounted onto an Express app.

##### HTTP endpoints

- `GET /ep2push`: Retrieves public content.
- `GET /ep2push/test`: Tests the server.
- `POST /ep2push`: Sends a notification to the specified endpoint.

## Test

This package uses `jest` and `supertest` for testing. To run the tests, use:

```
npm test
```

## License

This package is licensed under the MIT License.
