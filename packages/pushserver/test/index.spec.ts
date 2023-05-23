import request from "supertest";

import express from "express";

import publicContent from "../src/app.json";
// import type { IncomingMessage, Server, ServerResponse } from "http";
import webpush from "web-push";
import {
  EP2Anonymized,
  EP2PushServer,
  ExpressEP2PushServer,
  // EP2PushAuthorization,
  // EP2PushAuthorization,

  // EP2PushMessageRequest,
  // EP2PushRequest,

  // EP2PushVapidRequest,
  // EP2PushAuthorization,
  // EP2PushMessageRequest,
  // EP2PushMessage,
} from "../src";

import TEST_PUSH_SUBSCRIPTION from "./push-subscription.spec.json";
import { EP2Key, EP2Sealed } from "@ep2/key";
import {
  EP2PushAuthorization,
  EP2PushMessageRequest,
  EP2PushVapidResponse,
  EP2PushMessage,
} from "@ep2/push";
import { HTTP_ERROR_PUSH_TOO_BIG } from "../src/api/v1/public";

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
  expect(pusherKey).toBeDefined();
  pushedKey = await EP2Key.create();
  expect(pushedKey).toBeDefined();
  expect(mockPushSubscription).toBeDefined();
  app = express();
  server = app.listen(TEST_PORT, () => {
    const ep2PushServer = ExpressEP2PushServer(serverKey, server, {
      port: TEST_PORT,
    });
    expect(ep2PushServer).toBeDefined();
    app.use("/", ep2PushServer);
  });

  server.on("error", console.error);
  app.on("error", console.error);
});

afterAll((done) => {
  server.unref();
  jest.resetModules();
  server.closeAllConnections();
  server.close(done);
});

