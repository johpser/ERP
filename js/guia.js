import { db } from './config.js';
import { 
    doc, getDoc, addDoc, collection, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- MAESTROS PARA GUÍAS INDEPENDIENTES ---
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

let itemsGuia = [];

const iniciarGuia = () => {
    // 1. Llenado automático de dirección por proyecto
    const selectProyecto = document.getElementById('proyectoComp');
    if (selectProyecto) {
        selectProyecto.addEventListener('change', (e) => {
            const direccion = proyectosMaster[e.target.value];
            document.getElementById('lugarComp').value = direccion || "";
        });
    }

    // 2. Buscar producto por código (Llenado automático desde Firestore)
    const inputCodigo = document.getElementById('codigoProd');
    if (inputCodigo) {
        inputCodigo.addEventListener('blur', async (e) => {
            const cod = e.target.value.toUpperCase().trim();
            if (cod) {
                try {
                    const snap = await getDoc(doc(db, "productos", cod));
                    if (snap.exists()) {
                        document.getElementById('producto').value = snap.data().descripcion.toUpperCase();
                    }
                } catch (error) {
                    console.error("Error al buscar producto:", error);
                }
            }
        });
    }

    // 3. Añadir productos a la tabla local
    document.getElementById('btnAnadir').addEventListener('click', () => {
        const codigo = document.getElementById('codigoProd').value.toUpperCase();
        const desc = document.getElementById('producto').value.toUpperCase();
        const cant = parseFloat(document.getElementById('cantidad').value);
        const unidad = document.getElementById('unidadMedida').value;

        if (!desc || isNaN(cant) || cant <= 0) return alert("Complete descripción y cantidad válida.");

        itemsGuia.push({ codigo: codigo || "S/C", desc, cant, unidad });
        renderTablaGuia();
        
        // Limpiar campos y devolver foco
        ['codigoProd', 'producto', 'cantidad'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('codigoProd').focus();
    });

    // 4. Botón Finalizar (Guardar en Firebase y Descargar PDF)
    document.getElementById('btnFinalizar').addEventListener('click', finalizarGuia);
};

// --- RENDERIZADO DE TABLA ---
function renderTablaGuia() {
    const tbody = document.getElementById('detalle');
    if (!tbody) return;
    tbody.innerHTML = "";

    itemsGuia.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${item.codigo}</td>
                <td class="text-start">${item.desc}</td>
                <td>${item.unidad}</td>
                <td class="fw-bold">${item.cant}</td>
                <td><button class="btn btn-danger btn-sm" onclick="eliminarItemGuia(${index})">🗑️</button></td>
            </tr>`;
    });
}

window.eliminarItemGuia = (index) => {
    itemsGuia.splice(index, 1);
    renderTablaGuia();
};

// --- GUARDADO Y GENERACIÓN DE PDF ---
async function finalizarGuia() {
    if (itemsGuia.length === 0) return alert("Añada al menos un artículo.");
    
    const btn = document.getElementById('btnFinalizar');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> PROCESANDO...`;

    try {
        // A. Obtener correlativo GR-ALM mediante transacción
        const refCounter = doc(db, "config", "contadorGuiaManual");
        const nroGR = await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(refCounter);
            let nuevoNum = snap.exists() ? snap.data().ultimoNumero + 1 : 1;
            transaction.set(refCounter, { ultimoNumero: nuevoNum });
            return `GR-ALM-${nuevoNum.toString().padStart(4, '0')}`;
        });

        // B. Estructura de datos para Firestore
        const dataGuia = {
            nroGR,
            nroOC: "ALMACÉN", // Referencia para el historial
            fechaTraslado: new Date().toLocaleDateString('es-PE'),
            proveedor: {
                razonSocial: "QATA ASOCIADOS S.A.C.",
                ruc: "20605226362",
                direccion: document.getElementById('dirProv').value
            },
            comprador: {
                proyecto: document.getElementById('proyectoComp').value,
                lugarEntrega: document.getElementById('lugarComp').value.toUpperCase()
            },
            items: [...itemsGuia],
            createdAt: serverTimestamp()
        };

        // C. Guardar en la colección unificada
        await addDoc(collection(db, "guiasRemision"), dataGuia);
        
        // D. Generar PDF con el diseño Estilo OC
        await generarPDFGuia_Template(dataGuia);

        alert("✅ Guía " + nroGR + " generada y descargada.");
        location.reload();

    } catch (e) {
        console.error(e);
        alert("Error al procesar la guía.");
        btn.disabled = false;
        btn.innerText = "💾 GUARDAR E IMPRIMIR GUÍA";
    }
}

