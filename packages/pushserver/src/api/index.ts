import cors, { type CorsOptions } from "cors";
import express from "express";
import PublicApi from "./v1/public";
import type { EP2PushServerConfig } from "../config";
import * as publicContent from "../app.json";
import { type EP2Key } from "@ep2/key";

export const Api = ({
  key,
  config,
  corsOptions,
}: {
  key: EP2Key;
  config: EP2PushServerConfig;
  corsOptions: CorsOptions;
}): express.Router => {
  const app = express.Router();
  app.use(cors(corsOptions));

  app.get("/", (_, res) => {
    res.send(publicContent);
  });

  app.use("/", PublicApi({ key, config }));

  return app;
};
