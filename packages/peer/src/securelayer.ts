import { type DataConnection } from 'peerjs'
import { type AsymmetricallyEncryptedMessage, type SecureChannel } from '.'
import EventEmitter from 'eventemitter3'
interface EP2PeerEvents {
  decrypted: string
  connected: (secureLayer: SecureLayer) => void
}

/**
 * Wraps the dataConnection with the secureChannel. The SecureLayer is automatically instantiated after a successful handshake and added to the connection.metadata.secureLayer to pass it on in the event chain for peer.on('connection').
 */
export class SecureLayer extends EventEmitter<EP2PeerEvents> {
  constructor (
    private readonly secureChannel: SecureChannel,
    readonly dataConnection: DataConnection
  ) {
    super()

    this.dataConnection.on('open', () => {
      this.dataConnection.on('data', (data) => {
        super.emit(
          'decrypted',
          this.secureChannel.decrypt(
            JSON.parse(data as string) as AsymmetricallyEncryptedMessage<string>
          )
        )
      })
    })
  }

  /**
   * Sends the data over a secureChannel
   * @param data
   * @param chunked
   */
  send (data: string, chunked?: boolean | undefined): void {
    this.dataConnection.send(
      JSON.stringify(this.secureChannel.encrypt(data)),
      chunked
    )
  }
}
