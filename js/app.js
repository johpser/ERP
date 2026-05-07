import { db, auth } from './config.js'; 
import { 
    doc, getDoc, setDoc, addDoc, collection, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; 

// --- CONSTANTES MAESTRAS RESTAURADAS ---
const compradoresMaster = {
    "Johpser Alejandro": { tlf: "981 433 764", correo: "Jalejandro@grupoqata.pe" },
    "Paul Aster": { tlf: "957 254 498", correo: "Paster@grupoqata.pe" },
    "Dave Cardenas": { tlf: "942 628 722", correo: "Dcardenas@grupoqata.pe" },
    "Manuel Vega": { tlf: "994 624 551", correo: "Mvega@grupoqata.pe" }
};

const proyectosMaster = {
    "TORRE PRIMA": "Calle Chinchon 980, San Isidro",
    "GRID 154": "Calle Mario Valdivia 154, San Miguel",
    "WYNK": "Jr.Ucello 111, San Borja",
    "PISO 19A": "Av. EL Derby 2550, Santiago de Surco",
    "PISO 19B": "Av. EL Derby 2550, Santiago de Surco",
    "POSVENTA": "Av. Caminon Real 1236, San Isidro",
    "QUALITY": "Centro Comercial Puruchuco",
    "CORIL": "Av. EL Derby 2550, Santiago de Surco",
    "ADMIN": "Av. Caminon Real 1236, San Isidro"
};

let productosTabla = [];

// --- FUNCIONES DE CÁLCULO ---
const calcularVencimiento = () => {
    const fechaEmision = document.getElementById('fechaoc').value;
    const dias = parseInt(document.getElementById('diasCredito').value) || 0;
    
    if (fechaEmision) {
        const [y, m, d] = fechaEmision.split('-').map(Number);
        const fecha = new Date(y, m - 1, d);
        fecha.setDate(fecha.getDate() + dias);
        
        const vy = fecha.getFullYear();
        const vm = String(fecha.getMonth() + 1).padStart(2, '0');
        const vd = String(fecha.getDate()).padStart(2, '0');
        
        document.getElementById('fechaVencimiento').value = `${vy}-${vm}-${vd}`;
    }
};

const renderTabla = () => {
    const tbody = document.getElementById('detalle');
    if (!tbody) return;
    tbody.innerHTML = "";
    let subtotal = 0;
    const simb = document.getElementById('moneda').value || "S/";

    productosTabla.forEach((item, index) => {
        subtotal += item.total;
        tbody.innerHTML += `
            <tr>
                <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${item.codigo}</td>
                <td style="word-break: break-word; min-width: 220px; text-align: left; line-height: 1.2;">${item.desc}</td>
                <td style="white-space: nowrap; text-align: center;">${item.unidad}</td>
                <td style="white-space: nowrap; text-align: center;">${item.cant}</td>
                <td style="white-space: nowrap; text-align: right;">${simb} ${item.precio.toFixed(2)}</td>
                <td style="white-space: nowrap; text-align: right; font-weight: bold;">${simb} ${item.total.toFixed(2)}</td>
                <td style="text-align: center;">
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${index})">🗑️</button>
                </td>
            </tr>`;
    });

    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    document.querySelectorAll('.simbolo-moneda').forEach(el => el.innerText = simb);
    document.getElementById('subtotalTxt').innerText = subtotal.toFixed(2);
    document.getElementById('igvTxt').innerText = igv.toFixed(2);
    document.getElementById('totalTxt').innerText = total.toFixed(2);
};

window.eliminarProducto = (index) => {
    productosTabla.splice(index, 1);
    renderTabla();
};

const iniciarApp = () => {
    document.getElementById('nombreComp')?.addEventListener('change', (e) => {
        const data = compradoresMaster[e.target.value];
        document.getElementById('tlfComp').value = data ? data.tlf : "";
        document.getElementById('correoComp').value = data ? data.correo : "";
    });

    document.getElementById('proyectoComp')?.addEventListener('change', (e) => {
        const direccion = proyectosMaster[e.target.value];
        document.getElementById('lugarComp').value = direccion || "";
    });

    document.getElementById('fechaoc').addEventListener('change', calcularVencimiento);
    document.getElementById('diasCredito').addEventListener('input', calcularVencimiento);
    document.getElementById('moneda').addEventListener('change', renderTabla);

    document.getElementById('rucProv').addEventListener('blur', async (e) => {
        const ruc = e.target.value.trim();
        if (ruc.length >= 8) {
            const docSnap = await getDoc(doc(db, "proveedores", ruc));
            if (docSnap.exists()) {
                const d = docSnap.data();
                document.getElementById('razonProv').value = d.razonSocial || "";
                document.getElementById('dirProv').value = d.direccion || "";
                document.getElementById('atencionProv').value = d.atencion || "";
                document.getElementById('tlfProv').value = d.tlf || "";
                document.getElementById('corProv').value = d.correo || "";
                document.getElementById('diasCredito').value = d.diasCredito || 0;
                
                const selectorPago = document.getElementById('pagoProv');
                if (selectorPago) {
                    selectorPago.value = (d.medioPago || d.pago || "CONTADO").toUpperCase();
                }
                calcularVencimiento();
            }
        }
    });

    document.getElementById('codigoProd').addEventListener('blur', async (e) => {
        const cod = e.target.value.toUpperCase().trim();
        if (cod) {
            const snap = await getDoc(doc(db, "productos", cod));
            if (snap.exists()) document.getElementById('producto').value = snap.data().descripcion.toUpperCase();
        }
    });

    document.getElementById('btnAnadir').addEventListener('click', () => {
        const codigo = document.getElementById('codigoProd').value.toUpperCase();
        const desc = document.getElementById('producto').value.toUpperCase();
        const cant = parseFloat(document.getElementById('cantidad').value);
        const precio = parseFloat(document.getElementById('precio').value);
        const unidad = document.getElementById('unidadMedida').value;

        if (!desc || isNaN(cant) || isNaN(precio)) return alert("Datos incompletos");
        productosTabla.push({ codigo: codigo || "S/C", desc, unidad, cant, precio, total: cant * precio });
        renderTabla();
        ['codigoProd', 'producto', 'cantidad', 'precio'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('codigoProd').focus();
    });

    document.getElementById('btnCerrarSesion')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.href = '../index.html'; 
        } catch (error) { console.error("Error al salir:", error); }
    });

    document.getElementById('btnFinalizar').addEventListener('click', guardarOrden);
    document.getElementById('fechaoc').valueAsDate = new Date();
    calcularVencimiento();
};

