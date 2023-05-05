import express, { type Express } from "express";
import type * as webpush from "web-push";
import http from "node:http";
import https from "node:https";

import { createInstance } from "./instance";
import type { IConfig } from "./config";
import defaultConfig from "./config";
import { type EP2Key } from "@ep2/key";
export * from "@ep2/key";

function ExpressEP2PushServer(
  key: EP2Key,
  vapid: {
    keys: webpush.VapidKeys;
    subject: string;
  },
  server: https.Server | http.Server,
  options?: Partial<IConfig>
): Express {
  const app = express();

  const newOptions: IConfig = {
    ...defaultConfig,
    ...options,
  };

  if (newOptions.proxied !== undefined) {
    app.set(
      "trust proxy",
      newOptions.proxied === "false" ? false : newOptions.proxied
    );
  }

  app.on("mount", () => {
    if (server === undefined || server === null) {
      throw new Error(
        "Server is not passed to constructor - " + "can't start PeerServer"
      );
    }

    createInstance({ vapid, key, app, options: newOptions });
  });

  return app as Express;
}

function EP2PushServer(
  key: EP2Key,
  vapid: {
    keys: webpush.VapidKeys;
    subject: string;
  },
  options: Partial<IConfig> = {},
  callback?: (server: https.Server | http.Server) => void
): Express {
  const app = express();

  let newOptions: IConfig = {
    ...defaultConfig,
    ...options,
  };

  const port = newOptions.port;
  const host = newOptions.host;

  let server: https.Server | http.Server;

  const { ssl, ...restOptions } = newOptions;
  if (ssl != null && Object.keys(ssl).length > 0) {
    server = https.createServer(ssl, app);

    newOptions = restOptions;
  } else {
    server = http.createServer(app);
  }

  const eP2PeerServer = ExpressEP2PushServer(key, vapid, server, newOptions);
  app.use(eP2PeerServer);

  server.listen(port, host, () => callback?.(server));

  return eP2PeerServer;
}

export {
  ExpressEP2PushServer,
  EP2PushServer,
};