// --- FUNCIÓN DE IMPRESIÓN (DISEÑO ESTILO ORDEN DE COMPRA) ---
async function generarPDFGuia_Template(data) {
    const element = document.createElement('div');
    
    element.innerHTML = `
        <div style="padding: 10mm; font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="width: 25%;">
                    <img src="../imagenes/LOGOQATA.png" style="width: 140px;" onerror="this.style.display='none'">
                </div>
                <div style="width: 45%; text-align: center; font-size: 11px; line-height: 1.4;">
                    <h3 style="margin: 0; color: #333; font-size: 16px;">QATA ASOCIADOS S.A.C.</h3>
                    <p style="margin: 0;">Av. Camino Real 1236, San Isidro - Lima</p>
                    <p style="margin: 0;">RUC: 20605226362 | Paster@grupoqata.pe</p>
                    <p style="margin: 0;">TLF: 957 254 498</p> 
                </div>
                <div style="width: 30%; border: 2.5px solid #000; text-align: center; padding: 12px; border-radius: 10px; background: #f0f7ff;">
                    <h5 style="margin: 0; font-size: 13px;">RUC: 20605226362</h5>
                    <h4 style="margin: 5px 0; font-size: 15px;">GUÍA DE REMISIÓN</h4>
                    <h3 style="margin: 0; color: #dc3545; font-size: 18px;">${data.nroGR}</h3>
                </div>
            </div>

            <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
                <div style="background: #007bff; color: white; padding: 6px 10px; font-weight: bold; font-size: 12px;">INFORMACIÓN DEL TRASLADO</div>
                <div style="padding: 12px; font-size: 11px; display: flex; justify-content: space-between; gap: 20px; line-height: 1.6;">
                    <div style="flex: 1;">
                        <b style="color: #007bff;">DESTINO / PROYECTO:</b><br>
                        ${data.comprador.proyecto}
                    </div>
                    <div style="flex: 1;">
                        <b style="color: #007bff;">PUNTO PARTIDA:</b><br>
                        ${data.proveedor.direccion || 'Av. Camino Real 1236, San Isidro'}
                    </div>
                    <div style="flex: 1;">
                        <b style="color: #007bff;">PUNTO LLEGADA:</b><br>
                        ${data.comprador.lugarEntrega}
                    </div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px;">
                <thead>
                    <tr style="background: #212529; color: white; text-align: center;">
                        <th style="padding: 10px; border: 1px solid #333; width: 15%;">Cód.</th>
                        <th style="padding: 10px; border: 1px solid #333; text-align: left;">Descripción</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 10%;">Und.</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 10%;">Cant.</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(i => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #666;">${i.codigo}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${i.desc}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${i.unidad}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${i.cant}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 100px; display: flex; justify-content: center; text-align: center; font-size: 11px;">
                <div style="border-top: 1px solid #333; width: 250px; padding-top: 8px;">
                    <b>RECIBIDO POR EL PROYECTO</b><br>
                    <span style="color: #666;">Nombre / DNI / Firma</span>
                </div>
            </div>
        </div>`;

    const opt = {
        margin: 0,
        filename: `${data.nroGR}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    return html2pdf().set(opt).from(element).save();
}

// Inicializar la lógica
iniciarGuia();

import { auth } from './config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Lógica para el botón salir
document.getElementById('btnCerrarSesion')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await signOut(auth);
        window.location.href = '../index.html';
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
});