import { Peer } from 'peerjs'
import { type DataConnection, type PeerConnectOption } from 'peerjs'

import { jest } from '@jest/globals'
import { type SpiedFunction } from 'jest-mock'
import { EP2Peer } from '../src/'
import { EP2Key, SecureLayer, type SecureChannel } from '../src'

describe('EP2', () => {
  let connectMock: SpiedFunction<
  (peer: string, options?: PeerConnectOption | undefined) => DataConnection
  >

  let key1: EP2Key, key2: EP2Key
  let peer1: EP2Peer, peer2: EP2Peer

  beforeAll(async () => {
    connectMock = jest
      .spyOn(Peer.prototype, 'connect')
      .mockImplementation((_peer: string, _options?: PeerConnectOption) => {
        return {
          close: jest.fn(),
          send: jest.fn(),
          open: true,
          on: jest.fn(),
          peer: key2.peerId,
          metadata: jest.fn()
        } as unknown as DataConnection
      })

    // peer1 = new EP2Peer(key1)
    peer1 = new EP2Peer((key1 = await EP2Key.create()))
    expect(key1.peerId).toBeDefined()
    peer2 = new EP2Peer((key2 = await EP2Key.create()))
    expect(peer1).toBeDefined()
    expect(peer2).toBeDefined()

    peer2.on('open', (id: string) => {
      console.info('peer connected', peer2, id)
    })
  })

  afterEach(() => {
    // peer1.disconnect()
    connectMock.mockRestore()
  })

  beforeEach(
    (done) => {
      done()
      // if (peer1.disconnected) {
      //   // If the peer is already connected, pass the test
      //   expect(peer1.disconnected).toBe(false)
      //   console.info('Client connected 1', peer1.id)

      //   done()
      // } else {
      // If the peer is not connected, wait for it to connect or timeout after 5 seconds

      // peer1.on('error', (e) => {
      //   expect(e).toBeNull()
      //   console.info('Client errored', e)
      //   done()
      // })
    }
    // }
  )

  afterAll(() => {
    peer1.disconnect()
    peer1.destroy()
    peer2.disconnect()
    peer2.destroy()
  })

  test('PeerJS test', async () => {
    // Mock the PeerJS library
    expect(key2.peerId).toBeDefined()
    peer2.on('connection', (con: DataConnection) => {
      expect(con).toBeDefined()
    })
    const secureLayer12: SecureLayer = peer1.connectSecurely(key2.peerId)

    expect(secureLayer12).toBeDefined()
    expect(secureLayer12).toBeDefined()
    secureLayer12.send('Data to encrypt')

    // Set up a promise to wait for the connection event
  })

  test('New EP2Peer connects to any peerserver - identifying none ep2online server', async () => {
    expect(peer1.disconnected).toBe(false)
    expect(await peer1.isEp2PeerServer).toBeFalsy()
  })
})

// describe('API', () => {
//   test('should work', async () => {
//     const onlineClients:EP2Peer[] = [
//       await getOnlineClient(),
//       await getOnlineClient()]
//       if (onlineClients.length>1 && onlineClients[1])
// {    const secureLayer = onlineClients[0]?.connectSecurely(onlineClients[1].id)
//     secureLayer?.send('Send this encrypted and signed')
// }  })

//  async function getOnlineClient():Promise<EP2Peer>{
//     const oc = new EP2Peer(await EP2Key.create())

//     oc.on('open', () => {
//       oc.on('connection', (con) => {
//         const secureLayer = con.metadata.secureLayer
//         secureLayer.on('decrypted', console.info)
//         secureLayer.send('Thanks for your secure message!')
//       })
//     })
//     return oc
//   }
// })

describe('SecureLayer', () => {
  it('emits the decrypted event when data is received', () => {
    // Mock the SecureChannel object
    const mockSecureChannel = {
      decrypt: jest.fn().mockReturnValue('decrypted data')
    } as unknown as SecureChannel

    const mockEvent = jest.fn()

    interface MockDataConnection extends DataConnection {
      mock: {
        on: jest.Mock
      }
    }

    // Create a mock DataConnection object
    const mockDataConnection = {
      on: mockEvent
    } as unknown as MockDataConnection

    // Create a new SecureLayer instance with the mock objects
    const secureLayer = new SecureLayer(mockSecureChannel, mockDataConnection)

    // Create a listener for the 'decrypted' event on the SecureLayer instance
    const decryptedListener = jest.fn()
    secureLayer.on('decrypted', decryptedListener)

    // Simulate the 'open' event on the mock data connection
    const openCallback = (mockDataConnection.on as any).mock.calls.find(
      ([eventName]: string[]) => eventName === 'open'
    )[1]
    openCallback()

    // Simulate the 'data' event on the mock data connection
    const mockData = JSON.stringify({ encryptedData: 'mock encrypted data' })

    const dataCallback = (mockDataConnection.on as any).mock.calls.find(
      ([eventName]: string[]) => eventName === 'data'
    )[1]
    dataCallback(mockData)

    // Check that the 'decrypted' event was emitted with the correct data
    expect(mockSecureChannel.decrypt).toHaveBeenCalledWith({
      encryptedData: 'mock encrypted data'
    })
    expect(decryptedListener).toHaveBeenCalledWith('decrypted data')
  })
})
