export default "@ep2/key";
import Peer, { CallOption } from "peerjs";
import {
  PeerJSOption,
  PeerConnectOption,
  DataConnection,
  MediaConnection,
} from "peerjs";
import EventEmitter from "eventemitter3";
import { EP2Key, EP2SecureChannel } from "@ep2/key";
export * from "@ep2/key";

type EP2PeerEvents = {
  connected: EP2SecureLayer;
  close: void;
  error: Error;
  iceStateChanged: RTCIceConnectionState;
  open: (id: string, isEP2Server: boolean) => void;
  disconnected: (currentId: string) => void;
};

export class EP2Peer extends EventEmitter<EP2PeerEvents> {
  peer: Peer;

  readonly isEp2PeerServer: Promise<boolean> = Promise.resolve(false);
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
    options: PeerJSOption = {}
  ) {
    super(); //emitter

    if (serverPublicKey) {
      //secureLayer used only during handshake
      const token = key
        .initSecureChannel(serverPublicKey)
        .encrypt({ serverId: serverPublicKey, peerId: key.id });

      options = {
        ...options,
        token: token,
      };
      this.isEp2PeerServer = this.testEp2Server(options);
    }
    this.peer = new Peer(key.id, options);
    this.peer.on("open", (serverAssignedId) =>
      this.handleOpen(serverAssignedId)
    );
    this.peer.on("connection", (dataConnection) =>
      this.handleConnection(dataConnection)
    );
    this.peer.on("call", (mediaConnection) =>
      this.secureChannel(mediaConnection)
    );

    //simply re-emit the other events
    this.peer.on("error", (e) => this.emit("error", e));
    this.peer.on("disconnected", (currentId) =>
      this.emit("disconnected", currentId)
    );
    this.peer.on("close", () => this.emit("close"));
  }
  /**
   * Creates a new Connection to the peer using given options. A handshake is initiated to establish a common shared secret.
   * @param peerId
   * @param options CAUTION: metadata is replaced with handshake
   * @returns
   */
  // @override
  connect(peerId: string, options?: PeerConnectOption): EP2SecureLayer {
    const secureChannel = this.key.initSecureChannel(peerId);
    const conn = this.peer.connect(peerId, {
      ...options,
      metadata: secureChannel.encrypt({ tx: this.key.id, rx: peerId }),
    });
    return new EP2SecureLayer(conn, secureChannel);
  }

  /**
   * Handler for new incoming DataConnections. A SecurePeer closes the socket from any dataConnection without a valid handshake. A new `SecureLayer` used to communicate over the dataConnection with the other peer is emitted on the "connected" event of this ep2peer.
   * @param dataConnection the unencrypted incoming dataConnection
   */
  private handleConnection(dataConnection: DataConnection): void {
    const secureChannel = this.secureChannel(dataConnection);
    if (secureChannel !== undefined) {
      const secureLayer = new EP2SecureLayer(dataConnection, secureChannel);
      this.emit("connected", secureLayer);
    }
  }

  /**
   * Validates all (data and media) incoming connections for a valid handshake in metadata. Connection is closed if not found or invalid.
   * @param connection
   * @returns undefined if con.metadata doesn't contain a valid EncryptedHandshake
   * @see EncryptedHandshake
   */
  private secureChannel(
    connection: MediaConnection | DataConnection
  ): EP2SecureChannel | undefined {
    try {
      return this.key.initSecureChannel(connection.peer);
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
  private handleOpen(serverAssignedId: string): void {
    if (serverAssignedId !== this.key.id) {
      throw Error("server assigned different ID");
    }
    console.info("Emitted open");
    this.emit("open", serverAssignedId, false);
  }

  /**
   * Tests if the current connecting server accepts a normal (non-secure) peer client.
   * @returns true if the tested connection was closed.
   */
  private async testEp2Server(options: PeerJSOption): Promise<boolean> {
    const insecurePeer = new Peer(`${Math.round(Math.random() * 1000000000)}`, {
      ...options,
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
    return this.peer.options as PeerJSOption;
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

export type EP2SecureLayerEvents = {
  /**
   * Emitted when data is received from the remote peer.
   */
  decrypted: (data: unknown) => void;
  /**
   * Emitted when the connection is established and ready-to-use.
   */
  open: () => void;
  close: () => void;
  error: (error: Error) => void;
  iceStateChanged: (state: RTCIceConnectionState) => void;
};

export class EP2SecureLayer extends EventEmitter<EP2SecureLayerEvents> {
  constructor(
    readonly dataConnection: DataConnection,
    readonly secureChannel: EP2SecureChannel
  ) {
    super();
    this.dataConnection.on("close", () => {
      this.emit("close");
    });

    this.dataConnection.on("error", (e) => {
      this.emit("error", e);
    });
    this.dataConnection.on("iceStateChanged", (state) => {
      this.emit("iceStateChanged", state);
    });
    this.dataConnection.on("open", () => {
      this.dataConnection.on("data", (data: any) => {
        const decrypted: string = this.secureChannel.decrypt(data);
        super.emit("decrypted", decrypted);
      });

      this.emit("open");
    });
  }

  /**
   * Sends the data over a secureChannel
   * @param data
   * @param chunked
   */
  send(data: any, chunked?: boolean | undefined): void {
    this.dataConnection.send(this.secureChannel.encrypt(data), chunked);
  }
}
