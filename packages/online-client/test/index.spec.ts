// import { DataConnection } from 'peerjs'
// import { jest } from '@jest/globals'

import { OnlineClient, EP2Key } from '../src/'

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

let key1: EP2Key //, key2: SecurePeerKey

// //@ts-ignore
// global.RTCPeerConnection = jest.fn(() => ({
//   createDataChannel: jest.fn(),
//   createOffer: jest.fn(),
//   setLocalDescription: jest.fn()
//   // Add a mock implementation for the generateCertificate method

// }))
describe('OnlineClient JS - client Connecting real server', () => {
  beforeAll(async () => {
    key1 = await EP2Key.create()

    // key2 = await SecurePeerKey.create()
    expect(key1).toBeDefined()
  })

  test('New OnlineClient connects to any peerserver', (done) => {
    const peer = new OnlineClient(key1)

    if (!(peer.disconnected)) {
      // If the peer is already connected, pass the test
      expect(peer.disconnected).toBe(false)
      done()
    } else {
      // If the peer is not connected, wait for it to connect or timeout after 5 seconds
      const timeout = setTimeout(() => {
        expect(peer.disconnected).toBe(false)
        done()
      }, 5000)

      peer.on('open', () => {
        clearTimeout(timeout)
        expect(peer.id).toBe(key1.peerId)
        expect(peer.disconnected).toBe(false)
        peer.disconnect()
        done()
      })
    }
  })

  // test('PeerJS test', async () => {
  //   // Mock the PeerJS library

  //   // Create two PeerJS objects
  //   const peer1 = new OnlineClient(key1)
  //   const peer2 = new OnlineClient(key2)

  //   // Connect the peers
  //   const conn12 = await peer1.connectSecurely(key2.peerId)
  //   const conn21 = await peer2.connectSecurely(key1.peerId)

  //   // Set up a promise to wait for the connection event
  //   const promise = new Promise<void>((resolve) => {
  //     conn12.dataConnection.on('open', () => {
  //       resolve()
  //     })
  //   })

  //   // Wait for the connection event to fire
  //   await Promise.race([
  //     promise,
  //     new Promise((resolve) => setTimeout(resolve, 10000))
  //   ]).then(() => {
  //     // Your test assertions
  //     expect(peer1.id).toBe('test-peer-1')
  //     expect(peer2.id).toBe('test-peer-2')
  //     expect(conn12.dataConnection.open).toBe(true)
  //     expect(conn21.dataConnection.open).toBe(true)
  //   })
  // })
})

