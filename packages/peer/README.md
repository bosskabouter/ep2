# [`EP2Peer`](./packages/peer)

## Introduction

`EP2Peer` is part of [ep² - encrypted online & offline p2p](../../), extends [peerjs](https://github.com/peers/peerjs) and adds a `SecureLayer` for encrypted communication between peers.

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
onlineClient.on;
```
