import axios from "axios";
import {
  EP2Push,
  EP2PushMessage,
  // EP2PushConfig,
  // updateEP2ServiceWorker,
  EP2PushVapidResponse,
  EP2Sealed,
  EP2PushAuthorization,
  updateEP2ServiceWorker,
  // EP2PushConfig,
} from "../src";
// import { EP2PushServiceWorker, addServiceWorkerHandle } from "../src/swutil";

import TEST_VAPID_KEYS from "./vapid-keys.spec.json";
import { EP2Key, EP2Anonymized, EP2Cloaked } from "@ep2/key";

import TEST_PUSH_SUBSCRIPTION from "./push-subscription.spec.json";
import { EP2PushServiceWorker, addServiceWorkerHandle } from "../src/swutil";

jest.mock("axios");

// const mockPushSubscription: PushSubscription = JSON.parse(
//   JSON.stringify({
//     endpoint: "https://example.com/push/1234",
//     expirationTime: null,
//     keys: {
//       p256dh: "P256DH_PUBLIC_KEY",
//       auth: "AUTH_SECRET_KEY",
//     },
//   })
// );

describe("VAPID request", () => {
  let pusherKey: EP2Key;
  let serverKey: EP2Key;
  let pushedKey: EP2Key;
  let encryptedVapidKeys: EP2Anonymized<{
    privateKey: string;
    publicKey: string;
  }>;
  // server response with encrypted vapid key pair + plain text vapid public key for user to subscribe `ServiceWorker.PushManager` to
  let vapidResponse: EP2PushVapidResponse;
  //encrypted response to client
  let cloakedVapidResponse: EP2Cloaked<EP2PushVapidResponse>;

  beforeAll(async () => {
    pusherKey = await EP2Key.create();

    pushedKey = await EP2Key.create();
    serverKey = await EP2Key.create();

    //server encrypted vapid keys for itself
    encryptedVapidKeys = serverKey.anonymize(
      TEST_VAPID_KEYS.keys,
      serverKey.id
    );
    vapidResponse = {
      encryptedVapidKeys,
      vapidPublicKey: TEST_VAPID_KEYS.keys.publicKey,
    };
    cloakedVapidResponse = serverKey.cloak(vapidResponse, pushedKey.id);

    (axios.post as jest.Mock).mockImplementation(
      async () =>
        await Promise.resolve({ status: 200, data: cloakedVapidResponse })
    );
  });

  describe("Push Request", () => {});
  let pushMessage: EP2PushMessage;

  const notificationOptions: NotificationOptions = {};

  // let config: EP2PushConfig;

  let pushSubscription: PushSubscription =
    TEST_PUSH_SUBSCRIPTION as unknown as PushSubscription;

  let a: EP2PushAuthorization;

  let encryptedPushSubscription: EP2Sealed<PushSubscription>;

  beforeAll(async () => {
    // config = {
    //   ep2PublicKey: serverKey.id,
    //   port: 9001,
    //   secure: false,
    //   host: "testHost",
    //   path: "testPath",
    // };
    pushedKey = await EP2Key.create();

    encryptedPushSubscription = pushedKey.seal(pushSubscription, serverKey.id);

    a = {
      sealedPushSubscription: encryptedPushSubscription,
      anonymizedVapidKeys: vapidResponse.encryptedVapidKeys,
    };
    const cno = pusherKey.cloak(notificationOptions, pushedKey.id);
    pushMessage = { a, cno };

    expect(pushMessage).toBeDefined();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("pushMessage", () => {
    test("should return true when axios post succeeds", async () => {
      (axios.post as jest.Mock).mockImplementationOnce(
        async () => await Promise.resolve({ status: 200 })
      );

      const ep2push = new EP2Push(a, pusherKey, "/push");
      const result = await ep2push.pushText(
        notificationOptions,
        pushedKey.id,
        a
      );
      expect(result).toBe(true);
    });

    test("should register", async () => {
      (axios.post as jest.Mock).mockImplementationOnce(
        async () => await Promise.resolve({ status: 200, data: vapidResponse })
      );
      Object.defineProperty(global, "navigator", {
        value: {
          serviceWorker: {
            getRegistration: jest.fn().mockResolvedValue({
              pushManager: {
                subscribe: jest
                  .fn()
                  .mockResolvedValue({ endpoint: "mockEndpoint" }),
              },
            }),
          },
        },
        writable: true,
      });

      const pusher = await EP2Push.register(pusherKey);
      expect(pusher).toBeDefined();
    });
  });
});

// describe("getSharedSubscription", () => {
//   test("should return the encrypted pushSubscription", () => {
//     const offlineClient = new EP2Push(mockPushSubscription, pusherKey, config);
//     expect(offlineClient.sharedSubscription).toBeDefined();
//   });
// });

describe("register", () => {
  let mockSecureKey: EP2Key;
  // let mockServerKey: EP2Key;
  // let mockServerConfig: EP2PushConfig;

  beforeAll(async () => {
    mockSecureKey = await EP2Key.create();
    // mockServerKey = await EP2Key.create();
    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: {
          getRegistration: jest.fn().mockResolvedValue(undefined),
          pushManager: {
            subscribe: jest
              .fn()
              .mockResolvedValue({ endpoint: "mockEndpoint" }),
          },
        },
      },
      writable: true,
    });
    // mockServerConfig = {
    //   host: "hostname",
    //   path: "/push",
    //   ep2PublicKey: mockServerKey.id,
    //   port: 9001,
    //   secure: false,
    // };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // it("should return undefined if service worker registration is undefined", async () => {
  //   (axios.post as jest.Mock).mockImplementationOnce(
  //     async () => await Promise.resolve({ status: 200 })
  //   );
  //   // Arrange
  //   const mockGetRegistration = jest
  //     .spyOn(navigator.serviceWorker, "getRegistration")
  //     .mockResolvedValue(undefined);

  //   // Act
  //   const result = await EP2Push.register(mockSecureKey, mockServerConfig);

  //   // Assert
  //   expect(mockGetRegistration).toHaveBeenCalledTimes(1);
  //   expect(result).toBeUndefined();
  // });

  // it("should return undefined if push subscription is unsuccessful", async () => {
  //   // Arrange
  //   const mockServiceWorkerRegistration = {
  //     pushManager: { subscribe: jest.fn().mockResolvedValue(undefined) },
  //   } as unknown as ServiceWorkerRegistration;
  //   const mockGetRegistration = jest
  //     .spyOn(navigator.serviceWorker, "getRegistration")
  //     .mockResolvedValue(mockServiceWorkerRegistration);
  //   // const mockPostCommunicationKey = jest.spyOn(updateEP2ServiceWorker,).mockResolvedValue();

  //   // Act
  //   const result = await EP2Push.register(mockSecureKey, mockServerConfig);

  //   // Assert
  //   expect(mockGetRegistration).toHaveBeenCalledTimes(1);
  //   // expect(
  //   //   mockServiceWorkerRegistration.pushManager.subscribe
  //   // ).toHaveBeenCalledWith({
  //   //   applicationServerKey: MOckvapidKey,
  //   //   userVisibleOnly: true,
  //   // });
  //   // expect(mockPostCommunicationKey).not.toHaveBeenCalled();
  //   expect(result).toBeUndefined();
  // });

  it("should call navigator.serviceWorker.controller.postMessage with the correct arguments", async () => {
    // Arrange
    const mockController = { postMessage: jest.fn() };
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        controller: mockController,
      },
      writable: true,
    });

    // Act
    updateEP2ServiceWorker(mockSecureKey);

    // Assert
    expect(mockController.postMessage).toHaveBeenCalledWith({
      type: "UPDATE_KEY",
      key: mockSecureKey.toJSON(),
    });
  });
});

