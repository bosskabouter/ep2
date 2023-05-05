# [`EP2Push`](./packages/push/)

## Installation

```bash
npm i @ep2/push
```

## Introduction

This package provides utilities for sending and receiving encrypted push messages between browsers without revealing any unnecessary information to any party. It is part of the

## Usage

```typescript
const key = await EP2Key.create();
const offlineClient = await EP2Push.register(key, {
  path: "/push",
  publicKey: "",
  vapidKey: "YOUR VAPID PUB KEY",
  host: "ep2.push.host",
});
const shareSubscription = offlineClient?.sharedSubscription;

//share your subscription, or push yourself
offlineClient?.pushText(
  { body: "Knock knock. Who is there?", vibrate: [2000, 1000, 2000] },
  key.peerId,
  shareSubscription
);
```

`EP2Push.register` registers a `ServiceWorker` to receive and decrypt push messages, gets a `PushSubscription` from the browser, and makes it shareable by encrypting it with the public key of the relay server. It can then send `NotificationOptions` to other peers that have shared their encrypted subscription. Only the registered [**`EP2PushServer`**](../pushserver/) is able to decrypt the endpoint and relay the payload to the client where it is decrypted by the destination `EP2Push` client.

### Offline libraries (Peer 2 Push)

_`@ep2/offline-_`\* packages can be
The offline packages are independent of the online packages. The key core components are included and don't need to be installed separately.
