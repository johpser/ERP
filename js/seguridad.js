import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

onAuthStateChanged(auth, async (user) => {

    const paginaActual = window.location.pathname.split("/").pop();

    if (!user) {
        if (paginaActual !== "login.html") {
            window.location.href = "../page/login.html";
        }
        return;
    }

    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const rol = userSnap.data().rol;

    const paginasPermitidas = {
        admin: [
            "guia.html",
            "historial_reque.html",
            "historial.html",
            "historial2.html",
            "login.html",
            "requerimiento.html",
            "index.html"
        ],

        editor: [
            "requerimiento.html",
            "historial_reque.html",
            "login.html"
        ]
    };

    const permitidas = paginasPermitidas[rol] || [];

    // 🚫 BLOQUEO CON MODAL
    if (!permitidas.includes(paginaActual)) {
        mostrarModalAcceso(() => {
            window.location.href = "../page/requerimiento.html";
        });
        return;
    }
});


// 🔥 MODAL DE ACCESO DENEGADO
function mostrarModalAcceso(callback) {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0,0,0,0.6)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 25px;
            border-radius: 10px;
            text-align: center;
            width: 300px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        ">
            <h3 style="color:red;">Acceso denegado</h3>
            <p>No tiene acceso a esta página.</p>
            <button id="btnCerrar" style="
                margin-top: 15px;
                padding: 8px 15px;
                background: #d33;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            ">Aceptar</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btnCerrar").onclick = () => {
        modal.remove();
        if (callback) callback();
    };
}