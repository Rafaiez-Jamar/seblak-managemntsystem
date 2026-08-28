import { supabase } from './supabase'

function withTimeout(promise, message, milliseconds = 10000) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), milliseconds)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

export async function enablePushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Browser ini belum mendukung push notification.')
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!vapidKey) throw new Error('VITE_VAPID_PUBLIC_KEY belum diset di .env.')
  const applicationServerKey = urlBase64ToUint8Array(vapidKey)
  if (applicationServerKey.byteLength !== 65) {
    throw new Error('VAPID public key tidak valid. Generate ulang pasangan VAPID key dan salin Public Key lengkap.')
  }

  const permission = await withTimeout(
    Notification.requestPermission(),
    'Permintaan izin notifikasi tidak mendapat respons.',
  )
  if (permission !== 'granted') throw new Error('Izin notifikasi tidak diberikan.')

  const registration = await withTimeout(
    navigator.serviceWorker.register('/push-sw.js', { scope: '/push/' }),
    'Service worker belum siap. Refresh halaman lalu coba lagi.',
  )
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      }),
      'Browser gagal membuat subscription notifikasi.',
    )
  }

  const { error } = await withTimeout(
    supabase.from('push_subscriptions').upsert(
      { user_id: userId, subscription: subscription.toJSON() },
      { onConflict: 'user_id' },
    ),
    'Supabase tidak merespons. Pastikan tabel push_subscriptions sudah dibuat.',
  )
  if (error) throw new Error(error.message)
  return subscription
}
