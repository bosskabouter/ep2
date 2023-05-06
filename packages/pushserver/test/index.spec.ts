import request from "supertest";
import {
  EP2Key,
  type AsymmetricallyEncryptedMessage,
  type SymmetricallyEncryptedMessage,
} from "@ep2/key";

import express from "express";

import TEST_PUSH from "./push-subscription.spec.json";

import publicContent from "../src/app.json";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { type EP2PushMessage, type EP2PushRequest } from "../src/types";
import webpush from "web-push";
import { EP2PushServer, ExpressEP2PushServer } from "../src";

webpush.sendNotification = jest.fn().mockResolvedValue({
  statusCode: 200,
  headers: {},
  body: "OK",
});
jest.genMockFromModule<typeof webpush>("web-push");

const TEST_PORT = 2000 + Math.floor(Math.random() * 5000);

jest.mock("web-push", () => ({
  sendNotification: undefined,
  setVapidDetails: jest.fn(),
}));
describe("EP2Push", () => {
  let serverKey: EP2Key;
  let pusherKey: EP2Key;
  let pushedKey: EP2Key;

  let app: express.Express;
  let server: Server<typeof IncomingMessage, typeof ServerResponse>;

  const mockPushSubscription: PushSubscription = TEST_PUSH as any;

  let encryptedEndpoint: SymmetricallyEncryptedMessage<any>;

  beforeAll(async () => {
    app = express();

    serverKey = await EP2Key.create();
    pusherKey = await EP2Key.create();
    pushedKey = await EP2Key.create();

    encryptedEndpoint = pusherKey.encryptSymmetrically(
      serverKey.peerId,
      mockPushSubscription
    );

    server = app.listen(TEST_PORT, () => {
      const sps = EP2PushServer(serverKey, { port: TEST_PORT + 2 });
      expect(sps).toBeDefined();
      app.use("/", sps);
    });
  });
  afterEach(() => {
    // jest.resetAllMocks()
  });

  afterAll((done) => {
    server.unref();
    jest.resetModules();
    server.closeAllConnections();
    server.close(done);
  });

  test("POST /send should send a notification", async () => {
    const encryptedPayload: SymmetricallyEncryptedMessage<NotificationOptions> =
      EP2Key.encrypt(pushedKey.peerId, { data: "Hello from Pusher" });

    const { secureChannel, handshake } = pusherKey.initiateHandshake(
      serverKey.peerId
    );

    const encryptedPushMessages: AsymmetricallyEncryptedMessage<
      EP2PushMessage[]
    > = secureChannel.encrypt([
      {
        encryptedEndpoint,
        encryptedPayload,
      },
    ]);

    const wpr: EP2PushRequest = {
      encryptedPushMessages,
      handshake,
      senderId: pusherKey.peerId,
    };
    const response = await request(app).post("/ep2push").send(wpr);
    expect(response).toBeDefined();
    expect(response.error).toBeFalsy();
    expect(response.status).toBeTruthy();

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      mockPushSubscription,
      Buffer.from(JSON.stringify(encryptedPayload)),
      { TTL: 60000 }
    );
  });

  test("POST /send should return HTTP_ERROR_PUSH_TOO_BIG if the payload is too big", async () => {
    const encryptedPayload: SymmetricallyEncryptedMessage<NotificationOptions> =
      EP2Key.encrypt(pushedKey.peerId, { data: "a".repeat(4097) });

    const { secureChannel, handshake } = pusherKey.initiateHandshake(
      serverKey.peerId
    );

    const encryptedPushMessages: AsymmetricallyEncryptedMessage<
      EP2PushMessage[]
    > = secureChannel.encrypt([
      {
        encryptedEndpoint,
        encryptedPayload,
      },
    ]);

    const wpr: EP2PushRequest = {
      encryptedPushMessages,
      handshake,
      senderId: pusherKey.peerId,
    };
    const response = await request(app).post("/ep2push").send(wpr);
    expect(response).toBeDefined();
    expect(response.error).toBeTruthy();
    expect(response.status).toBe(500);
    expect(response.text).toBe(
      "Error: Refusing push too big: 5689 bytes. Max size: 4000 bytes."
    );
  });

  test("should get public content", async () => {
    const resp = await request(app).get("/ep2push");
    expect(resp).toBeDefined();
    expect(resp.error).toBeFalsy();
    expect(resp.body).toMatchObject(publicContent);
  });

  test("should get test", async () => {
    const resp = await request(app).get("/ep2push/test");
    expect(resp).toBeDefined();
    expect(resp.error).toBeFalsy();
  });
});

// describe('options', () => {
//   let serverKey: EP2Key
//   // let pusherKey: EP2Key
//   // let pushedKey: EP2Key

//   let app: express.Express
//   let server: Server<typeof IncomingMessage, typeof ServerResponse>

//   // const mockPushSubscription: PushSubscription = TEST_PUSH as any

//   // let encryptedEndpoint: SymmetricallyEncryptedMessage<PushSubscription>

//   beforeAll(async () => {
//     app = express()

//     serverKey = await EP2Key.create()
//     // pusherKey = await EP2Key.create()
//     // pushedKey = await EP2Key.create()

//     // encryptedEndpoint = pusherKey.encryptSymmetrically(serverKey.peerId, mockPushSubscription)

//     server = app.listen(TEST_PORT, () => {
//       const sps = ExpressOfflineServer(serverKey, VAPID_KEYS, {} as Server<typeof IncomingMessage, typeof ServerResponse>, { port: (TEST_PORT + 1) })
//       expect(sps).toBeDefined()
//       app.use('/', sps)
//     })
//   })
//   afterEach(() => {
//     // jest.resetAllMocks()
//   })

//   afterAll((done) => {
//     server.unref()
//     jest.resetModules()

//     server.close(done)
//   })

// })

describe("undefined server", () => {
  test("should not create an app without server", async () => {
    const app = ExpressEP2PushServer(
      await EP2Key.create(),
      null as any
    );
    expect(() => app.emit("mount", express())).toThrow(
      "Server is not passed to constructor"
    );
  });
});
