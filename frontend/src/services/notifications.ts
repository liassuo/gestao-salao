import { api } from './api';

/** Busca a VAPID public key do backend */
async function getVapidPublicKey(): Promise<string> {
  const { data } = await api.get('/notifications/vapid-public-key');
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

/** Registra push notifications para o admin/profissional */
export async function subscribeAdminToPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    await api.post('/notifications/subscribe', subscription.toJSON());
    return true;
  } catch (error) {
    console.error('Failed to subscribe admin to push:', error);
    return false;
  }
}
