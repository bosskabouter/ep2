import { EP2Key, EP2Cloaked } from "@ep2/key";

interface PeriodicSyncManager {
  register: (tag: string, options?: { minInterval: number }) => Promise<void>;
}

declare global {
  interface ServiceWorkerRegistration {
    readonly periodicSync: PeriodicSyncManager;
  }
}

export async function addServiceWorkerHandle(): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    window.addEventListener("load", () => {
      if ("serviceWorker" in navigator) {
        // if (navigator.serviceWorker.controller != null) {
        //   navigator.serviceWorker.addEventListener('controllerchange', () => {
        //     // window.location.reload()
        //   })
        // }

        void navigator.serviceWorker.ready.then(async (registration) => {
          if ("periodicSync" in registration) {
            const status = await navigator.permissions.query({
              // @ts-expect-error periodic-sync is not included in the default SW interface.
              name: "periodic-background-sync",
            });

            if (status.state === "granted") {
              registration.periodicSync
                .register("UPDATE_CHECK", {
                  minInterval: 24 * 60 * 60 * 1000,
                })
                .then(() => resolve(true))
                .catch((err) => reject(err));
            }
          }

          if (window.matchMedia("(display-mode: standalone)").matches) {
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState !== "hidden") {
                navigator.serviceWorker.controller?.postMessage("UPDATE_CHECK");
                registration.update().catch(console.error);
              }
            });
          }
        });
      }
    });
  });
}

/**
 * Service worker initialization for @ep2/push
 * 1. Adds a handler for receiving encrypted push messages
 * 2. Adds a handler for Updating the key from front-end with messages handler `event.data.type === 'UPDATE_KEY'`
 * @see updateEP2ServiceWorker
 */
export function EP2PushServiceWorker(
  sw: ServiceWorkerGlobalScope,
  customHandlePush?: (notification: NotificationOptions) => void
): void {
  let key: EP2Key | undefined;
  sw.addEventListener("message", handleMessage);
  sw.addEventListener("notificationclick", handleNotificationclick);
  sw.addEventListener("push", handlePush);

  sw.addEventListener("pushsubscriptionchange", handlePushSubscriptionChange);

  /**
   *  @param event
   */
  async function handleMessage(event: ExtendableMessageEvent): Promise<void> {
    if (event.data.type === "SKIP_WAITING") {
      // This allows the web app to trigger skipWaiting
      sw.skipWaiting().catch(console.error);
    } else if (event.data.type === "UPDATE_KEY") {
      // UPDATE_KEY event to receive (updated) EP2Key from front-end
      key = await EP2Key.fromJson(event.data.key);
    }
  }

  function handleNotificationclick(event: NotificationEvent): void {
    event.notification.close();

    event.waitUntil(
      sw.clients
        .matchAll({ type: "window" })
        .then((clientsArr: readonly WindowClient[]) => {
          // console.debug('Open windows: ' + clientsArr)
          // If a Window tab matching the targeted URL already exists, focus that;
          const hadWindowToFocus = clientsArr.some(
            (windowClient: WindowClient) =>
              windowClient.url.includes(self.location.origin) === true
                ? (windowClient.focus(), true)
                : false
          );
          // Otherwise, open a new tab to the applicable URL and focus it.
          if (!hadWindowToFocus) {
            const dataString: string = event.notification.data.toString();
            sw.clients
              .openWindow(`${self.location.origin}/messages/${dataString}`)
              .then(async (windowClient) =>
                windowClient != null ? windowClient.focus() : null
              )
              .catch(console.error);
          }
        })
    );
  }

  async function handlePush(pushEvent: PushEvent): Promise<void> {
    console.debug("pushEvent received:", pushEvent);

    if (key?.id === undefined) {
      pushEvent.waitUntil(
        Promise.reject("No key yet to handle Secure Push Event")
      );
      return;
    }
    const payload: string = pushEvent.data?.text() ?? "";
    if (payload.length === 0) {
      console.warn("No push data available");
      return;
    }
    let relayedMessage: EP2Cloaked<NotificationOptions>;
    try {
      relayedMessage = pushEvent.data?.json();
      await EP2Cloaked.revive(relayedMessage);
    } catch (error) {
      console.warn("Invalid PushRequest", error);
      return;
    }

    let options: NotificationOptions;
    try {
      options = relayedMessage.decrypt(key);
      console.debug("received push from: " + relayedMessage.sender);
    } catch (error) {
      //wait until key is resolved
      pushEvent.waitUntil(
        Promise.reject("Unable decrypting PushRequest" + error)
      );
      console.warn("Unable to decrypt PushRequest", error);
      return;
    }

    const actionOpen = {
      title: "Open",
      action: "open",
    };
    const actionClose = {
      title: "Close",
      action: "close",
    };

    options = {
      ...options,
      vibrate: [1000, 2000, 3000, 4000, 5000],
      actions: [actionOpen, actionClose],
    };

    customHandlePush?.(options);
    sw.registration.showNotification("Pushed", options).catch(console.error);
  }

  function handlePushSubscriptionChange(event: any): void {
    event.waitUntil(
      sw.registration.pushManager
        .subscribe(event.oldSubscription.options)
        .then(function (subscription) {
          console.warn(
            "Push Subscription changed... Not implemented",
            subscription
          );
        })
        .catch(function (error: any) {
          // Report the error
          event.waitUntil(Promise.reject(error));
        })
    );
  }
}
