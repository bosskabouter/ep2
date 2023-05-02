# ep² - encrypted P2P - online & offline
>

***ep2*** is a Typescript library that provides secure **`peer-to-peer`** communication between browsers, both ***`online`*** and ***`offline`***

 It uses the [libsodium](https://github.com/jedisct1/libsodium.js) library for hybrid encryption and signature verification between online [peers](https://github.com/peers), and the  [web-push](https://github.com/web-push-libs/web-push) library for encrypted push messaging between offline peers.

## Getting started

To try out ep2, you can clone the project and start an example server and client using the following commands:

```bash
git clone https://github.com/bosskabouter/ep2.git
cd ep2
npm i
npm start
```

## Packages

The ep2 library consists of several packages, including a core encryption component, online and offline client and server packages, and an optional BIP32 and BIP39 key package. [EP2Key](#ep2key) core components are included in all client and server libraries;

``` bash
#client libraries
npm i @ep2/online-client
npm i @ep2/offline-client

#server libraries
npm i @ep2/online-server
npm i @ep2/offline-server

#shared libraries (already included)
npm i @ep2/key
#optional bip32 & bip39 key
npm i @ep2/key-bip
```

### Online libraries (Peer 2 Peer)

*`@ep2/online-*`* libraries are extensions of [PeerJS](https://github.com/peers/) and accept the same configuration options accepted by those libraries (accept generateClientId), both on [server](https://github.com/peers/peerjs-server#config--cli-options) as well as on the [client](https://peerjs.com/docs/#peer-options) side.

#### [`OnlineClient`](./packages/online-client)

`OnlineClient` is an extension of [peerjs client](https://github.com/peers/peerjs) and adds a `SecureLayer` for encrypted communication between peers.

 ``` typescript
const somePeerId = "cfc3e61a6faca1f4667d7..."
const serverId = "aca1f4667d7cfc3e61a6f..."
const myKey = await EP2Key.create()

const onlineClient = new OnlineClient(myKey, serverId)
const secureLayer = onlineClient.connectSecurely(somePeerId)
secureLayer.send('Hi Peer')
secureLayer.on('decrypted',(msg) => { console.log(msg) })
onlineClient.on
```

#### [`OnlineServer`](./packages/online-server) (optional)

This package extends the [peerjs server](https://github.com/peers/peerjs-server) library, adding identity verification for connecting clients. Online clients can choose to connect to any normal peer server and rely on the `SecureChannel` between peers, but this server prevents clients from using any ID without first verifying a secure handshake.

``` typescript
OnlineServer(await EP2Key.create('some seed value'))
```

### Offline libraries (Peer 2 Push)

*`@ep2/offline-*`* packages can be used to retrieve, encrypt, share, and send push subscriptions and notifications between peers without revealing any unnecessary information to any party.

The offline packages are independent of the online packages. The key core components are included and don't need to be installed separately.

#### [`OfflineClient`](./packages/offline-client/)

This package provides utilities for sending and receiving encrypted push messages between browsers.

```typescript
const key = await EP2Key.create()
const offlineClient = await OfflineClient.register(key,
    {
    path: "/push",
    publicKey: "",
    vapidKey: "YOUR VAPID PUB KEY",
    host: "ep2.push.host"
    })
const shareSubscription = offlineClient?.sharedSubscription

//share your subscription, or push yourself
offlineClient?.pushText({ body: "Knock knock. Who is there?", vibrate: [2000, 1000, 2000] }, key.peerId, shareSubscription)
```

It registers a `service worker` to receive and decrypt push messages, gets a subscription from the browser, and makes it shareable by encrypting it with the public key of the relay server. It can then send `NotificationOptions` to other peers that have shared their `encrypted subscription`. Only a [**`OfflineServer`**](#offlineserver), is able to decrypt the endpoint and relay the payload to the client where it is decrypted by the destination `OfflineClient`.

#### [`OfflineServer`](./packages/offline-server/)

The `OfflineServer` package creates an `Express` app with a request handler capable of ***`relaying`*** encrypted push messages between peers. It has a configuration similar to that of the [*`OnlineServer`*](#onlineserver-optional) package.

To start a server, you can call;

``` typescript
OfflineServer(await EP2Key.create('some seed value'), {keys:VAPID_KEYS, subject:"mailto:test@test.com"} )
```

An [**`OfflineClient`**](#offlineclient) making a request to send an encrypted message, the request must contain the client's handshake, the message, and its endpoint. The endpoint is encrypted using the public key of the relay server and then decrypted by the offline client to retrieve the payload.

### [@ep2/key](./packages/key)

***@ep2/key*** is a core component of the ep2 library, providing modules for generating and managing asymmetric encryption keys and using them to secure communication channels through `AsymmetricallyEncryptMessage<T>` over a `SecureChannel`. It also enables symmetric public key encryption for anonymous message relaying using `SymmetricallyEncryptMessage<T>`.

### API

``` typescript
describe('API', () => {

    let keyA: EP2Key
    let keyB: EP2Key
    beforeAll(async () => {
        keyA = await EP2Key.create()
        keyB = await EP2Key.create('some strong seed')
        expect(keyB.peerId).toContain('0ba1f4667d7cfc3e61a6fac75')
    })

    test('Encrypt between known public keys', () => {
        const m = 'Hi, you know me!'
        const a2b: AsymmetricallyEncryptedMessage<string> = keyA.encrypt(keyB.peerId, m)
        expect(keyB.decrypt(keyA.peerId, a2b)).toBe(m)
    })

    test('Encrypt from unknown for known recipient', () => {
        const m = { myObject: 'Who am I?' }
        const u4a = EP2Key.encrypt(keyA.peerId, m) 
        // or key2.encryptSymmetrically(key.peerId, msg) 
        expect(keyA.decryptSymmetrically(u4a)).toEqual(m)
    })
})
```

### [BIP Key](./packages/key-bip) (optional)

Extension of [SecurePeerKey](#ep2key) adds `BIP32` (HD wallets) and `BIP39` (mnemonic seed word list) functionality to the key.