test("registerSW() should attach event listener and call navigator.serviceWorker.ready.then()", () => {
  // Mock window and navigator objects
  const mockWindow = { addEventListener: jest.fn() };

  const mockRegistration: ServiceWorkerRegistration = {} as any;

  const mockNavigator = {
    serviceWorker: {
      addEventListener: jest.fn(),
      ready: { then: jest.fn().mockResolvedValue(mockRegistration) },
      controller: {},
    },
    permissions: {
      query: jest.fn(() => Promise.resolve({ state: "granted" })),
    },
    userAgent: "jest-test",
  };
  Object.defineProperty(global, "window", { value: mockWindow });
  Object.defineProperty(global, "navigator", { value: mockNavigator });

  // Call the function
  addServiceWorkerHandle();
  //load the window
  mockWindow.addEventListener.mock.calls[0][1](new Event("load"));

  // Expectations
  expect(mockWindow.addEventListener).toHaveBeenCalledWith(
    "load",
    expect.any(Function)
  );

  // expect(mockNavigator.serviceWorker.addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
  expect(mockNavigator.serviceWorker.ready.then).toHaveBeenCalledWith(
    expect.any(Function)
  );
  expect(mockNavigator.serviceWorker.ready.then.mock.calls[0][0]).toEqual(
    expect.any(Function)
  );
});

