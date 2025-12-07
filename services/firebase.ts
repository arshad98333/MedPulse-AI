
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { logger } from "./logger";

const firebaseConfig = {
  apiKey: "AIzaSyDfXBB4TfCg08D3M55ynTzytubD5onVFvE",
  authDomain: "ngx-64387.firebaseapp.com",
  projectId: "ngx-64387",
  storageBucket: "ngx-64387.firebasestorage.app",
  messagingSenderId: "988959667118",
  appId: "1:988959667118:web:7b6841f6666af7af8d8e3f",
  measurementId: "G-3KPSZPZ8LW"
};

// Initialize Firebase
logger.info("Firebase", "Initializing Firebase App...");
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

logger.success("Firebase", "Services initialized (Auth, Firestore, Storage, Analytics)");

export { app, analytics, db, storage };
