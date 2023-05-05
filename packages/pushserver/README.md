
# [`EP2PushServer`](./packages/pushserver/)

The `EP2PushServer` package creates an `Express` app with a request handler capable of **_`relaying`_** encrypted push messages between peers. It has a configuration similar to that of the [_`EP2Peer`_](#onlineserver-optional) package.

To start a server, you can call;

```typescript
EP2PushServer(await EP2Key.create("some seed value"), {
  keys: VAPID_KEYS,
  subject: "mailto:test@test.com",
});
```

An [**`EP2Push`**](#offlineclient) making a request to send an encrypted message, the request must contain the client's handshake, the message, and its endpoint. The endpoint is encrypted using the public key of the relay server and then decrypted by the offline client to retrieve the payload.