test("should create EP2PushServiceWorker", async () => {
  const serviceWorker = {addEventListener:jest.fn()}
  expect(() => EP2PushServiceWorker(serviceWorker as any)).not.toThrow();
});


// describe('addServiceWorkerHandle', () => {
//   let originalNavigator: Navigator;
//   let originalDocument: Document;

//   beforeEach(() => {
//     originalNavigator = { ...navigator };
//     originalDocument = { ...document };
//     //@ts-ignore
//     navigator.serviceWorker = {};
//         //@ts-ignore
//     // document.visibilityState = 'hidden';
//   });

//   afterEach(() => {
//     navigator = { ...originalNavigator };
//     document = { ...originalDocument };
//   });

//   test('registers periodic background sync and resolves the promise', async () => {
//     //@ts-ignore
//     navigator.serviceWorker.ready = Promise.resolve({
//       periodicSync: {
//         register: jest.fn(),
//       },
//     });

//     const result = await addServiceWorkerHandle();

//     expect(navigator.permissions.query).toHaveBeenCalledWith({
//       name: 'periodic-background-sync',
//     });
//     expect(navigator.serviceWorker.ready).toHaveBeenCalled();
//     expect(result).toBe(true);
//   });

  // test('handles visibility change event and sends update message', async () => {
  //   const postMessageSpy = jest.fn();
  //   const updateSpy = jest.fn();
  //   //@ts-ignore
  //   navigator.serviceWorker.ready = Promise.resolve({
  //     periodicSync: {
  //       register: jest.fn(),
  //     },
  //     update: updateSpy,
  //     controller: {
  //       postMessage: postMessageSpy,
  //     },
  //   });
  //   //@ts-ignore
  //   document.visibilityState = 'visible';

  //   await addServiceWorkerHandle();

  //   expect(document.addEventListener).toHaveBeenCalledWith(
  //     'visibilitychange',
  //     expect.any(Function)
  //   );
  //   //@ts-ignore
  //   const visibilityChangeCallback = document.addEventListener.mock.calls[0][1];

  //   visibilityChangeCallback();

  //   expect(navigator.serviceWorker?.controller?.postMessage).toHaveBeenCalledWith('UPDATE_CHECK');
  //   expect(updateSpy).toHaveBeenCalled();
  // });

  // test('rejects the promise if there is an error', async () => {
  //   const registrationError = new Error('Registration error');

  //   navigator.serviceWorker.ready = Promise.resolve({
  //     periodicSync: {
  //       register: jest.fn().mockResolvedValue(),
  //     },
  //   });

  //   navigator.permissions.query = jest.fn().mockResolvedValue({ state: 'granted' });
  //   navigator.serviceWorker.controller = {
  //     postMessage: jest.fn(),
  //   };
  //   navigator.serviceWorker.ready = Promise.resolve();
  //   navigator.serviceWorker.ready.mockRejectedValue(registrationError);

  //   await expect(addServiceWorkerHandle()).rejects.toEqual(registrationError);
  // });
// });












// describe("initSecurePush", () => {
//   let mockServiceWorker: any;
//   let pusherKey: EP2Key;
//   let pushedKey: EP2Key;
//   // let serverKey: EP2Key;

//   beforeAll(async () => {
//     pusherKey = await EP2Key.create();
//     pushedKey = await EP2Key.create();
//     // serverKey = await EP2Key.create();
//   });

//   beforeEach(() => {
//     mockServiceWorker = {
//       skipWaiting: jest.fn().mockResolvedValue(undefined),
//       addEventListener: jest.fn(),
//       ready: { then: jest.fn() },
//       controller: {},
//       clients: {
//         matchAll: jest.fn().mockResolvedValue({
//           some: jest.fn(),
//         }),
//         openWindow: jest.fn().mockResolvedValue(undefined),
//       },

//       registration: {
//         showNotification: jest.fn().mockResolvedValue(undefined),
//       },
//     };

