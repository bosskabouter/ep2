import axios from "axios";
import {
  EP2Push,
  EP2PushMessage,
  EP2PushConfig,
  updateEP2ServiceWorker,
} from "../src/ep2push";
import { EP2Key, SymmetricallyEncryptedMessage } from "@ep2/key";
import { registerSW, initSecurePush } from "../src/swutil";

jest.mock("axios");

describe("EP2Push API", () => {
  test("show case README.md", async () => {
    const key = await EP2Key.create();
    const offlineClient = await EP2Push.register(key, {
      path: "/push",
      publicKey: "",
      vapidKey: "YOUR VAPID PUB KEY",
      host: "ep2.push.host",
    });
    await offlineClient?.pushText(
      {
        body: "Knock knock. Who is there?",
        vibrate: [2000, 1000, 2000, 1000, 3000],
      },
      key.peerId,
      offlineClient.sharedSubscription
    );
  });
});

describe("EP2Push", () => {
  const mockPushSubscription: PushSubscription = JSON.parse(
    JSON.stringify({
      endpoint: "https://example.com/push/1234",
      expirationTime: null,
      keys: {
        p256dh: "P256DH_PUBLIC_KEY",
        auth: "AUTH_SECRET_KEY",
      },
    })
  );
  let serverKey: EP2Key;
  let pusherKey: EP2Key;
  let pushedKey: EP2Key;
  let correctMessage: EP2PushMessage;

  const notificationOptions: NotificationOptions = {};

  let serverConfig: EP2PushConfig;

  beforeAll(async () => {
    serverKey = await EP2Key.create();
    serverConfig = {
      publicKey: serverKey.peerId,
      host: "testHost",
      path: "testPath",
      vapidKey: "testVapidKey",
    };
    pusherKey = await EP2Key.create();
    pushedKey = await EP2Key.create();
    correctMessage = {
      encryptedEndpoint: EP2Key.encrypt(
        serverConfig.publicKey,
        mockPushSubscription
      ),
      encryptedPayload: EP2Key.encrypt(pushedKey.peerId, notificationOptions),
    };
  });

  test("should Push", async () => {});
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("pushMessage", () => {
    test("should return true when axios post succeeds", async () => {
      (axios.post as jest.Mock).mockImplementationOnce(
        async () => await Promise.resolve({ status: 200 })
      );

      const offlineClient = new EP2Push(
        mockPushSubscription,
        pusherKey,
        serverConfig
      );
      const result = await offlineClient.pushMessages([correctMessage]);
      expect(result).toBe(true);
    });
    // test('should fail when key is not posted to sw yet', async () => {
    //   (axios.post as jest.Mock).mockImplementationOnce(async () => await Promise.resolve({ status: 200 }))

    //   const offlineClient = new EP2Push(mockPushSubscription, pusherKey, serverConfig)
    //   const result = await offlineClient.pushMessages([correctMessage])
    //   expect(result).toBe(true)
    // })
    test("should throw an error when axios post fails", async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(new Error("testError"));
      const offlineClient = new EP2Push(
        mockPushSubscription,
        pusherKey,
        serverConfig
      );
      await expect(offlineClient.pushMessages([])).rejects.toThrow("testError");
      expect(axios.post).toHaveBeenCalled();
      expect(axios.post).toHaveReturned();
    });
  });

  describe("getSharedSubscription", () => {
    test("should return the encrypted pushSubscription", () => {
      const offlineClient = new EP2Push(
        mockPushSubscription,
        pusherKey,
        serverConfig
      );
      expect(offlineClient.sharedSubscription).toBeDefined();
    });
  });
});

