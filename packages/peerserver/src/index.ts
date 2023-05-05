import type { Server as HttpsServer } from 'https'
import type { Server as HttpServer } from 'http'
import type { Express } from 'express'
import {
  type IClient,
  type IConfig,
  type PeerServerEvents,
  PeerServer,
  ExpressPeerServer
} from 'peer'

import { type EP2Key } from '@ep2/key'

export * from '@ep2/key'

interface EP2PeerServerEvents {
  on: (event: 'handshake-error', listener: (event: { client: IClient, token: string, message: string }) => void) => this
}
/**
 * Returns a secure Express Peer server instance.
 *
 * @param serverKey The EP2Key object used for encryption.
 * @param server An HTTP or HTTPS server instance.
 * @param options Optional configuration options. See peerJS options
 * @see PeerServer
 * @returns An Express instance with SecurePeerServerEvents.
 */
export function ExpressEP2PeerServer (
  serverKey: EP2Key,
  server: HttpsServer | HttpServer,
  options?: Partial<IConfig>
): Express & PeerServerEvents & EP2PeerServerEvents {
  return initialize(
    ExpressPeerServer(server, disableGenerateClientId(options)),
    serverKey
  )
}

/**
 * Returns a secure Peer server instance.
 *
 * @param ep2key The EP2Key object used for encryption.
 * @param options Optional configuration options.
 * @param callback An optional callback function to be executed after the server is created.
 * @returns An Express instance with PeerServerEvents.
 */
export default function EP2PeerServer (
  ep2key: EP2Key,
  options?: Partial<IConfig>,
  callback?: (server: HttpsServer | HttpServer) => void
): Express & PeerServerEvents & EP2PeerServerEvents {
  return initialize(
    PeerServer(disableGenerateClientId(options), callback),
    ep2key
  )
}

/**
 * Disables the client ID generation option in the configuration object.
 *
 * @param config The configuration object to modify.
 * @returns The modified configuration object.
 */
const disableGenerateClientId = (
  config?: Partial<IConfig>
): Partial<IConfig> => {
  return {
    ...config,
    generateClientId: (): string => {
      return 'use a @ep2/key'
    }
  }
}

/**
 * Adds a connection handler that verifies the token from connecting peers for a valid EncryptedHandshake
 *
 * @see EncryptedHandshake
 * @param server The Peer server instance to modify.
 * @param ep2key The EP2Key object used for encryption.
 * @returns The modified Peer server instance with event handlers.
 */
function initialize (
  server: Express & PeerServerEvents,
  ep2key: EP2Key
): Express & PeerServerEvents & EP2PeerServerEvents {
  server.on('connection', (client: IClient) => {
    const token = client.getToken()
    try {
      ep2key.receiveHandshake(client.getId(), JSON.parse(token))
    } catch (error: any) {
      const msg = `Invalid Handshake: ${(error as string)} `
      console.debug(msg, token)
      client.getSocket()?.close()
      server.emit('handshake-error', { client, token, msg })
    }
  })
  return server as Express & PeerServerEvents & EP2PeerServerEvents
}
