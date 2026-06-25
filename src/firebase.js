import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCEULc8YpA2wColDcBZC-Pip7iYj2tVII8",
  authDomain: "logistic-track-golf.firebaseapp.com",
  projectId: "logistic-track-golf",
  storageBucket: "logistic-track-golf.firebasestorage.app",
  messagingSenderId: "243107402665",
  appId: "1:243107402665:web:dcce060dcf314b919e2ab8",
  measurementId: "G-83E6128MTW",
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
