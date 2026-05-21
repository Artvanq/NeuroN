import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js');
}

export async function getPushConfig() {
  const { data } = await api.get('/push/config');
  return data;
}

export async function subscribeWebPush() {
  if (!isWebPushSupported()) {
    throw new Error('This browser does not support web push notifications');
  }

  const { enabled, publicKey } = await getPushConfig();
  if (!enabled || !publicKey) {
    throw new Error('Push notifications are not enabled on this server');
  }

  await ensureServiceWorker();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  const { data } = await api.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: json.keys,
  });
  return data;
}

export async function unsubscribeWebPush() {
  if (!isWebPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await api.delete('/push/subscribe', { data: { endpoint } });
  await subscription.unsubscribe();
}

export async function listPushSubscriptions() {
  const { data } = await api.get('/push/subscriptions');
  return data.subscriptions || [];
}
