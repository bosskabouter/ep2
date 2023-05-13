import { EP2Peer } from "../src/";
import { EP2SecureLayer } from "../src";

import { Peer } from "peerjs";
import { type DataConnection, type PeerConnectOption } from "peerjs";

import { jest } from "@jest/globals";
import { type SpiedFunction } from "jest-mock";

import EP2Key from "@ep2/key";

describe("EP2Peer - MockServer", () => {
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
          peer: key2.id,
          metadata: {},
        } as unknown as DataConnection;
      });

    // peer1 = new EP2Peer(key1)
    serverKey = await EP2Key.create();
    peer1 = new EP2Peer((key1 = await EP2Key.create()));
    expect(key1.id).toBeDefined();
    peer2 = new EP2Peer((key2 = await EP2Key.create()), serverKey.id, {
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
    expect(key2.id).toBeDefined();
    peer2.on("connected", (con: DataConnection) => {
      expect(con).toBeDefined();
      expect(con.metadata.secureLayer).toBeDefined();
    });
    const secureLayer12: EP2SecureLayer = peer1.connect(key2.id);

    expect(secureLayer12).toBeDefined();
    expect(secureLayer12).toBeDefined();
    secureLayer12.send("Data to encrypt");

    const dataConnection = peer2.connect(key1.id);
    expect(dataConnection).toBeDefined();
  });

  test("New EP2Peer connects to any peerserver - identifying none ep2online server", async () => {
    expect(peer1.disconnected).toBe(false);
    expect(await peer1.isEp2PeerServer).toBeFalsy();
  });
});
