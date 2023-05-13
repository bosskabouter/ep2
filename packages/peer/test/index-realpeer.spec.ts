// import { DataConnection } from 'peerjs'
// import { jest } from '@jest/globals'

import EP2Key from "@ep2/key";
import { EP2Peer } from "../src";

// Import the PeerJS library
// jest.mock('peerjs', () => {
//   const mockPeer = jest.fn(() => ({
//     on: jest.fn(),
//     connect: jest.fn(),
//     id: 'test-peer',
//     connectSecurely: jest.fn()
//   }))
//   return mockPeer
// })

// //@ts-ignore
// global.RTCPeerConnection = jest.fn(() => ({
//   createDataChannel: jest.fn(),
//   createOffer: jest.fn(),
//   setLocalDescription: jest.fn()
//   // Add a mock implementation for the generateCertificate method

// }))
describe("EP2Peer - Connecting to public peer JS server", () => {
  let key1: EP2Key; //, key2: SecurePeerKey

  beforeAll(async () => {
    expect((key1 = await EP2Key.create())).toBeDefined();
  });

  test("EP2Peer connects to any peerserver", (done) => {
    const peer = new EP2Peer(key1);
    expect(peer.disconnected).toBe(false);
    if (!peer.disconnected) {
      // If the peer is already connected, pass the test
      done();
    } else {
      // If the peer is not connected, wait for it to connect or timeout after 5 seconds
      const timeout = setTimeout(() => {
        expect(peer.disconnected).toBe(false);
        done();
      }, 5000);

      peer.on("open", () => {
        clearTimeout(timeout);
        expect(peer.id).toBe(key1.id);
        expect(peer.disconnected).toBe(false);
        peer.disconnect();
        done();
      });
    }
  });
});
