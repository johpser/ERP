import { db, auth } from './config.js';
import { 
    collection, addDoc, getDocs, doc, setDoc, serverTimestamp, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tabla = document.getElementById('cuerpoTablaReq');
const datalist = document.getElementById('listaProductos');
let productosDB = [];

// --- 1. SEGURIDAD Y REDIRECCIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            const rol = userDoc.data().rol;
            const path = window.location.pathname;
            if (rol === "solicitante" && (path.includes("index.html") || path.endsWith("/"))) {
                window.location.href = "page/requerimiento.html"; 
            }
        }
    } else {
        window.location.href = '../index.html';  
    }
});

// --- 2. CARGAR PRODUCTOS PARA AUTOCOMPLETADO ---
async function cargarProductos() {
    try {
        const snap = await getDocs(collection(db, "productos"));
        datalist.innerHTML = "";
        productosDB = [];
        snap.forEach(docSnap => {
            const p = docSnap.data();
            productosDB.push(p);
            const opt = document.createElement('option');
            opt.value = p.descripcion.toUpperCase();
            datalist.appendChild(opt);
        });
    } catch (err) {
        console.error("Error cargando productos:", err);
    }
}

// --- 3. LÓGICA DE AUTOCOMPLETADO EN TABLA ---
tabla.addEventListener('input', (e) => {
    const fila = e.target.closest('tr');
    if (!fila) return;
    const inpCod = fila.querySelector('.inp-codigo');
    const inpDesc = fila.querySelector('.inp-desc');
    const inpUnd = fila.querySelector('.inp-und');

    if (e.target.classList.contains('inp-codigo')) {
        const cod = e.target.value.toUpperCase().trim();
        const match = productosDB.find(p => String(p.codigo).toUpperCase() === cod);
        if (match) {
            inpDesc.value = (match.descripcion || "").toUpperCase();
            inpUnd.value = (match.unidad || "UND").toUpperCase();
        }
    }
    if (e.target.classList.contains('inp-desc')) {
        const desc = e.target.value.toUpperCase().trim();
        const match = productosDB.find(p => p.descripcion.toUpperCase() === desc);
        if (match) {
            inpCod.value = match.codigo || "";
            inpUnd.value = (match.unidad || "UND").toUpperCase();
        }
    }
});

// --- 4. ACCIONES DE FILA (ELIMINAR Y EDITAR/LÁPIZ) ---
tabla.addEventListener('click', (e) => {
    const fila = e.target.closest('tr');

    // ELIMINAR
    if (e.target.closest('.btn-eliminar')) {
        if (document.querySelectorAll('#cuerpoTablaReq tr').length > 1) {
            fila.remove();
        } else {
            alert("No puedes eliminar la única fila disponible.");
        }
    }

    // EDITAR (LÁPIZ)
    if (e.target.closest('.btn-editar')) {
        fila.classList.add('fila-editando');
        fila.querySelector('.inp-partida').focus();
        
        // El resaltado amarillo se quita después de un momento
        setTimeout(() => {
            fila.classList.remove('fila-editando');
        }, 1200);
    }
});

// --- 5. GUARDAR REQUERIMIENTO (CON OBSERVACIÓN OPCIONAL) ---
document.getElementById('btnGuardarReq').onclick = async () => {
    const items = [];
    const filas = document.querySelectorAll('#cuerpoTablaReq tr');
    
    const selectCC = document.getElementById('reqCentroCosto');
    const centroCostoTexto = selectCC.options[selectCC.selectedIndex].text;
    const centroCostoValue = selectCC.value;

    const fechaSolicitada = document.getElementById('reqFechaSolicitada').value;
    const fechaRequerida = document.getElementById('reqFechaRequerida').value;
    const solicitante = document.getElementById('reqSolicitante').value.toUpperCase().trim();

    if (!solicitante) return alert("Por favor ingrese el nombre del solicitante");
    if (!centroCostoValue) return alert("Por favor seleccione un Centro de Costo");
    if (!fechaSolicitada || !fechaRequerida) return alert("Por favor complete ambas fechas");

    for (const fila of filas) {
        const partida = fila.querySelector('.inp-partida').value.toUpperCase().trim();
        const codigo = fila.querySelector('.inp-codigo').value.toUpperCase().trim();
        const desc = fila.querySelector('.inp-desc').value.toUpperCase().trim();
        const observacion = fila.querySelector('.inp-observacion').value.trim(); // Nueva columna
        const und = fila.querySelector('.inp-und').value.toUpperCase().trim() || "UND";
        const cant = fila.querySelector('.inp-cant').value;

        if (desc) {
            items.push({
                partida: partida || "S/P",
                codigo: codigo || "S/C",
                descripcion: desc,
                observacion: observacion || "", // Se guarda aunque esté vacío
                unidad: und,
                cantidad: cant,
                nroOC: "", 
                estadoItem: "PENDIENTE"
            });

            if (codigo && codigo !== "S/C") {
                await setDoc(doc(db, "productos", codigo), {
                    codigo: codigo,
                    descripcion: desc,
                    unidad: und
                }, { merge: true });
            }
        }
    }

    if (items.length === 0) return alert("Debe agregar al menos un producto");

    try {
        await addDoc(collection(db, "requerimientos"), {
            proyecto: document.getElementById('reqProyecto').value.toUpperCase(),
            solicitante: solicitante,
            centroCosto: centroCostoTexto,
            fechaSolicitada: fechaSolicitada,
            fechaRequerida: fechaRequerida,
            estadoGeneral: "PENDIENTE",
            fecha: new Date().toLocaleDateString(),
            createdAt: serverTimestamp(),
            items: items
        });
        alert("✅ Requerimiento guardado correctamente");
        location.reload();
    } catch (err) { 
        console.error("Error al guardar:", err);
        alert("Hubo un error al guardar el requerimiento.");
    }
};

// --- 6. GESTIÓN DE FILAS ---
document.getElementById('btnAgregarFila').onclick = () => {
    const primeraFila = tabla.querySelector('tr');
    const nuevaFila = primeraFila.cloneNode(true);
    
    // Limpiar todos los inputs de la nueva fila
    nuevaFila.querySelectorAll('input').forEach(i => i.value = "");
    nuevaFila.querySelector('.inp-cant').value = "1";
    nuevaFila.classList.remove('fila-editando');
    
    tabla.appendChild(nuevaFila);
};

// Inicialización
cargarProductos();