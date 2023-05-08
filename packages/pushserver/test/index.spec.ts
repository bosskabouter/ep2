import request from "supertest";
import {
  AsymmetricallyEncryptedMessage,
  EP2Key,
  // type AsymmetricallyEncryptedMessage,
  type SymmetricallyEncryptedMessage,
} from "@ep2/key";

import express from "express";

import publicContent from "../src/app.json";
// import type { IncomingMessage, Server, ServerResponse } from "http";
import webpush from "web-push";
import { EP2PushServer, ExpressEP2PushServer } from "../src";
import {
  // EP2PushAuthorization,
  // EP2PushMessage,
  // EP2PushMessageRequest,
  // EP2PushRequest,
  EP2PushVapidResponse,
  EP2PushVapidRequest,
  EP2PushAuthorization,
  EP2PushMessageRequest,
  EP2PushMessage,
} from "@ep2/push";

import TEST_PUSH_SUBSCRIPTION from "./push-subscription.spec.json";

const TEST_PORT = 2000 + Math.floor(Math.random() * 5000);

let serverKey: EP2Key;
let pusherKey: EP2Key;
let pushedKey: EP2Key;
let app: express.Express;
let server: any;

const mockPushSubscription: PushSubscription = TEST_PUSH_SUBSCRIPTION as any;

webpush.sendNotification = jest.fn().mockResolvedValue({
  statusCode: 200,
  headers: {},
  body: "OK",
});

beforeAll(async () => {
  serverKey = await EP2Key.create();
  expect(serverKey).toBeDefined();
  pusherKey = await EP2Key.create();
  pushedKey = await EP2Key.create();
  expect(pushedKey).toBeDefined();

  app = express();
  server = app.listen(TEST_PORT, () => {
    const ep2PushServer = ExpressEP2PushServer(serverKey, server, {
      port: TEST_PORT,
    });
    expect(ep2PushServer).toBeDefined();
    app.use("/", ep2PushServer);
  });
});

afterAll((done) => {
  server.unref();
  jest.resetModules();
  server.closeAllConnections();
  server.close(done);
});

describe("EP2Push - 1. Prepare Authorization", () => {
  let encryptedEndpoint: SymmetricallyEncryptedMessage<any>;
  beforeAll(async () => {
    encryptedEndpoint = pusherKey.encryptSymmetrically(
      serverKey.peerId,
      mockPushSubscription
    );

    expect(encryptedEndpoint).toBeDefined();
  });

  afterAll(() => {
    jest.resetModules();

  });

  describe("1. EP2PushVapidRequest", () => {
    beforeAll(async () => {});

    test("should Fail: pushed too much payload ", () => {
      //PLEASE IMPLEMENT
    });
    test("Should Push", async () => {
      const { secureChannel, handshake } = pusherKey.initiateHandshake(
        serverKey.peerId
      );

      const vapidRequest: EP2PushVapidRequest = {
        path: "/vapid",
        handshake,
        peerId: pusherKey.peerId,
      };

      const resp = await request(app).post("/ep2push/vapid").send(vapidRequest);

      expect(resp).toBeDefined();
      expect(resp.error).toBeFalsy();

      const pushVapidResponse: EP2PushVapidResponse = secureChannel.decrypt(
        resp.body
      );
      expect(pushVapidResponse).toBeDefined();

      const encryptedVapidKeys = pushVapidResponse.encryptedVapidKeys;
      expect(encryptedVapidKeys).toBeDefined();

      const vapidPublicKey = pushVapidResponse.vapidPublicKey;
      expect(vapidPublicKey).toBeDefined();

      let authorization: EP2PushAuthorization;

      const encryptedPushSubscription: SymmetricallyEncryptedMessage<PushSubscription> =
        pushedKey.encryptSymmetrically(
          serverKey.peerId,
          TEST_PUSH_SUBSCRIPTION as any as PushSubscription
        );

      authorization = {
        encryptedPushSubscription,
        encryptedVapidKeys,
      };
      expect(authorization).toBeDefined();

      let pushMessageRequest: EP2PushMessageRequest;

      const notificationOptions: NotificationOptions = {
        data: "Hello, World!",
        vibrate: [1000, 1500, 2000, 2500],
      };
      const encryptedNotificationOptions: SymmetricallyEncryptedMessage<NotificationOptions> =
        EP2Key.encrypt(pushedKey.peerId, notificationOptions);
      const pushMessage: EP2PushMessage = {
        authorization,
        encryptedNotificationOptions,
      };

      const encryptedPushMessage: AsymmetricallyEncryptedMessage<EP2PushMessage> =
        secureChannel.encrypt(pushMessage);
      pushMessageRequest = {
        encryptedPushMessage,
        handshake,

        peerId: pusherKey.peerId,
        path: "/push",
      };

      expect(pushMessageRequest).toBeDefined();

      const response = await request(app)
        .post("/ep2push/push")
        .send(pushMessageRequest);
      expect(response).toBeDefined();
      expect(response.text).not.toContain("Error");
      expect(response.error).toBeFalsy();
      expect(response.status).toBeTruthy();
    });
  });


  test("should get public content", async () => {
    const resp = await request(app).get("/ep2push");
    expect(resp).toBeDefined();
    expect(resp.error).toBeFalsy();
    expect(resp.body).toMatchObject(publicContent);
  });

  test("should get test page", async () => {
    const resp = await request(app).get("/ep2push/test");
    expect(resp).toBeDefined();
    expect(resp.error).toBeFalsy();
    expect(resp.text).toContain("<h1>EP²Push - Test</h1>");
  });

});

