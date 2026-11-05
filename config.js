/* Настройки подключения SLAM к Supabase.
   Supabase → Project Settings → API (или Data API):
   supabaseUrl — Project URL, supabaseKey — anon / publishable key.
   Это публичные значения (не пароли): они в любом случае видны в коде сайта. */
self.SLAM_CONFIG = {
  supabaseUrl: "",
  supabaseKey: "",
  // Публичный ключ для push-уведомлений (пара к VAPID_PRIVATE_KEY в секретах функции)
  vapidPublicKey: "BAdS17dPmgHl8ZmJke4jDHXcaDg30xuc35mGkEm88NbxOtsRiy1-WGrXWYnW0HGpwprQuBItOZ8X2wBNVojldzk"
};
