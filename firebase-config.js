/* إعداد Firebase — منصة أواب الإلكترونية
   يجب تحميل هذا الملف بعد سكربتات Firebase compat في كل صفحة */

const firebaseConfig = {
  apiKey: "AIzaSyCs5w39LYjErWKrs2e64HWp2bjgNeI9COg",
  authDomain: "awab-34353.firebaseapp.com",
  databaseURL: "https://awab-34353-default-rtdb.firebaseio.com",
  projectId: "awab-34353",
  storageBucket: "awab-34353.firebasestorage.app",
  messagingSenderId: "346798832394",
  appId: "1:346798832394:web:ea8a6a65014302a16b18f3",
  measurementId: "G-ZQGBWBHE3B"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
