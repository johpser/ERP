import { db, auth } from './config.js'; 
import { 
    doc, getDoc, setDoc, addDoc, collection, runTransaction, serverTimestamp, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; 

// --- 1. SEGURIDAD Y CONTROL DE ACCESO ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const rol = userDoc.data().rol.toLowerCase();
                // Bloqueo si no es admin e intenta acceder a orden.html
                if (rol !== "admin" && window.location.pathname.includes("orden.html")) {
                    window.location.href = "menu2.html";
                }
            }
        } catch (error) {
            console.error("Error validando permisos:", error);
        }
    } else {
        window.location.href = '../index.html';
    }
});

// --- 2. CONSTANTES MAESTRAS ---
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
    "ADMIN": "Av. Caminon Real 1236, San Isidro",
    "FUXION": "Av. EL Derby 2550, Santiago de Surco"
};

let productosTabla = [];
let listaMaestraProductos = []; // Almacena el catálogo de productos de Firestore en memoria

// --- 3. FUNCIONES DE CÁLCULO ---
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
                <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; font-size: 11px;">${item.codigo}</td>
                <td style="word-break: break-word; min-width: 220px; text-align: left; line-height: 1.2;">${item.desc}</td>
                <td style="white-space: nowrap; text-align: center;">${item.unidad}</td>
                <td style="white-space: nowrap; text-align: center;">${item.cant}</td>
                <td style="white-space: nowrap; text-align: right;">${simb} ${item.precio.toFixed(2)}</td>
                <td style="white-space: nowrap; text-align: right; font-weight: bold;">${simb} ${item.total.toFixed(2)}</td>
                <td style="text-align: center;">
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${index})"><i class="bi bi-trash"></i></button>
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

// --- 4. PDF GENERACIÓN ---
async function generarPDF_OC(data) {
    const element = document.createElement('div');
    element.innerHTML = `
        <div style="padding: 10mm; font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="width: 25%;"><img src="../imagenes/LOGOQATA.png" style="width: 140px;"></div>
                <div style="width: 50%; text-align: center;">
                    <h2 style="margin: 0; color: #007bff; font-size: 18px;">QATA ASOCIADOS S.A.C.</h2>
                    <p style="margin: 0; font-size: 10px;">PASTER@GRUPOQATA.PE | RUC: 20605226362</p>
                </div>
                <div style="width: 25%; border: 2px solid #333; text-align: center; padding: 10px; background: #f8f9fa;">
                    <h5 style="margin: 0; font-size: 11px;">ORDEN DE COMPRA</h5>
                    <h4 style="margin: 5px 0; color: #dc3545; font-size: 16px;">${data.nroOC}</h4>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; border: 1px solid #333;">
                <thead>
                    <tr style="background: #212529; color: white; text-align: center;">
                        <th style="padding: 8px; border: 1px solid #333; width: 18%;">CÓD.</th>
                        <th style="padding: 8px; border: 1px solid #333; text-align: left; width: 42%;">DESCRIPCIÓN</th>
                        <th style="padding: 8px; border: 1px solid #333; width: 10%;">UND</th>
                        <th style="padding: 8px; border: 1px solid #333; width: 10%;">CANT.</th>
                        <th style="padding: 8px; border: 1px solid #333; width: 10%;">P. UNIT</th>
                        <th style="padding: 8px; border: 1px solid #333; width: 10%;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(i => `
                        <tr>
                            <td style="border: 1px solid #333; padding: 4px 2px; text-align: center; font-size: 8px; word-break: break-all;">${i.codigo}</td>
                            <td style="border: 1px solid #333; padding: 6px; font-size: 9.5px;">${i.desc}</td>
                            <td style="border: 1px solid #333; padding: 6px; text-align: center;">${i.unidad}</td>
                            <td style="border: 1px solid #333; padding: 6px; text-align: center;">${i.cant}</td>
                            <td style="border: 1px solid #333; padding: 6px; text-align: right;">${parseFloat(i.precio).toFixed(2)}</td>
                            <td style="border: 1px solid #333; padding: 6px; text-align: right; font-weight: bold;">${parseFloat(i.total).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                <div style="width: 180px; font-size: 11px; line-height: 1.6;">
                    <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <b>${data.moneda} ${data.subtotal}</b></div>
                    <div style="display: flex; justify-content: space-between;"><span>IGV (18%):</span> <b>${data.moneda} ${data.igv}</b></div>
                    <div style="display: flex; justify-content: space-between; border-top: 1.5px solid #333; padding-top: 4px; font-size: 13px; color: #007bff;">
                        <span>TOTAL:</span> <b>${data.moneda} ${data.total}</b>
                    </div>
                </div>
            </div>
        </div>`;

    const opt = { 
        margin: 0, 
        filename: `${data.nroOC}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 3, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    html2pdf().set(opt).from(element).save();
}

// --- 5. LÓGICA DE BÚSQUEDA INTERACTIVA DE PRODUCTOS (CATÁLOGO EN MEMORIA) ---
async function cargarCatalogoProductos() {
    try {
        const querySnapshot = await getDocs(collection(db, "productos"));
        listaMaestraProductos = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            listaMaestraProductos.push({
                codigo: data.codigo || "",
                descripcion: data.descripcion || "",
                unidad: data.unidad || "UND"
            });
        });
        console.log(`✅ Catálogo cargado: ${listaMaestraProductos.length} productos listos para la búsqueda.`);
    } catch (error) {
        console.error("Error al precargar el catálogo de productos:", error);
    }
}

