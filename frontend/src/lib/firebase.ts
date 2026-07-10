import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, onDisconnect, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://my-pivot-5ff68-default-rtdb.firebaseio.com"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Helper function to get lock ref for a book
export const getBookLockRef = (bookId: number) => ref(db, `locks/${bookId}`);
// Helper function to broadcast an update signal globally
export const getGlobalUpdateRef = () => ref(db, `updates/global`);
export const broadcastGlobalUpdate = () => {
  set(getGlobalUpdateRef(), Date.now());
};
