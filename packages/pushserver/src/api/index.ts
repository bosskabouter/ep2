import cors, { type CorsOptions } from "cors";
import express from "express";
import PublicApi from "./v1/public";
import type { EP2PushServerConfig } from "../config";
import * as publicContent from "../app.json";
import { EP2Key } from "..";
import version from "./version";

export const Api = ({
  key,
  config,
  corsOptions,
}: {
  key: EP2Key;
  config: EP2PushServerConfig;
  corsOptions: CorsOptions;
}): express.Router => {
  const router = express.Router();
  router.use(cors(corsOptions));

  router.get("/", (_, res) => {
    res.send(publicContent);
  });
  router.get("/version", (_, res) => {
    res.send(version);
  });
  router.use("/", PublicApi({ key, config }));

  return router;
};
