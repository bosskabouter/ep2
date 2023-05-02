
import type { Server as HttpsServer } from 'https'
import type { Server as HttpServer } from 'http'
import type { Express } from 'express'
import {
  type IClient, type IConfig,
  type PeerServerEvents, PeerServer, ExpressPeerServer
} from 'peer'

import { type EP2Key } from '@ep2/key'

export * from '@ep2/key'
/**
 * Returns a secure Express Peer server instance.
 *
 * @param serverKey The EP2Key object used for encryption.
 * @param server An HTTP or HTTPS server instance.
 * @param options Optional configuration options. See peerJS options
 * @see PeerServer
 * @returns An Express instance with SecurePeerServerEvents.
 */
export function ExpressOnlineServer (
  serverKey: EP2Key,
  server: HttpsServer | HttpServer,
  options?: Partial<IConfig>
): Express & PeerServerEvents {
  return initialize(
    ExpressPeerServer(server, disableGenerateClientId(options)),
    serverKey
  )
}

/**
 * Returns a secure Peer server instance.
 *
 * @param serverKey The EP2Key object used for encryption.
 * @param options Optional configuration options.
 * @param callback An optional callback function to be executed after the server is created.
 * @returns An Express instance with PeerServerEvents.
 */
export function OnlineServer (
  serverKey: EP2Key,
  options?: Partial<IConfig>,
  callback?: (server: HttpsServer | HttpServer) => void
): Express & PeerServerEvents {
  return initialize(
    PeerServer(disableGenerateClientId(options), callback),
    serverKey
  )
}

/**
 * Disables the client ID generation option in the configuration object.
 *
 * @param config The configuration object to modify.
 * @returns The modified configuration object.
 */
const disableGenerateClientId = (config?: Partial<IConfig>): Partial<IConfig> => {
  return {
    ...config,
    generateClientId: (): string => { return 'use a @ep2/key' }
  }
}

/**
 * Adds a connection handler that verifies the token from connecting peers for a valid EncryptedHandshake
 *
 * @see EncryptedHandshake
 * @param server The Peer server instance to modify.
 * @param serverKey The EP2Key object used for encryption.
 * @returns The modified Peer server instance with event handlers.
 */
function initialize (
  server: Express & PeerServerEvents,
  serverKey: EP2Key
): Express & PeerServerEvents {
  server.on('connection', (client: IClient) => {
    try {
      serverKey.receiveHandshake(client.getId(), JSON.parse(client.getToken()))
    } catch (error: any) {
      client.getSocket()?.close()
      console.warn('Invalid handshake: ', error.toString())
    }
  })
  return server
}
