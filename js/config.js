import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Configuración de Firebase para Sistema-Qata
const firebaseConfig = {
    apiKey: "AIzaSyAc2Akj5cets8PcdqZ4MXU4lK-noh3xYug",
    authDomain: "sistema-qata.firebaseapp.com",
    projectId: "sistema-qata",
    storageBucket: "sistema-qata.firebasestorage.app",
    messagingSenderId: "610295475362",
    appId: "1:610295475362:web:bbb5f3311c3f812a3cfbfb",
    measurementId: "G-7044XEH0EJ"
};

// Inicializar la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// EXPORTACIONES MAESTRAS
// db: para base de datos Firestore
// auth: para gestión de usuarios
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("✅ Configuración de Firebase cargada correctamente.");