import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Ye line add ki hai
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfRzhpxDET-RAuE9yUadEO82ViqqlqdeI",
  authDomain: "islamia-pharmacy.firebaseapp.com",
  projectId: "islamia-pharmacy",
  storageBucket: "islamia-pharmacy.firebasestorage.app",
  messagingSenderId: "237606779990",
  appId: "1:237606779990:web:6917b7cc0d8f4f9d084ff7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Ye line add ki hai
export const storage = getStorage(app);