describe("EP2PushServer", () => {
  describe("PushRequest", () => {
    const getVapidResponse: () => Promise<EP2PushVapidResponse> = async () => {
      const resp = await request(app)
        .post("/ep2push/vapid")
        // .set("Content-Type", "application/text")
        .send({ id: pushedKey.id });

      expect(resp).toBeDefined();
      expect(resp.error).toBeFalsy();

      expect(resp.body).toBeDefined();

      let anonymizedVapidResponse: EP2Anonymized<EP2PushVapidResponse> =
        resp.body;
      await EP2Anonymized.revive(anonymizedVapidResponse);

      return anonymizedVapidResponse.decrypt(pushedKey, serverKey.id);
    };
    const mockEncryptedPushSubscription: () => EP2Sealed<PushSubscription> =
      () => {
        return pushedKey.seal(mockPushSubscription, serverKey.id);
      };

    const mockAuthorization: () => Promise<EP2PushAuthorization> = async () => {
      const vapidResponse = await getVapidResponse();
      const anonymizedVapidKeys = vapidResponse.encryptedVapidKeys;
      const sealedPushSubscription = mockEncryptedPushSubscription();

      return {
        anonymizedVapidKeys,
        sealedPushSubscription,
      } as EP2PushAuthorization;
    };

    const mockPushMessageRequest: (
      b: boolean
    ) => Promise<EP2PushMessageRequest> = async (b) => {
      let body = "Read the body";
      if (b) body = body.repeat(1000);
      const notificationOptions: NotificationOptions = {
        actions: [{ action: "", title: "Open Me" }],
        body,
        vibrate: [1000, 1000, 3000],
      };

      const a = await mockAuthorization();
      const cno = pusherKey.cloak(notificationOptions, pushedKey.id);
      const message: EP2PushMessage = { a, cno };
      const peerId = pusherKey.id;
      const pushMessageRequest: EP2PushMessageRequest = { peerId, message };
      return pushMessageRequest;
    };

    let authorization: EP2PushAuthorization;
    beforeAll(async () => {
      authorization = await mockAuthorization();
      expect(authorization).toBeDefined();
    });

    test("should Push", async () => {
      const push: EP2PushMessageRequest = await mockPushMessageRequest(false);
      expect(push).toBeDefined();
      const response = await request(app).post("/ep2push/push").send(push);
      expect(response).toBeDefined();
      expect(response.text).not.toContain("Error");
      expect(response.error).toBeFalsy();
      expect(response.status).toBeTruthy();
    });

    test("should reject - payload too big", async () => {
      const push: EP2PushMessageRequest = await mockPushMessageRequest(true);
      expect(push).toBeDefined();

      const response = await request(app).post("/ep2push/push").send(push);
      expect(response).toBeDefined();
      expect(response.text).toContain('Insufficient Storage');
      expect(response.error.toString()).toContain(HTTP_ERROR_PUSH_TOO_BIG.toString());
      expect(response.status).toBeTruthy();
    });
    //   const encryptedVapidKeys = pushVapidResponse.encryptedVapidKeys;
    //   expect(encryptedVapidKeys).toBeDefined();

    //   const vapidPublicKey = pushVapidResponse.vapidPublicKey;
    //   expect(vapidPublicKey).toBeDefined();

    //   let authorization: EP2PushAuthorization;

    //   const encryptedPushSubscription: SymmetricallyEncryptedMessage<PushSubscription> =
    //     pushedKey.encryptSymmetrically(
    //       serverKey.id,
    //       TEST_PUSH_SUBSCRIPTION as any as PushSubscription
    //     );

    //   authorization = {
    //     encryptedPushSubscription,
    //     encryptedVapidKeys,
    //   };
    //   expect(authorization).toBeDefined();

    //   let pushMessageRequest: EP2PushMessageRequest;

    //   const notificationOptions: NotificationOptions = {
    //     data: "Hello, World!",
    //     vibrate: [1000, 1500, 2000, 2500],
    //   };
    //   const encryptedNotificationOptions: SymmetricallyEncryptedMessage<NotificationOptions> =
    //     EP2Key.encrypt(pushedKey.id, notificationOptions);
    //   const pushMessage: EP2PushMessage = {
    //     authorization,
    //     encryptedNotificationOptions,
    //   };

    //   const encryptedPushMessage: AsymmetricallyEncryptedMessage<EP2PushMessage> =
    //     secureChannel.encrypt(pushMessage);
    //   pushMessageRequest = {
    //     payload: pushMessageRequest,
    //     peerId: pusherKey.id,
    //     path: "/push",
    //   };

    //   expect(pushMessageRequest).toBeDefined();

    //   const response = await request(app)
    //     .post("/ep2push/push")
    //     .send(pushMessageRequest);
    //   expect(response).toBeDefined();
    //   expect(response.text).not.toContain("Error");
    //   expect(response.error).toBeFalsy();
    //   expect(response.status).toBeTruthy();
    // });

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
    //     EP2Key.encrypt(pushedKey.id, { data: "Hello from Pusher" });

    //   const { secureChannel, handshake } = pusherKey.initiateHandshake(
    //     serverKey.id
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
    //     pusherKey.encrypt(pushedKey.id, pushMessage);

    //   const wpr: EP2PushMessageRequest = {
    //     handshake,
    //     encryptedPushMessage,
    //     id: pushedKey.id,
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
    //     EP2Key.encrypt(pushedKey.id, { data: "a".repeat(4097) });

    //   const { secureChannel, handshake } = pusherKey.initiateHandshake(
    //     serverKey.id
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
    //     senderId: pusherKey.id,
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

    //     // encryptedEndpoint = pusherKey.encryptSymmetrically(serverKey.id, mockPushSubscription)

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

    test("should Fail: pushed too much payload ", () => {
      //PLEASE IMPLEMENT
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

    test("should get test vapid keys", async () => {
      const resp = await request(app).post("/ep2push/test");
      expect(resp).toBeDefined();
      expect(resp.error).toBeFalsy();
      expect(resp.text).toContain("publicKey");
      expect(resp.text).toContain("privateKey");
    });
  });
});
