import { clientApi } from './api';

/** Busca a VAPID public key do backend */
async function getVapidPublicKey(): Promise<string> {
  const { data } = await clientApi.get('/notifications/vapid-public-key');
  return data.publicKey;
}

/** Converte a VAPID key de base64 para Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Pede permissão e registra as push notifications */
export async function subscribeToPushNotifications(): Promise<boolean> {
  try {
    // 1. Verificar suporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    // 2. Verificar permissão atual antes de pedir (evita spam de prompt)
    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      return false;
    }

    // 3. Buscar VAPID key
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) {
      console.warn('VAPID public key not available');
      return false;
    }

    // 4. Obter service worker registration
    const registration = await navigator.serviceWorker.ready;

    // 5. Verificar se já existe subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 6. Criar nova subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    // 7. Enviar subscription pro backend
    await clientApi.post('/notifications/subscribe', subscription.toJSON());

    return true;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return false;
  }
}

/** Remove a push subscription */
export async function unsubscribeFromPushNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await clientApi.delete('/notifications/unsubscribe', {
        data: { endpoint: subscription.endpoint },
      });
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
  }
}
