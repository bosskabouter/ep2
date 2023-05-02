import { Peer } from 'peerjs'
import { type DataConnection, type PeerConnectOption } from 'peerjs'

import { jest } from '@jest/globals'
import { type SpiedFunction } from 'jest-mock'
import { OnlineClient } from '../src/OnlineClient'
import { EP2Key, type SecureLayer } from '../src'
describe('EP2', () => {
  let connectMock: SpiedFunction<(peer: string, options?: PeerConnectOption | undefined) => DataConnection>

  let key1: EP2Key, key2: EP2Key
  let peer1: OnlineClient, peer2: OnlineClient

  beforeAll((done) => {
    connectMock = jest.spyOn(Peer.prototype, 'connect').mockImplementation((_peer: string, _options?: PeerConnectOption) => {
      return {
        close: jest.fn(),
        send: jest.fn(),
        open: true,
        on: jest.fn(),
        peer: key2.peerId,
        metadata: jest.fn()
      } as unknown as DataConnection
    })

    // peer1 = new OnlineClient(key1)
    void Promise.all([EP2Key.create(), EP2Key.create()]).then((r) => {
      peer1 = new OnlineClient(key1 = r[0])
      expect(key1.peerId).toBeDefined()
      peer2 = new OnlineClient(key2 = r[1])
      expect(peer1).toBeDefined()
      expect(peer2).toBeDefined()

      peer2.on('open', (id: string) => {
        console.info('peer connected', peer2, id)
      })
      // TODO place done inside open?
      done()
    })
  })

  afterEach(() => {
    peer1.disconnect()
    connectMock.mockRestore()
  })

  beforeEach((done) => {
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
    peer2.on('connection', (con:DataConnection) => { expect(con).toBeDefined() })
    const secureLayer12: SecureLayer = peer1.connectSecurely(key2.peerId)

    expect(secureLayer12).toBeDefined()
    expect(secureLayer12).toBeDefined()
    secureLayer12.send('Data to encrypt')
    // Set up a promise to wait for the connection event
  })
})


// describe('API', () => {
//   test('should work', async () => {
//     const onlineClients:OnlineClient[] = [
//       await getOnlineClient(),
//       await getOnlineClient()]
//       if (onlineClients.length>1 && onlineClients[1])  
// {    const secureLayer = onlineClients[0]?.connectSecurely(onlineClients[1].id)
//     secureLayer?.send('Send this encrypted and signed')
// }  })

//  async function getOnlineClient():Promise<OnlineClient>{
//     const oc = new OnlineClient(await EP2Key.create())
    
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
