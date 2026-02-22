import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCCJo6QgRi2ux0D-n47vSUofO2jfrHqq1k",
    authDomain: "banttu-store.firebaseapp.com",
    projectId: "banttu-store",
    storageBucket: "banttu-store.firebasestorage.app",
    messagingSenderId: "1084587905851",
    appId: "1:1084587905851:web:eae24b6b913f8ad242dd1e",
    measurementId: "G-Q0BJELXV0Z"
};

let app;
let db;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY_AQUI") {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("Conectado a Firebase (Módulos)");
    } catch(e) { console.error("Error Firebase:", e); }
}

export { db, collection, doc, addDoc, setDoc, deleteDoc, getDoc, onSnapshot };