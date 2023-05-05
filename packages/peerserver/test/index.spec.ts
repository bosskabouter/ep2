import type { PeerServerEvents, IClient } from "peer";
import type { IncomingMessage, Server, ServerResponse } from "http";
import EP2PeerServer, { ExpressEP2PeerServer } from "../src";
import express, { type Express } from "express";

import request from "supertest";
import { jest } from "@jest/globals";
import {
  type AsymmetricallyEncryptedMessage,
  type EncryptedHandshake,
  EP2Key,
  SecureChannel,
} from "@ep2/key";
const TEST_PORT = 2000 + Math.floor(Math.random() * 5000);

describe("OnlineServer", () => {
  test("Start EP2OnlineServer", async () => {
    const serverKey = await EP2Key.create();
    expect(serverKey).toBeDefined();
  });
});
describe("ExpressPeerServer", () => {
  let app: Express;
  let client: IClient;

  let serverKey: EP2Key;
  let clientKey: EP2Key;
  let peerServer: (express.Express & PeerServerEvents) | null;
  let initiatedHandshake: {
    secureChannel: SecureChannel;
    handshake: EncryptedHandshake;
  };

  let server: Server<typeof IncomingMessage, typeof ServerResponse>;
  beforeAll((done) => {
    app = express();
    // jest.useFakeTimers()
    void Promise.all([EP2Key.create(), EP2Key.create()]).then(
      async ([serverKeyResult, clientKeyResult]) => {
        serverKey = serverKeyResult;
        clientKey = clientKeyResult;

        server = app.listen(TEST_PORT, () => {
          peerServer = ExpressEP2PeerServer(serverKey, server, {
            path: "/myApp",
            port: TEST_PORT,
          });
          expect(peerServer).toBeDefined();

          const sps = EP2PeerServer(serverKey, { port: TEST_PORT + 1 });
          expect(sps).toBeDefined();

          app.use("/myApp", peerServer);

          done();
        });
      }
    );
  });

  afterAll((done) => {
    client?.getSocket()?.close();
    // peerServer?.emit('disconnect', client)

    // server.closeAllConnections()
    server.unref();
    jest.resetModules();

    server.close(done);
  }, 10000);

  test("responds with 200 status and expected header", async () => {
    const response = await request(peerServer).get("/myApp");
    expect(response.ok).toBeTruthy();
  }, 200);

  test("should initiate handshake", async () => {
    initiatedHandshake = clientKey.initiateHandshake(serverKey.peerId);
    expect(initiatedHandshake).toBeDefined();
  }, 200);
  test("responds with 200 status and peerjs header", async () => {
    const response = await request(peerServer).get("/myApp/");
    expect(response.body.description).toMatch(
      /A server side element to broker connections between PeerJS clients./
    );
  });

  test("peer with valid welcome", async () => {
    const token: string = JSON.stringify(initiatedHandshake.handshake);
    // expect a welcome message to be sent, encrypted with the shared secret
    const sendMock = jest.fn(
      async (encryptedWelcome: AsymmetricallyEncryptedMessage<string>) => {
        expect(encryptedWelcome).toBeDefined();
        const decryptedWelcome = new SecureChannel(
          initiatedHandshake.secureChannel.sharedSecret
        ).decrypt(encryptedWelcome);

        expect(decryptedWelcome).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        expect(decryptedWelcome).toEqual(`welcome ${clientKey.peerId}`);
      }
    );

    const closeSocketMock = jest.fn(() => null);
    client = {
      getId: () => {
        return clientKey.peerId;
      },
      getToken: () => {
        return token;
      },
      getSocket: () => ({
        close: closeSocketMock,
      }),
      send: sendMock,
    } as unknown as IClient;
    const emitted = peerServer?.emit("connection", client);

    expect(emitted).toBeTruthy();
    expect(closeSocketMock).not.toBeCalled();

    await new Promise((resolve) => setImmediate(resolve).unref());

    // expect(sendMock).toHaveBeenCalled()
  });

  test("peer with malformed handshake - close socket", async () => {
    const closeMock = jest.fn(() => null);
    const sendMock = jest.fn();
    const fakeClient: IClient = {
      getId: () => {
        return clientKey.peerId;
      },
      getToken: () => {
        return "fake-token";
      },
      getSocket: jest.fn(() => ({
        close: closeMock,
      })),
      send: sendMock,
    } as unknown as IClient;
    expect(sendMock).not.toHaveBeenCalled();
    const emitted = peerServer?.emit("connection", fakeClient);
    expect(emitted).toBeTruthy();

    expect(closeMock).toBeCalled();
  });

  test("peer with missing handshake - close socket", () => {
    const closeMock = jest.fn(() => null);
    const sendMock = jest.fn();
    const fakeClient: IClient = {
      getId: () => {
        return "11111";
      },
      getToken: () => {
        return "";
      }, // Empty token to simulate missing handshake
      getSocket: jest.fn(() => ({
        close: closeMock,
      })),
      send: sendMock,
    } as unknown as IClient;

    const emitted = peerServer?.emit("connection", fakeClient);
    expect(emitted).toBeTruthy();
    expect(sendMock).not.toHaveBeenCalled();
    expect(closeMock).toBeCalled();
  });

  test("peer with tampered token - close socket", async () => {
    const key = await EP2Key.create();

    const { handshake } = key.initiateHandshake(serverKey.peerId);

    // use servers pubkey as our encryption pubkey
    handshake.publicSignKey = serverKey.peerId;
    const token: string = JSON.stringify(handshake);
    const mockToken = (): string => {
      return token;
    };

    const closeMock = jest.fn(() => null);
    const sendMock = jest.fn();
    const fakeClient: IClient = {
      getId: () => {
        return key.peerId;
      },
      getToken: mockToken, // Invalid token to simulate invalid handshake
      getSocket: () => ({
        close: closeMock,
      }),
      send: sendMock,
    } as unknown as IClient;

    const emitted = peerServer?.emit("connection", fakeClient);
    expect(emitted).toBeTruthy();
    expect(sendMock).not.toHaveBeenCalled();
    // Wait for the sendMock function to be called asynchronously
    // await new Promise((resolve) => setTimeout(resolve, 100))
    await new Promise((resolve) => setImmediate(resolve).unref());
    expect(closeMock).toBeCalled();
  });

  // const TIMEOUT_EXPIRE_HANDSHAKE = 2000;
  // test(
  //   "peer with expired handshake - close socket",
  //   async () => {
  //     const closeMock = jest.fn(() => null);
  //     const sendMock = jest.fn((arg) => {
  //       //todo implement replay attack prevention
  //       // expect(arg).not.toBeDefined();
  //     });
  //     const key = await SecureChannelKey.create();
  //     const { handshake } = await key.initiateHandshake(serverKey.getPeerId()); // Set handshake expiration to 1 second
  //     await new Promise((resolve) =>
  //       setTimeout(resolve, TIMEOUT_EXPIRE_HANDSHAKE)
  //     ); // Wait for handshake to expire

  //     const token: string = JSON.stringify(handshake);
  //     const fakeClient: IClient = {
  //       getId: () => {
  //         return key.getPeerId();
  //       },
  //       getToken: () => {
  //         return token;
  //       },
  //       getSocket: jest.fn(() => ({
  //         close: closeMock,
  //       })),
  //       send: sendMock,
  //     } as unknown as IClient;

  //     const emitted = peerServer.emit("connection", fakeClient);

  //     expect(emitted).toBeTruthy();

  //     //wait for server response
  //     await new Promise((resolve) => setTimeout(resolve, 100));
  //     //todo: Implement replay attack
  //     // expect(closeMock).toBeCalled();
  //     // expect(sendMock).not.toBeCalled();
  //   },
  //   TIMEOUT_EXPIRE_HANDSHAKE + 1000
  // );
});