test("should Create simple server", (done) => {
  const simpleServer = EP2PushServer(
    serverKey,
    { port: TEST_PORT + 2 },
    (server) => {
      expect(server).toBeDefined();
      server.close(done);
    }
  );

  expect(simpleServer).toBeDefined();
});

// test("POST /send should send a notification", async () => {
//   const encryptedNotificationOptions: SymmetricallyEncryptedMessage<NotificationOptions> =
//     EP2Key.encrypt(pushedKey.peerId, { data: "Hello from Pusher" });

//   const { secureChannel, handshake } = pusherKey.initiateHandshake(
//     serverKey.peerId
//   );

//   const authorization: EP2PushAuthorization = {
//     encryptedPushSubscription: undefined,
//     encryptedVapidKeys: undefined,
//   };

//   const pushMessage: EP2PushMessage = {
//     authorization: authorization,
//     encryptedNotificationOptions,
//   };

//   const encryptedPushMessage: AsymmetricallyEncryptedMessage<EP2PushMessage> =
//     pusherKey.encrypt(pushedKey.peerId, pushMessage);

//   const wpr: EP2PushMessageRequest = {
//     handshake,
//     encryptedPushMessage,
//     peerId: pushedKey.peerId,
//     path: "/push",
//   };
//   const response = await request(app).post("/ep2push").send(wpr);
//   expect(response).toBeDefined();
//   expect(response.error).toBeFalsy();
//   expect(response.status).toBeTruthy();

//   expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
//   expect(webpush.sendNotification).toHaveBeenCalledWith(
//     mockPushSubscription,
//     Buffer.from(JSON.stringify(encryptedPayload)),
//     { TTL: 60000 }
//   );
// });

// test("POST /send should return HTTP_ERROR_PUSH_TOO_BIG if the payload is too big", async () => {
//   const encryptedPayload: SymmetricallyEncryptedMessage<NotificationOptions> =
//     EP2Key.encrypt(pushedKey.peerId, { data: "a".repeat(4097) });

//   const { secureChannel, handshake } = pusherKey.initiateHandshake(
//     serverKey.peerId
//   );

//   const encryptedPushMessages: AsymmetricallyEncryptedMessage<
//     EP2PushMessage[]
//   > = secureChannel.encrypt([
//     {
//       encryptedEndpoint,
//       encryptedPayload,
//     },
//   ]);

//   const wpr: EP2PushRequest = {
//     encryptedPushMessages,
//     handshake,
//     senderId: pusherKey.peerId,
//   };
//   const response = await request(app).post("/ep2push").send(wpr);
//   expect(response).toBeDefined();
//   expect(response.error).toBeTruthy();
//   expect(response.status).toBe(500);
//   expect(response.text).toBe(
//     "Error: Refusing push too big: 5689 bytes. Max size: 4000 bytes."
//   );
// });

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
    const app = ExpressEP2PushServer(await EP2Key.create(), null as any);
    expect(() => app.emit("mount", express())).toThrow(
      "Server is not passed to constructor"
    );
  });
});
