# [`EP2PeerServer`](./packages/peerserver) (optional)

## Introduction

This package extends the [peerjs server](https://github.com/peers/peerjs-server) library, adding identity verification for connecting clients. Online clients can choose to connect to any normal peer server and rely on the `SecureChannel` between peers, but this server prevents clients from using any ID without first verifying a secure handshake.

## Installation

```bash
npm i @ep2/peerserver
```

```typescript
import {EP2Peer} from '@ep2/peerserver'
EP2PeerServer(await EP2Key.create("some seed value"), {});
```

## Configuration

The configuration is identical to that of the original peerserver. Please refer to [their documentation](https://github.com/peers/peerjs-server) for details. The only exception is generateClientIds, which does not make sense in this context and is ignored if configured.