async function guardarOrden() {
    if (productosTabla.length === 0) return alert("La tabla de productos está vacía.");
    const simb = document.getElementById('moneda').value;
    if (!simb) return alert("Por favor, seleccione un tipo de moneda.");
    
    const btn = document.getElementById('btnFinalizar');
    btn.disabled = true;
    btn.innerText = "⌛ REGISTRANDO...";

    try {
        const nroOC = await runTransaction(db, async (t) => {
            const s = await t.get(doc(db, "config", "contadorOC"));
            let n = s.exists() ? s.data().ultimoNumero + 1 : 1;
            t.set(doc(db, "config", "contadorOC"), { ultimoNumero: n });
            return `OC-${n.toString().padStart(4, '0')}`;
        });

        const data = {
            nroOC,
            nroGR: `GR-${nroOC.split('-')[1]}`,
            nroCotizacion: document.getElementById('cotiProv').value.toUpperCase(),
            moneda: simb,
            fechaEmision: document.getElementById('fechaoc').value,
            fechaVencimiento: document.getElementById('fechaVencimiento').value,
            proveedor: {
                ruc: document.getElementById('rucProv').value,
                razonSocial: document.getElementById('razonProv').value.toUpperCase(),
                direccion: document.getElementById('dirProv').value.toUpperCase(),
                atencion: document.getElementById('atencionProv').value.toUpperCase(),
                pago: document.getElementById('pagoProv').value
            },
            comprador: {
                nombre: document.getElementById('nombreComp').value.toUpperCase(),
                proyecto: document.getElementById('proyectoComp').value,
                lugarEntrega: document.getElementById('lugarComp').value.toUpperCase()
            },
            items: [...productosTabla],
            subtotal: document.getElementById('subtotalTxt').innerText,
            igv: document.getElementById('igvTxt').innerText,
            total: document.getElementById('totalTxt').innerText,
            createdAt: serverTimestamp(),
            estadoSolped: "PENDIENTE",
            estadoPago: "PENDIENTE"
        };

        await addDoc(collection(db, "ordenesCompra"), data);
        await addDoc(collection(db, "guiasRemision"), data);

        for (const item of productosTabla) {
            if (item.codigo && item.codigo !== "S/C") {
                await setDoc(doc(db, "productos", item.codigo), {
                    codigo: item.codigo,
                    descripcion: item.desc.toUpperCase(),
                    unidad: item.unidad.toUpperCase()
                }, { merge: true });
            }
        }
        
        alert(`✅ Registrado con éxito.\nOrden: ${data.nroOC}`);
        location.reload();

    } catch (e) {
        console.error("Error al registrar:", e);
        btn.disabled = false;
        btn.innerText = "💾 GUARDAR EN HISTORIAL";
    }
}

iniciarApp();