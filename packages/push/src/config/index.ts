/**
 * Required access parameters for the EP2PushServer
 */
export interface EP2PushConfig {
  /**
   * Use http / https, defaults to false
   */
  readonly secure: boolean;

  /**
   * destination host
   */
  readonly host: string;

  /**
   * TCP port to access the service
   */
  readonly port: number;

  /**
   * Context of the service
   */
  readonly path: string;

  /**
   *
   */
  readonly ep2PublicKey: string;
}

const defaultConfig: EP2PushConfig = {
  secure: false,
  host: "localhost",
  port: 9001,
  path: "/ep2push",
  ep2PublicKey: "5bf52cba5e433cfe488db5985d30e83c20755dc624f6d4797245bb8f5b04e302",
};

export default defaultConfig;
