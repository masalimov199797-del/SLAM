/* Настройки подключения SLAM к Firebase.
   Это публичные настройки проекта (не пароли): они в любом случае видны в коде сайта.
   Firebase Console → Project settings → Your apps → Web app → firebaseConfig */
self.SLAM_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  // Firebase Console → Project settings → Cloud Messaging → Web Push certificates → Key pair
  vapidKey: ""
};
