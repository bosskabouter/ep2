# [`EP2PushServer`](./packages/pushserver/)

`EP2PushServer` is part of the encrypted [ep2 - Encrypted online & offline browser P2P](../../) and provides a relay service for encrypted push notifications to subscribed peers.

[`@ep2/push`](../push/), the client counterpart of this server, allows peers to anonymously subscribe and request to push once receiving an authorization from the receiving peer.

## Usage

### Installation

To install this package using NPM:

``` bash
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
- `GET /ep2push/test`: Returns an unencrypted VAPID key pair.
- `GET /ep2push/version`: Returns `git rev-parse HEAD`.
- `POST /ep2push`: Sends a notification to the specified endpoint.

## Test

This package uses `jest` and `supertest` for testing. To run the tests, use:

```
npm test
```

## License

This package is licensed under the MIT License.
