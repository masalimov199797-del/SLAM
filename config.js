/* Настройки подключения SLAM к Supabase.
   Supabase → Project Settings → API (или Data API):
   supabaseUrl — Project URL, supabaseKey — anon / publishable key.
   Это публичные значения (не пароли): они в любом случае видны в коде сайта. */
self.SLAM_CONFIG = {
  supabaseUrl: "https://ytzxcxyabsicvmslvqhv.supabase.co",
  supabaseKey: "sb_publishable_rqU4Pd17dfpY5GYgiqFiaw_uORt1PU3",
  // Публичный ключ для push-уведомлений (пара к VAPID_PRIVATE_KEY в секретах функции)
  vapidPublicKey: "BAdS17dPmgHl8ZmJke4jDHXcaDg30xuc35mGkEm88NbxOtsRiy1-WGrXWYnW0HGpwprQuBItOZ8X2wBNVojldzk"
};