function configurarBuscadoresInteractivos() {
    const codigoProd = document.getElementById('codigoProd');
    const productoDesc = document.getElementById('producto');
    const unidadMedida = document.getElementById('unidadMedida');
    
    const sugerenciasCodigo = document.getElementById('sugerenciasCodigo');
    const sugerenciasDesc = document.getElementById('sugerenciasDesc');

    if (!codigoProd || !productoDesc) return;

    // A. Filtrar coincidencias mientras se escribe en el Código de Producto
    codigoProd.addEventListener('input', () => {
        const term = codigoProd.value.toLowerCase().trim();
        if (term === "") {
            sugerenciasCodigo.style.display = 'none';
            return;
        }

        const filtrados = listaMaestraProductos.filter(p => p.codigo.toLowerCase().includes(term));
        if (filtrados.length === 0) {
            sugerenciasCodigo.style.display = 'none';
            return;
        }

        renderizarPanelFlotante(sugerenciasCodigo, filtrados, codigoProd, productoDesc, unidadMedida);
    });

    // B. Filtrar coincidencias en vivo mientras se escribe en la Descripción
    productoDesc.addEventListener('input', () => {
        const term = productoDesc.value.toLowerCase().trim();
        if (term === "") {
            sugerenciasDesc.style.display = 'none';
            return;
        }

        const filtrados = listaMaestraProductos.filter(p => 
            p.descripcion.toLowerCase().includes(term) || 
            p.codigo.toLowerCase().includes(term)
        );

        if (filtrados.length === 0) {
            sugerenciasDesc.style.display = 'none';
            return;
        }

        renderizarPanelFlotante(sugerenciasDesc, filtrados, codigoProd, productoDesc, unidadMedida);
    });

    // Ocultar las tablas emergentes al hacer clic fuera de las cajas de texto de búsqueda
    document.addEventListener('click', (e) => {
        if (e.target !== codigoProd && e.target !== productoDesc) {
            if (sugerenciasCodigo) sugerenciasCodigo.style.display = 'none';
            if (sugerenciasDesc) sugerenciasDesc.style.display = 'none';
        }
    });
}

