import { auth } from './config.js'; 
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const btnIngresar = document.getElementById('btnIngresar');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        
        if (!email || !password) return;

        // Bloquear botón para evitar múltiples clics
        btnIngresar.disabled = true;
        btnIngresar.innerText = "VERIFICANDO...";
        if (errorMessage) errorMessage.style.display = 'none';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            
            // ✅ REDIRECCIÓN A LA CARPETA PAGE DESDE LA RAÍZ
            window.location.href = 'page/requerimiento.html'; 

        } catch (error) {
            btnIngresar.disabled = false;
            btnIngresar.innerText = "ENTRAR AL SISTEMA";
            
            if (errorMessage) {
                errorMessage.style.display = 'block';
                if (error.code === 'auth/invalid-credential') {
                    errorMessage.innerText = "Correo o contraseña incorrectos.";
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage.innerText = "Demasiados intentos. Intente más tarde.";
                } else {
                    errorMessage.innerText = "Error al intentar ingresar.";
                }
            }
        }
    });
}