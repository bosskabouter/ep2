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
import version from "./version";

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
export function ExpressEP2PeerServer(
  ep2key: EP2Key,
  server: HttpsServer | HttpServer,
  options?: Partial<IConfig>
): Express & PeerServerEvents & EP2PeerServerEvents {
  return initialize(ExpressPeerServer(server, options), ep2key);
}

export default function EP2PeerServer(
  ep2key: EP2Key,
  options?: Partial<IConfig>,
  callback?: (server: HttpsServer | HttpServer) => void
): Express & PeerServerEvents & EP2PeerServerEvents {
  return initialize(PeerServer(options, callback), ep2key);
}

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
        peerId: string;
      };

      if (
        decrypted.peerId !== client.getId() ||
        decrypted.serverId !== ep2key.id
      ) {
        throw Error("Invalid Handshake: " + client.getId());
      }
    } catch (error: any) {
      client.getSocket()?.close();
      server.emit("handshake-error", { client, token, error });
    }
  });
  server.get("/version", (_req, res) => res.send(version));
  return server as Express & PeerServerEvents & EP2PeerServerEvents;
}
