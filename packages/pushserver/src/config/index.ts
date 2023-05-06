import type { CorsOptions } from "cors";

export interface IConfig {
  readonly vapidSubject: string;
  readonly host: string;
  readonly port: number;
  readonly expire_timeout: number;
  readonly alive_timeout: number;
  readonly key: string;
  readonly path: string;
  readonly concurrent_limit: number;
  readonly allow_discovery: boolean;
  readonly proxied: boolean | string;
  readonly cleanup_out_msgs: number;
  readonly ssl?: {
    key: string;
    cert: string;
  };
  readonly corsOptions: CorsOptions;

  pushMaxBytes: number;
}

const defaultConfig: IConfig = {
  vapidSubject: "mailto:test@test.org",
  host: "::",
  port: 9000,
  expire_timeout: 5000,
  alive_timeout: 60000,
  key: "ep2push",
  path: "/ep2push",
  concurrent_limit: 5000,
  allow_discovery: false,
  proxied: false,
  cleanup_out_msgs: 1000,
  corsOptions: { origin: true },

  pushMaxBytes: 4 * 1000,
};
export default defaultConfig;
