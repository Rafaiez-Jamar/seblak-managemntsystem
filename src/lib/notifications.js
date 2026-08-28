import { supabase } from './supabase'

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

export async function enablePushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Browser ini belum mendukung push notification.')
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) throw new Error('VITE_VAPID_PUBLIC_KEY belum diset di .env.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Izin notifikasi tidak diberikan.')

  const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/push/' })
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, subscription: subscription.toJSON() },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
  return subscription
}
