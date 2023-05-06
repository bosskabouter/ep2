import { Peer } from "peerjs";
import { type DataConnection, type PeerConnectOption } from "peerjs";

import { jest } from "@jest/globals";
import { type SpiedFunction } from "jest-mock";
import { EP2Peer } from "../src/";
import { EP2Key, SecureLayer, type SecureChannel } from "../src";

describe("EP2", () => {
  let connectMock: SpiedFunction<
    (peer: string, options?: PeerConnectOption | undefined) => DataConnection
  >;

  let key1: EP2Key, key2: EP2Key, serverKey: EP2Key;
  let peer1: EP2Peer, peer2: EP2Peer;

  beforeAll(async () => {
    connectMock = jest
      .spyOn(Peer.prototype, "connect")
      .mockImplementation((_peer: string, _options?: PeerConnectOption) => {
        return {
          close: jest.fn(),
          send: jest.fn(),
          open: true,
          on: jest.fn(),
          peer: key2.peerId,
          metadata: {},
        } as unknown as DataConnection;
      });

    // peer1 = new EP2Peer(key1)
    serverKey = await EP2Key.create();
    peer1 = new EP2Peer((key1 = await EP2Key.create()));
    expect(key1.peerId).toBeDefined();
    peer2 = new EP2Peer((key2 = await EP2Key.create()), serverKey.peerId, {
      debug: 0,
    });
    expect(peer1).toBeDefined();
    expect(peer2).toBeDefined();

    peer2.on("open", (id: string) => {
      console.info("peer connected", peer2, id);
      peer1.connect(peer2.id, { label: "blah" });
    });
  });

  afterEach(() => {
    // peer1.disconnect()
    connectMock.mockRestore();
  });

  afterAll(() => {
    peer1.disconnect();
    peer1.destroy();
    peer2.disconnect();
    peer2.destroy();
  });

  test("PeerJS test", async () => {
    // Mock the PeerJS library
    expect(key2.peerId).toBeDefined();
    peer2.on("connection", (con: DataConnection) => {
      expect(con).toBeDefined();
      expect(con.metadata.secureLayer).toBeDefined();
    });
    const secureLayer12: SecureLayer = peer1.connect(key2.peerId);

    expect(secureLayer12).toBeDefined();
    expect(secureLayer12).toBeDefined();
    secureLayer12.send("Data to encrypt");

    const dataConnection = peer2.connect(key1.peerId);
    expect(dataConnection).toBeDefined();
  });

  test("New EP2Peer connects to any peerserver - identifying none ep2online server", async () => {
    expect(peer1.disconnected).toBe(false);
    expect(await peer1.isEp2PeerServer).toBeFalsy();
  });
});

describe("SecureLayer", () => {
  it("emits the decrypted event when data is received", () => {
    // Mock the SecureChannel object
    const mockSecureChannel = {
      decrypt: jest.fn().mockReturnValue("decrypted data"),
    } as unknown as SecureChannel;

    const mockEvent = jest.fn();

    interface MockDataConnection extends DataConnection {
      mock: {
        on: jest.Mock;
      };
    }

    // Create a mock DataConnection object
    const mockDataConnection = {
      on: mockEvent,
    } as unknown as MockDataConnection;

    // Create a new SecureLayer instance with the mock objects
    const secureLayer = new SecureLayer(mockSecureChannel, mockDataConnection);

    // Create a listener for the 'decrypted' event on the SecureLayer instance
    const decryptedListener = jest.fn();
    secureLayer.on("decrypted", decryptedListener);

    // Simulate the 'open' event on the mock data connection
    const openCallback = (mockDataConnection.on as any).mock.calls.find(
      ([eventName]: string[]) => eventName === "open"
    )[1];
    openCallback();

    // Simulate the 'data' event on the mock data connection
    const mockData = JSON.stringify({ encryptedData: "mock encrypted data" });

    const dataCallback = (mockDataConnection.on as any).mock.calls.find(
      ([eventName]: string[]) => eventName === "data"
    )[1];
    dataCallback(mockData);

    // Check that the 'decrypted' event was emitted with the correct data
    expect(mockSecureChannel.decrypt).toHaveBeenCalledWith({
      encryptedData: "mock encrypted data",
    });
    expect(decryptedListener).toHaveBeenCalledWith("decrypted data");
  });
});
