// Put this file at /Website-DIPMAS/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// Paste your firebaseConfig object here (from Firebase console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "922158977601",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background message handler:
messaging.onBackgroundMessage(function(payload) {
  // payload.notification.title and payload.notification.body
  const title = payload.notification?.title || 'Notification';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon.png' // optional
  };
  self.registration.showNotification(title, options);
});
