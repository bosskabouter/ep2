# ep² - encrypted P2P [online & offline]

>

**_ep2_** is a Typescript library that provides secure **`peer-to-peer`** communication between browsers, both **_`online`_** and **_`offline`_**.

It uses the [libsodium](https://github.com/jedisct1/libsodium.js) library for hybrid encryption and signature verification between online peers using [peerjs](https://github.com/peers), and the [web-push](https://github.com/web-push-libs/web-push) library for encrypted push messaging between offline peers.

## Getting started

To try out ep2, you can clone the project and start an example server and client using the following commands:

```bash
git clone https://github.com/bosskabouter/ep2.git
cd ep2
npm i
npm start
```

## Packages

The ep2 library consists of several packages, including

- Client libraries
  - [EP2Peer](./packages/peer/) - Online RTC client
  - [EP2Push](./packages/push/) - Notification / subscription client
- Server libraries
  - [EP2PeerServer](/packages/peerserver/) - PeerJS Signaling server
  - [EP2PushServer](/packages/pushserver/) - WebPush Relay server
- [EP2Key](/packages/key/) core encryption component [*](#*)
- [EP2KeyBIP](/packages/key-bip/) BIP32 and BIP39 key package.

#### * Included in client and server libraries

## Installation

```bash
# client libraries
npm i @ep2/peer
npm i @ep2/push

# server libraries
npm i @ep2/peerserver
npm i @ep2/pushserver

# shared libraries (already included)
npm i @ep2/key
# optional bip32 & bip39 key
npm i @ep2/key-bip
```

## Client libraries

See each package page inside for detailed information about that package.
