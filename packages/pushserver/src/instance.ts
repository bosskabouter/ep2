import express from "express";

import { type EP2PushServerConfig } from "./config";
import { Api } from "./api";
import { EP2Key } from "./";

export const createInstance = ({
  key,
  app,
  options,
}: {
  key: EP2Key;
  app: express.Application;
  options: EP2PushServerConfig;
}): void => {
  
  const config: EP2PushServerConfig = { ...options };
  const api = Api({ key, config, corsOptions: options.corsOptions });
  app.use(express.json());
  app.use(options.path, api);
  /**
   * The destination endpoint, encrypted for the server by its owner.
   * @param encryptedEndpoint
   * @returns
   */

  app.emit("started", {});
};