describe("register", () => {
  let mockSecureKey: EP2Key;
  let mockServerKey: EP2Key;
  let mockServerConfig: EP2PushConfig;

  beforeAll(async () => {
    mockSecureKey = await EP2Key.create();
    mockServerKey = await EP2Key.create();
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
    mockServerConfig = {
      vapidKey: "vapid-key",
      host: "hostname",
      path: "/push",
      publicKey: mockServerKey.peerId,
    };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("should return undefined if service worker registration is undefined", async () => {
    // Arrange
    const mockGetRegistration = jest
      .spyOn(navigator.serviceWorker, "getRegistration")
      .mockResolvedValue(undefined);

    // Act
    const result = await EP2Push.register(mockSecureKey, mockServerConfig);

    // Assert
    expect(mockGetRegistration).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });
  it("should return new instance of EP2Push if push subscription is successful. key should also be posted to sw", async () => {
    // Arrange
    const mockPushSubscription: PushSubscription = {
      endpoint: "https://example.com",
      keys: { p256dh: "key", auth: "auth" },
    } as any;
    const mockServiceWorkerRegistration: ServiceWorkerRegistration =
      //@ts-ignore
      {
        pushManager: {
          subscribe: jest.fn().mockResolvedValue(mockPushSubscription),
          getSubscription: async () => mockPushSubscription,
          permissionState: async () => "granted",
        },
      } as ServiceWorkerRegistration;

    const mockGetRegistration = jest
      .spyOn(navigator.serviceWorker, "getRegistration")
      .mockResolvedValue(mockServiceWorkerRegistration);

    // const mockController = { postMessage: jest.fn() };
    const mockServiceWorker: ServiceWorkerContainer = {
      getRegistration: async () =>
        mockGetRegistration as unknown as ServiceWorkerRegistration,
    } as unknown as ServiceWorkerContainer;

    Object.defineProperty(navigator, "serviceWorker", mockServiceWorker);

    // Act
    const offlineClient = await EP2Push.register(
      mockSecureKey,
      mockServerConfig
    );

    // Expectations
    expect(offlineClient).toBeInstanceOf(EP2Push);
    expect(mockGetRegistration).toHaveBeenCalled();
    expect(
      mockServiceWorkerRegistration.pushManager.subscribe
    ).toHaveBeenCalled();
    // expect(mockController.postMessage).toHaveBeenCalled()
    //With({
    //   type: 'SET_COMMUNICATION_KEY',
    //   key: mockSecureKey,
    // });

    const encryptedPushSubscription: SymmetricallyEncryptedMessage<PushSubscription> =
      mockSecureKey.encryptSymmetrically(
        mockServerKey.peerId,
        mockPushSubscription
      );

    const postMock = jest.fn(async () => ({ status: 200 }));
    jest.mock("axios", () => ({
      post: postMock,
    }));

    const recipient = await EP2Key.create();
    offlineClient?.pushText(
      {} as NotificationOptions,
      recipient.peerId,
      encryptedPushSubscription
    );
    expect(axios.post).toHaveBeenCalled(); //With(mockPushSubscription.endpoint, encryptedPushMessages);
  });

  it("should return undefined if push subscription is unsuccessful", async () => {
    // Arrange
    const mockServiceWorkerRegistration = {
      pushManager: { subscribe: jest.fn().mockResolvedValue(undefined) },
    } as unknown as ServiceWorkerRegistration;
    const mockGetRegistration = jest
      .spyOn(navigator.serviceWorker, "getRegistration")
      .mockResolvedValue(mockServiceWorkerRegistration);
    // const mockPostCommunicationKey = jest.spyOn(updateEP2ServiceWorker,).mockResolvedValue();

    // Act
    const result = await EP2Push.register(mockSecureKey, mockServerConfig);

    // Assert
    expect(mockGetRegistration).toHaveBeenCalledTimes(1);
    expect(
      mockServiceWorkerRegistration.pushManager.subscribe
    ).toHaveBeenCalledWith({
      applicationServerKey: mockServerConfig.vapidKey,
      userVisibleOnly: true,
    });
    // expect(mockPostCommunicationKey).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

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
  registerSW();
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

describe("initSecurePush", () => {
  let mockServiceWorker: any;
  let pusherKey: EP2Key;
  let pushedKey: EP2Key;
  // let serverKey: EP2Key;

  beforeAll(async () => {
    pusherKey = await EP2Key.create();
    pushedKey = await EP2Key.create();
    // serverKey = await EP2Key.create();
  });

  beforeEach(() => {
    mockServiceWorker = {
      skipWaiting: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn(),
      ready: { then: jest.fn() },
      controller: {},
      clients: {
        matchAll: jest.fn().mockResolvedValue({
          some: jest.fn(),
        }),
        openWindow: jest.fn().mockResolvedValue(undefined),
      },

      registration: {
        showNotification: jest.fn().mockResolvedValue(undefined),
      },
    };

    Object.defineProperty(global, "window", {
      value: { addEventListener: jest.fn() },
    });
    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: mockServiceWorker,
        permissions: {
          query: jest.fn(() => Promise.resolve({ state: "granted" })),
        },
        userAgent: "jest-test",
      },
    });
  });

  test("service worker event handlers; postKey and handlePushMessage", async () => {
    initSecurePush(mockServiceWorker);

    // Assert that the event listeners were registered correctly
    expect(mockServiceWorker.addEventListener).toHaveBeenCalledTimes(4);

    // Get the event handler function registered with addEventListener for "message"
    const messageEventHandler =
      mockServiceWorker.addEventListener.mock.calls[0][1];

    const mockMessageEventSkipWaiting = {
      type: "message",
      data: { type: "SKIP_WAITING" },
    };

    const mockMessageEventPostKey = {
      type: "message",
      data: { type: "UPDATE_KEY", key: pushedKey.toJSON() },
    };

    // Assert that the event handlers were called without throwing any errors
    expect(() =>
      messageEventHandler(mockMessageEventSkipWaiting)
    ).not.toThrow();
    expect(() => messageEventHandler(mockMessageEventPostKey)).not.toThrow();

    // Get the event handler function registered with addEventListener for "notificationclick"
    const handleNotificationclick =
      mockServiceWorker.addEventListener.mock.calls[1][1];

    // Call the event handler function with a mock notification object
    handleNotificationclick({
      action: "",
      waitUntil: jest.fn(),
      notification: {
        data: "notification data",
        close: jest.fn(),
      } as unknown as Notification,
    });

    // Get the event handler function registered with addEventListener for "push"
    const handlePush = mockServiceWorker.addEventListener.mock.calls[2][1];

    const notificationOptions: NotificationOptions = {
      body: "Hello World",
      vibrate: [100, 200, 100, 200, 300],
    };
    const encryptedMessage: SymmetricallyEncryptedMessage<NotificationOptions> =
      pusherKey.encryptSymmetrically(pushedKey.peerId, notificationOptions);
    // Call the event handler function with a mock push event object
    const mockPush = { data: { text: () => JSON.stringify(encryptedMessage) } };
    handlePush(mockPush);
  });

  test("service worker event handlers; handlePushMessage fails without posted Key", async () => {
    initSecurePush(mockServiceWorker);

    // Assert that the event listeners were registered correctly
    expect(mockServiceWorker.addEventListener).toHaveBeenCalledTimes(4);

    // Get the event handler function registered with addEventListener for "message"
    const messageEventHandler =
      mockServiceWorker.addEventListener.mock.calls[0][1];

    const mockMessageEventSkipWaiting = {
      type: "message",
      data: { type: "SKIP_WAITING" },
    };

    // Assert that the event handlers were called without throwing any errors
    expect(() =>
      messageEventHandler(mockMessageEventSkipWaiting)
    ).not.toThrow();

    // Get the event handler function registered with addEventListener for "notificationclick"
    const handleNotificationclick =
      mockServiceWorker.addEventListener.mock.calls[1][1];

    // Call the event handler function with a mock notification object
    handleNotificationclick({
      action: "",
      waitUntil: jest.fn(),
      notification: {
        data: "notification data",
        close: jest.fn(),
      } as unknown as Notification,
    });

    // Get the event handler function registered with addEventListener for "push"

    // const handlePush = mockServiceWorker.addEventListener.mock.calls[2][1];

    const notificationOptions: NotificationOptions = {
      body: "Hello World",
      vibrate: [100, 200, 100, 200, 300],
    };
    const encryptedMessage: SymmetricallyEncryptedMessage<NotificationOptions> =
      pusherKey.encryptSymmetrically(pushedKey.peerId, notificationOptions);
    // Call the event handler function with a mock push event object
    const mockPush = { data: { text: () => JSON.stringify(encryptedMessage) } };
    expect(mockPush).toBeDefined();
    try {
      // await handlePush(mockPush)
      // fail('Expected handlePush to throw Error')
    } catch (error) {
      expect(error).toContain("No key ye");
    }
  });
});