//     Object.defineProperty(global, "window", {
//       value: { addEventListener: jest.fn() },
//     });
//     Object.defineProperty(global, "navigator", {
//       value: {
//         serviceWorker: mockServiceWorker,
//         permissions: {
//           query: jest.fn(() => Promise.resolve({ state: "granted" })),
//         },
//         userAgent: "jest-test",
//       },
//     });
//   });

//   test("service worker event handlers; postKey and handlePushMessage", async () => {
//     initSecurePush(mockServiceWorker);

//     // Assert that the event listeners were registered correctly
//     expect(mockServiceWorker.addEventListener).toHaveBeenCalledTimes(4);

//     // Get the event handler function registered with addEventListener for "message"
//     const messageEventHandler =
//       mockServiceWorker.addEventListener.mock.calls[0][1];

//     const mockMessageEventSkipWaiting = {
//       type: "message",
//       data: { type: "SKIP_WAITING" },
//     };

//     const mockMessageEventPostKey = {
//       type: "message",
//       data: { type: "UPDATE_KEY", key: pushedKey.toJSON() },
//     };

//     // Assert that the event handlers were called without throwing any errors
//     expect(() =>
//       messageEventHandler(mockMessageEventSkipWaiting)
//     ).not.toThrow();
//     expect(() => messageEventHandler(mockMessageEventPostKey)).not.toThrow();

//     // Get the event handler function registered with addEventListener for "notificationclick"
//     const handleNotificationclick =
//       mockServiceWorker.addEventListener.mock.calls[1][1];

//     // Call the event handler function with a mock notification object
//     handleNotificationclick({
//       action: "",
//       waitUntil: jest.fn(),
//       notification: {
//         data: "notification data",
//         close: jest.fn(),
//       } as unknown as Notification,
//     });

//     // Get the event handler function registered with addEventListener for "push"
//     const handlePush = mockServiceWorker.addEventListener.mock.calls[2][1];

//     const notificationOptions: NotificationOptions = {
//       body: "Hello World",
//       vibrate: [100, 200, 100, 200, 300],
//     };
//     const encryptedMessage: SymmetricallyEncryptedMessage<NotificationOptions> =
//       pusherKey.encryptSymmetrically(pushedKey.id, notificationOptions);
//     // Call the event handler function with a mock push event object
//     const mockPush = { data: { text: () => JSON.stringify(encryptedMessage) } };
//     handlePush(mockPush);
//   });

//   test("service worker event handlers; handlePushMessage fails without posted Key", async () => {
//     initSecurePush(mockServiceWorker);

//     // Assert that the event listeners were registered correctly
//     expect(mockServiceWorker.addEventListener).toHaveBeenCalledTimes(4);

//     // Get the event handler function registered with addEventListener for "message"
//     const messageEventHandler =
//       mockServiceWorker.addEventListener.mock.calls[0][1];

//     const mockMessageEventSkipWaiting = {
//       type: "message",
//       data: { type: "SKIP_WAITING" },
//     };

//     // Assert that the event handlers were called without throwing any errors
//     expect(() =>
//       messageEventHandler(mockMessageEventSkipWaiting)
//     ).not.toThrow();

//     // Get the event handler function registered with addEventListener for "notificationclick"
//     const handleNotificationclick =
//       mockServiceWorker.addEventListener.mock.calls[1][1];

//     // Call the event handler function with a mock notification object
//     handleNotificationclick({
//       action: "",
//       waitUntil: jest.fn(),
//       notification: {
//         data: "notification data",
//         close: jest.fn(),
//       } as unknown as Notification,
//     });

//     // Get the event handler function registered with addEventListener for "push"

//     // const handlePush = mockServiceWorker.addEventListener.mock.calls[2][1];

//     const notificationOptions: NotificationOptions = {
//       body: "Hello World",
//       vibrate: [100, 200, 100, 200, 300],
//     };
//     const encryptedMessage: SymmetricallyEncryptedMessage<NotificationOptions> =
//       pusherKey.encryptSymmetrically(pushedKey.id, notificationOptions);
//     // Call the event handler function with a mock push event object
//     const mockPush = { data: { text: () => JSON.stringify(encryptedMessage) } };
//     expect(mockPush).toBeDefined();
//     try {
//       // await handlePush(mockPush)
//       // fail('Expected handlePush to throw Error')
//     } catch (error) {
//       expect(error).toContain("No key ye");
//     }
//   });
// });
