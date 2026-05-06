import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBx9FkpKgYRDJxajqFhUA7tJf-8KDvxAjk",
  authDomain:        "casacerta-prod.firebaseapp.com",
  projectId:         "casacerta-prod",
  storageBucket:     "casacerta-prod.firebasestorage.app",
  messagingSenderId: "389775598993",
  appId:             "1:389775598993:web:11f17f46695b75c3876630"
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);