function renderizarPanelFlotante(contenedor, lista, inpCod, inpDesc, selUnd) {
    let html = `<table class="table table-sm table-hover border bg-white mb-0 shadow-sm" style="font-size:0.8rem; text-align: left;"><tbody>`;
    
    lista.slice(0, 8).forEach(p => {
        html += `
            <tr data-codigo="${p.codigo}" data-descripcion="${p.descripcion}" data-unidad="${p.unidad}">
                <td class="fw-bold text-primary" style="width: 25%;">${p.codigo}</td>
                <td style="width: 55%;">${p.descripcion}</td>
                <td class="text-muted text-center" style="width: 20%;">${p.unidad}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    
    contenedor.innerHTML = html;
    contenedor.style.display = 'block';

    contenedor.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inpCod.value = row.getAttribute('data-codigo').toUpperCase();
            inpDesc.value = row.getAttribute('data-descripcion').toUpperCase();
            
            if (selUnd) {
                selUnd.value = normalizarUnidad(row.getAttribute('data-unidad'));
            }
            
            contenedor.style.display = 'none';
        });
    });
}

function normalizarUnidad(und) {
    const u = String(und).toUpperCase().trim();
    if (u === "MTR" || u === "METRO") return "MTR";
    if (u === "GLN" || u === "GALON" || u === "GALÓN") return "GLN";
    if (u === "CAJA") return "CAJA";
    if (u === "PAQ" || u === "PQT" || u === "PAQUETE") return "PAQ";
    if (u === "MLL" || u === "MILLAR") return "MLL";
    if (u === "KG" || u === "KILOGRAMO") return "KG";
    return "UND";
}

// --- 6. INICIALIZACIÓN DE LA APP ---
const iniciarApp = async () => {
    await cargarCatalogoProductos();
    configurarBuscadoresInteractivos();

    // Eventos Comprador
    document.getElementById('nombreComp')?.addEventListener('change', (e) => {
        const data = compradoresMaster[e.target.value];
        document.getElementById('tlfComp').value = data ? data.tlf : "";
        document.getElementById('correoComp').value = data ? data.correo : "";
    });

    document.getElementById('proyectoComp')?.addEventListener('change', (e) => {
        const direccion = proyectosMaster[e.target.value];
        document.getElementById('lugarComp').value = direccion || "";
    });

    // Eventos Fechas y Moneda
    document.getElementById('fechaoc')?.addEventListener('change', calcularVencimiento);
    document.getElementById('diasCredito')?.addEventListener('input', calcularVencimiento);
    document.getElementById('moneda')?.addEventListener('change', renderTabla);

    // Búsqueda Proveedor por RUC
    document.getElementById('rucProv')?.addEventListener('blur', async (e) => {
        const ruc = e.target.value.trim();
        if (ruc.length >= 8) {
            const docSnap = await getDoc(doc(db, "proveedores", ruc));
            if (docSnap.exists()) {
                const d = docSnap.data();
                document.getElementById('razonProv').value = d.razonSocial || "";
                document.getElementById('dirProv').value = d.direccion || "";
                document.getElementById('atencionProv').value = d.atencion || "";
                document.getElementById('tlfProv').value = d.tlf || "";
                document.getElementById('corProv').value = d.corProv || d.correo || "";
                document.getElementById('diasCredito').value = d.diasCredito || 0;
                
                const selectorPago = document.getElementById('pagoProv');
                if (selectorPago) selectorPago.value = (d.medioPago || d.pago || "CONTADO").toUpperCase();
                calcularVencimiento();
            }
        }
    });

    // Búsqueda Producto por Código Exacto
    document.getElementById('codigoProd')?.addEventListener('blur', async (e) => {
        const cod = e.target.value.toUpperCase().trim();
        if (cod) {
            const snap = await getDoc(doc(db, "productos", cod));
            if (snap.exists()) {
                document.getElementById('producto').value = snap.data().descripcion.toUpperCase();
                document.getElementById('unidadMedida').value = normalizarUnidad(snap.data().unidad);
            }
        }
    });

    // Añadir Producto a Tabla
    document.getElementById('btnAnadir')?.addEventListener('click', () => {
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

    // Cerrar Sesión
    document.getElementById('btnCerrarSesion')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await signOut(auth); window.location.href = '../index.html'; } catch (error) { console.error("Error al salir:", error); }
    });

    document.getElementById('btnFinalizar')?.addEventListener('click', guardarOrden);
    
    if (document.getElementById('fechaoc')) {
        if (!document.getElementById('fechaoc').value) {
            document.getElementById('fechaoc').valueAsDate = new Date();
        }
        calcularVencimiento();
    }
};

// --- 7. GUARDADO EN FIREBASE ---
async function guardarOrden() {
    if (productosTabla.length === 0) return alert("La tabla de productos está vacía.");
    const rucProv = document.getElementById('rucProv').value.trim();
    if (!rucProv) return alert("Ingrese el RUC del proveedor.");

    const btn = document.getElementById('btnFinalizar');
    btn.disabled = true;
    btn.innerText = "⌛ REGISTRANDO...";

    try {
        // Transacción para obtener correlativo OC
        const nroOC = await runTransaction(db, async (t) => {
            const s = await t.get(doc(db, "config", "contadorOC"));
            let n = s.exists() ? s.data().ultimoNumero + 1 : 1;
            t.set(doc(db, "config", "contadorOC"), { ultimoNumero: n });
            return `OC-${n.toString().padStart(4, '0')}`;
        });

        const data = {
            nroOC,
            nroGR: `GR-${nroOC.split('-')[1]}`,
            fechaEmision: document.getElementById('fechaoc').value,
            fechaVencimiento: document.getElementById('fechaVencimiento').value,
            nroCotizacion: document.getElementById('nroCotizacion').value.toUpperCase(),
            moneda: document.getElementById('moneda').value,
            subtotal: document.getElementById('subtotalTxt').innerText,
            igv: document.getElementById('igvTxt').innerText,
            total: document.getElementById('totalTxt').innerText,
            items: [...productosTabla],
            createdAt: serverTimestamp(),
            estadoSolped: "PENDIENTE",
            estadoPago: "PENDIENTE",
            proveedor: { 
                ruc: rucProv, 
                razonSocial: document.getElementById('razonProv').value.toUpperCase(),
                direccion: document.getElementById('dirProv').value.toUpperCase(),
                atencion: document.getElementById('atencionProv').value.toUpperCase(),
                pago: document.getElementById('pagoProv').value,
                tlf: document.getElementById('tlfProv').value,
                correo: document.getElementById('corProv').value,
                diasCredito: document.getElementById('diasCredito').value
            },
            comprador: {
                nombre: document.getElementById('nombreComp').value.toUpperCase(),
                proyecto: document.getElementById('proyectoComp').value,
                lugarEntrega: document.getElementById('lugarComp').value.toUpperCase()
            }
        };

        // Guardar OC y Guía
        await addDoc(collection(db, "ordenesCompra"), data);
        await addDoc(collection(db, "guiasRemision"), data);

        // Upsert de Proveedor para histórico
        await setDoc(doc(db, "proveedores", rucProv), data.proveedor, { merge: true });

        // ❌ ELIMINADO EL BUCLE DE GUARDADO DE NUEVOS PRODUCTOS AQUÍ ❌
        // Ningún código escrito manualmente se registrará en la colección "productos".

        await generarPDF_OC(data);
        alert(`✅ Registrado con éxito: ${nroOC}`);
        location.reload();
    } catch (e) {
        console.error(e);
        btn.disabled = false;
        btn.innerText = "💾 GUARDAR ORDEN DE COMPRA";
    }
}

iniciarApp();