import type { Server as HttpsServer } from "https";
import type { Server as HttpServer } from "http";
import type { Express } from "express";
import {
  type IClient,
  type IConfig,
  type PeerServerEvents,
  PeerServer,
  ExpressPeerServer,
} from "peer";

import { EP2Key } from "@ep2/key";

export * from "@ep2/key";

interface EP2PeerServerEvents {
  on: (
    event: "handshake-error",
    listener: (event: {
      client: IClient;
      token: string;
      message: string;
    }) => void
  ) => this;
}
/**
 * Returns a secure Express Peer server instance.
 *
 * @param ep2key The EP2Key object used for encryption.
 * @param server An HTTP or HTTPS server instance.
 * @param options Optional configuration options. See peerJS options
 * @see PeerServer
 * @returns An Express instance with SecurePeerServerEvents.
 */
export function ExpressEP2PeerServer(
  ep2key: EP2Key,
  server: HttpsServer | HttpServer,
  options?: Partial<IConfig>
): Express & PeerServerEvents & EP2PeerServerEvents {
  return initialize(ExpressPeerServer(server, options), ep2key);
}

/**
 * Returns a secure Peer server instance.
 *
 * @param ep2key The EP2Key object used for encryption.
 * @param options Optional configuration options.
 * @param callback An optional callback function to be executed after the server is created.
 * @returns An Express instance with PeerServerEvents.
 */
export default function EP2PeerServer(
  ep2key: EP2Key,
  options?: Partial<IConfig>,
  callback?: (server: HttpsServer | HttpServer) => void
): Express & PeerServerEvents & EP2PeerServerEvents {
  return initialize(PeerServer(options, callback), ep2key);
}

/**
 * Adds a connection handler that verifies the token from connecting peers for a valid EncryptedHandshake
 *
 * @see EncryptedHandshake
 * @param server The Peer server instance to modify.
 * @param ep2key The EP2Key object used for encryption.
 * @returns The modified Peer server instance with event handlers.
 */
function initialize(
  server: Express & PeerServerEvents,
  ep2key: EP2Key
): Express & PeerServerEvents & EP2PeerServerEvents {
  server.on("connection", (client: IClient) => {
    const token = client.getToken();
    const clientId = client.getId();
    try {
      const decrypted = ep2key.initSecureChannel(clientId).decrypt(token) as {
        serverId: string;
        clientId: string;
      };

      if (
        decrypted.clientId !== client.getId() &&
        decrypted.serverId !== ep2key.id
      )
        throw Error("Client?server IDs do not match");
      console.debug("Welcome peer: " + clientId);
    } catch (error: any) {
      const msg = `Invalid Handshake: ${error as string} `;
      console.debug(msg, token, error);
      client.getSocket()?.close();
      server.emit("handshake-error", { client, token, msg });
    }
  });
  return server as Express & PeerServerEvents & EP2PeerServerEvents;
}
