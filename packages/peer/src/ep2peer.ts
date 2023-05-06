import Peer, { CallOption } from "peerjs";
import {
  PeerJSOption,
  PeerConnectOption,
  DataConnection,
  MediaConnection,
} from "peerjs";
import { SecureLayer } from "./securelayer";
import { type SecureChannel, type EP2Key } from ".";
import EventEmitter from "eventemitter3";

/**
 * A SecurePeer has a guaranteed verified identity and establishes encrypted P2P communication over trusted connections.
 */

type EP2PeerEvents = {
  /**
   * Emitted when a connection to the PeerServer is established.
   */
  open: (id: string, isEP2Server: boolean) => void;
  /**
   * Emitted when a new data connection is established from a remote peer.
   */
  connection: SecureChannel;
  /**
   * Emitted when a remote peer attempts to call you.
   */
  call: (mediaConnection: MediaConnection) => void;
  /**
   * Emitted when the peer is destroyed and can no longer accept or create any new connections.
   */
  close: void;
  /**
   * Emitted when the peer is disconnected from the signalling server
   */
  disconnected: (currentId: string) => void;
  /**
   * Errors on the peer are almost always fatal and will destroy the peer.
   */
  error: (error: Error) => void;
};
export class EP2Peer extends EventEmitter<EP2PeerEvents> {
  peer: Peer;

  readonly isEp2PeerServer: Promise<boolean>;
  /**
   * Creates a SecurePeer with given key. It connects to a peerserver, just like a normal peer. If a serverPublicKey is given, it will use it to initiate a secure handshake. If no serverPublicKey is given, it will connect to any normal peerserver.
   * @param key gives id of the peer
  disconnected: any;
   * @param options normal peerjs connection options. token will be used to pass the secure
   *  @see PeerJSOption
   * @param serverPublicKey the public key of the EP2OnlineServer connecting with. If the server is a normal PeerServer, this argument is optional.
   */
  constructor(
    private readonly key: EP2Key,
    public readonly serverPublicKey?: string,
    options?: PeerJSOption
  ) {
    super();
    const expectEp2Server = serverPublicKey !== undefined;
    this.peer = new Peer(
      key.peerId,
      !expectEp2Server
        ? options
        : (options = {
            ...options,
            token: JSON.stringify(
              key.initiateHandshake(serverPublicKey).handshake
            ),
          })
    );
    this.peer.on("open", this.handleOpenServer);
    this.peer.on("connection", this.handleDataConnection);
    this.peer.on("call", this.validateConnection);

    //simply re-emit the other events
    this.peer.on("error", (e) => this.emit("error", e));
    this.peer.on("disconnected", (currentId) =>
      this.emit("disconnected", currentId)
    );
    this.peer.on("close", () => this.emit("close"));

    this.isEp2PeerServer = expectEp2Server
      ? this.testEp2Server()
      : Promise.resolve(false);
  }
  /**
   * Creates a new Connection to the peer using given options. A handshake is initiated to establish a common shared secret.
   * @param peerId
   * @param options CAUTION: metadata is replaced with handshake
   * @returns
   */
  // @override
  connect(peerId: string, options?: PeerConnectOption): SecureLayer {
    const initiatedHandShake = this.key.initiateHandshake(peerId);
    const conn = this.peer.connect(peerId, {
      ...options,
      metadata: initiatedHandShake.handshake,
    });
    return new SecureLayer(initiatedHandShake.secureChannel, conn);
  }

  /**
   * Handler for new incoming DataConnections. A SecurePeer closes the socket from any dataConnection without a valid handshake. A new `SecureLayer` used to communicate with the other peer is placed in `dataConnection.metadata.secureLayer`
   * @param dataConnection the unencrypted incoming dataConnection
   */
  private handleDataConnection(dataConnection: DataConnection): void {
    const secureChannel = this.validateConnection(dataConnection);
    if (secureChannel !== undefined) {
      dataConnection.metadata.secureLayer = new SecureLayer(
        secureChannel,
        dataConnection
      );
    }
  }

  /**
   * Validates all (data and media) incoming connections for a valid handshake in metadata. Connection is closed if not found or invalid.
   * @param connection
   * @returns undefined if con.metadata doesn't contain a valid EncryptedHandshake
   * @see EncryptedHandshake
   */
  private validateConnection(
    connection: MediaConnection | DataConnection
  ): SecureChannel | undefined {
    try {
      return this.key.receiveHandshake(connection.peer, connection.metadata);
    } catch (e: unknown) {
      connection.close();
      console.warn("Invalid handshake from connection:", e, connection);
      super.emit("error", new Error("Invalid handshake"));
      return undefined;
    }
  }

  /**
   * Handler for opening connection to peerServer. Makes sure the id passed by the server is indeed the request SecurePeer.peerId
   * @param serverAssignedId
   */
  private handleOpenServer(serverAssignedId: string): void {
    if (serverAssignedId !== this.key.peerId) {
      throw Error("server assigned different ID");
    }
  }

  /**
   * Tests if the current connecting server accepts a normal (non-secure) peer client.
   * @returns true if the tested connection was closed.
   */
  private async testEp2Server(): Promise<boolean> {
    const insecurePeer = new Peer(`${Math.round(Math.random() * 1000000000)}`, {
      ...this.peer.options,
      debug: 0,
      logFunction(_logLevel, ..._rest) {},
    });
    return await new Promise((resolve) => {
      insecurePeer.on("disconnected", (): void => {
        clearTimeout(connectionTimeout);
        resolve(true);
      });
      const connectionTimeout = setTimeout(() => {
        // server should have disconnected if it were secured
        resolve(false);
        insecurePeer.destroy();
      }, 5000);
    });
  }

  call(
    peer: string,
    stream: MediaStream,
    options?: CallOption | undefined
  ): MediaConnection {
    //todo include handshake
    return this.peer.call(peer, stream, options);
  }

  /**
   * Wrapper methods to behave like a peer
   */

  get open() {
    return this.peer.open;
  }
  get disconnected() {
    return this.peer.disconnected;
  }
  get destroyed() {
    return this.peer.destroyed;
  }
  get id() {
    return this.peer.id;
  }
  get options() {
    return this.peer.options;
  }
  disconnect() {
    this.peer.disconnect();
  }
  destroy() {
    this.peer.destroy();
  }
  reconnect() {
    this.peer.reconnect();
  }
  getConnection(
    peerId: string,
    connectionId: string
  ): DataConnection | MediaConnection | null {
    return this.peer.getConnection(peerId, connectionId);
  }

  listAllPeers(cb?: ((_: any[]) => void) | undefined): void {
    this.peer.listAllPeers(cb);
  }
}
