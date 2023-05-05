import Peer from 'peerjs'
import type {
  PeerJSOption,
  PeerConnectOption,
  DataConnection,
  MediaConnection
} from 'peerjs'
import { SecureLayer } from './securelayer'
import { type SecureChannel, type EP2Key } from '.'

/**
 * A SecurePeer has a guaranteed verified identity and establishes encrypted P2P communication over trusted connections.
 */
export class EP2Peer extends Peer {
  readonly isEp2PeerServer: Promise<boolean>
  /**
   * Creates a SecurePeer with given key. It connects to a peerserver, just like a normal peer. If a serverPublicKey is given, it will use it to initiate a secure handshake. If no serverPublicKey is given, it will connect to any normal peerserver.
   * @param key gives id of the peer
   * @param options normal peerjs connection options. token will be used to pass the secure
   *  @see PeerJSOption
   * @param serverPublicKey the public key of the EP2OnlineServer connecting with. If the server is a normal PeerServer, this argument is optional.
   */
  constructor (
    private readonly key: EP2Key,
    public readonly serverPublicKey?: string,
    options?: PeerJSOption
  ) {
    const expectEp2Server = serverPublicKey !== undefined
    super(
      key.peerId,
      (!expectEp2Server
        ? options
        : (options = {
            ...options,
            token: JSON.stringify(
              key.initiateHandshake(serverPublicKey).handshake
            )
          })
      ))
    super.on('open', this.handleOpenServer)
    super.on('connection', this.handleDataConnection)
    super.on('call', this.validateConnection)
    super.on('error', console.error)

    this.isEp2PeerServer = (expectEp2Server) ? this.testEp2Server() : Promise.resolve(false)
  }
  /**
   * Creates a new Connection to the peer using given options. A handshake is initiated to establish a common shared secret.
   * @param peerId
   * @param options CAUTION: metadata is replaced with handshake
   * @returns
   */

  override connect (peerId: string, options?: PeerConnectOption): DataConnection {
    return this.connectSecurely(peerId, options).dataConnection
  }

  /**
   *
   * @param peerId
   * @param options
   * @returns
   * @see connect
   */
  connectSecurely (peerId: string, options?: PeerConnectOption): SecureLayer {
    const initiatedHandShake = this.key.initiateHandshake(peerId)
    const conn = super.connect(peerId, { ...options, metadata: initiatedHandShake.handshake })
    return new SecureLayer(initiatedHandShake.secureChannel, conn)
  }

  /**
   * Handler for new incoming DataConnections. A SecurePeer closes the socket from any dataConnection without a valid handshake. A new `SecureLayer` used to communicate with the other peer is placed in `dataConnection.metadata.secureLayer`
   * @param dataConnection the unencrypted incoming dataConnection
   */
  private handleDataConnection (dataConnection: DataConnection): void {
    const secureChannel = this.validateConnection(dataConnection)
    if (secureChannel !== undefined) {
      dataConnection.metadata.secureLayer = new SecureLayer(
        secureChannel,
        dataConnection
      )
    }
  }

  /**
   * Validates all (data and media) incoming connections for a valid handshake in metadata. Connection is closed if not found or invalid.
   * @param connection
   * @returns undefined if con.metadata doesn't contain a valid EncryptedHandshake
   * @see EncryptedHandshake
   */
  private validateConnection (
    connection: MediaConnection | DataConnection
  ): SecureChannel | undefined {
    try {
      return this.key.receiveHandshake(connection.peer, connection.metadata)
    } catch (e: unknown) {
      connection.close()
      console.warn('Invalid handshake from connection:', e, connection)
      super.emit('error', new Error('Invalid handshake'))
      return undefined
    }
  }

  /**
   * Handler for opening connection to peerServer. Makes sure the id passed by the server is indeed the request SecurePeer.peerId
   * @param serverAssignedId
   */
  private handleOpenServer (serverAssignedId: string): void {
    if (serverAssignedId !== this.key.peerId) {
      throw Error('server assigned different ID')
    }
  }

  /**
   * Tests if the current connecting server accepts a normal (non-secure) peer client.
   * @returns true if the tested connection was closed.
   */
  private async testEp2Server (): Promise<boolean> {
    const insecurePeer = new Peer(`${Math.round(Math.random() * 1000000000)}`, {
      ...this.options,
      debug: 0,
      logFunction (_logLevel, ..._rest) { }
    })
    return await new Promise((resolve) => {
      insecurePeer.on('disconnected', (): void => {
        clearTimeout(connectionTimeout)
        resolve(true)
      })
      const connectionTimeout = setTimeout(() => {
        // server should have disconnected if it were secured
        resolve(false)
        insecurePeer.destroy()
      }, 5000)
    })
  }
}
