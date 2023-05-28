# ep² - encrypted P2P [online & offline]

**_ep2_** is a Typescript library that enables **secure peer-to-peer communication** between **browsers**, both **online and offline**. It uses the [libsodium](https://github.com/jedisct1/libsodium.js) library for hybrid encryption and signature verification between online peers using [peerjs](https://github.com/peers) and the [web-push](https://github.com/web-push-libs/web-push) library for encrypted push messaging between offline peers.

## Getting started

To try out ep2, clone the project and start an example server and client using the following commands:

```bash
git clone https://github.com/bosskabouter/ep2.git
cd ep2
npm i
npm start
```

## Packages

The ep2 library consists of the following packages:

- Client packages:
  - [EP2Peer](./packages/peer/) - encrypted P2P `WebRTC` client
  - [EP2Push](./packages/push/) - encrypted `PushSubscription`/`Notification` client
- Server packages:
  - [EP2PeerServer](/packages/peerserver/) - authentication `WebRTC Signaling` server
  - [EP2PushServer](/packages/pushserver/) - anonymized `Push Endpoint Relay` server
- Key encryption packages
  - [EP2Key](/packages/key/) - the core component, already included in client and server packages
  - [EP2KeyBIP](/packages/key-bip/) - BIP32 HD Key and BIP39 mnemonic recovery phrase

For detailed information about each package, see their respective pages.

## Usage: In short

### An example Push and Peer client

```typescript
import { EP2Peer, EP2Key } from "@ep2/peer";
import { EP2Push } from "@ep2/push";

EP2Key.create('*strong* seed').then(async (key) => {
  const ep2Push = await EP2Push.register(key);
  const ep2Peer = new EP2Peer(key);


});
```

### An example Push and Peer server

````typescript

import {EP2PeerServer, EP2Key} from '@ep2/peerserver'
import {EP2PushServer} from '@ep2/pushserver'

EP2Key.create('*stronger* seed').then( key => {
   EP2PushServer(key, { path: "/myPushServer" });
   EP2PeerServer(key, { path: "/myPeerServer" })
 })

````

## Contributions

Contributions to this project are welcome! If you would like to contribute, please open an issue or pull request on the [GitHub repository](https://github.com/bosskabouter/ep2).

## License

ep2 is open-source software licensed under the [MIT license](./LICENSE).
