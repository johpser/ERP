import { db, auth } from './config.js';
import { 
    collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const tablaHistorial = document.getElementById('tablaHistorial');

// --- 1. SEGURIDAD Y VALIDACIÓN DE ROL ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const rol = userDoc.data().rol.toLowerCase();
                console.log("Acceso verificado para historial:", rol);
            }
        } catch (error) {
            console.error("Error validando permisos:", error);
        }
    } else {
        window.location.href = '../index.html';
    }
});

// --- 2. ESCUCHA EN TIEMPO REAL ---
function iniciarEscuchaHistorial() {
    const q = query(collection(db, "ordenesCompra"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        renderizarTabla(snapshot);
        aplicarFiltros(); 
    }, (error) => {
        console.error("Error en tiempo real:", error);
    });
}

// --- 3. RENDERIZADO DE LA TABLA ---
function renderizarTabla(snapshot) {
    if (!tablaHistorial) return;
    tablaHistorial.innerHTML = "";

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const fila = document.createElement('tr');

        const estadoSolped = d.estadoSolped || 'PENDIENTE';
        const estadoPago = d.estadoPago || 'PENDIENTE';
        const formaPago = d.proveedor?.pago || '---';
        const tieneFacturaAdjunta = !!d.facturaPdfBase64;
        
        const colorSolped = estadoSolped === 'ENVIADA' ? 'btn-success' : (estadoSolped === 'ANULADA' ? 'btn-danger' : 'btn-warning');
        const colorPago = estadoPago === 'PAGO REALIZADO' ? 'btn-primary' : 'btn-secondary';
        
        const facturaValue = d.factura || '';
        const solpedCodeValue = d.codigoSolped || '';
        const simb = d.moneda || 'S/';

        // --- LÓGICA DE ALERTA DE VENCIMIENTO (3 DÍAS ANTES) ---
        let alertaVencimiento = "";
        if (d.fechaVencimiento && estadoPago !== 'PAGO REALIZADO') {
            const fVenc = new Date(d.fechaVencimiento + "T00:00:00");
            const diffTime = fVenc - hoy;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 3) {
                alertaVencimiento = "color: red; font-weight: bold;";
            }
        }

        fila.innerHTML = `
            <td class="fw-bold">${d.nroOC || 'S/N'}</td>
            <td class="fw-bold text-primary small">${formaPago}</td>
            <td>
                <div class="d-flex align-items-center gap-1 justify-content-center">
                    <input type="text" class="form-control form-control-sm text-center input-editable" 
                        value="${facturaValue}" 
                        data-id="${id}" data-campo="factura"
                        placeholder="Factura" ${facturaValue !== '' ? 'disabled' : ''} style="width: 100px;">
                    
                    <button class="btn btn-sm p-0 border-0 btn-adjuntar-base64" data-id="${id}" title="${tieneFacturaAdjunta ? 'Ver Factura Adjunta' : 'Adjuntar Factura'}">
                        <i class="bi ${tieneFacturaAdjunta ? 'bi-file-earmark-check-fill text-primary' : 'bi-paperclip text-secondary'} h5"></i>
                    </button>
                </div>
            </td>
            <td>${d.fechaEmision || '---'}</td>
            <td class="small">${d.nroCotizacion || '---'}</td>
            <td style="${alertaVencimiento}">${d.fechaVencimiento || '---'}</td>
            <td class="text-start">${d.proveedor?.razonSocial || '---'}</td>
            <td>${(d.comprador?.proyecto || '---').toUpperCase()}</td>
            <td>
                <input type="text" class="form-control form-control-sm text-center input-editable" 
                    value="${solpedCodeValue}" 
                    data-id="${id}" data-campo="codigoSolped"
                    placeholder="Código" ${solpedCodeValue !== '' ? 'disabled' : ''}>
            </td>
            <td>
                <button class="btn btn-sm ${colorSolped} w-100 btn-estado" data-id="${id}" data-campo="estadoSolped" data-valor="${estadoSolped}" ${estadoSolped !== 'PENDIENTE' ? 'disabled' : ''}>${estadoSolped}</button>
            </td>
            <td>
                <button class="btn btn-sm ${colorPago} w-100 btn-estado" data-id="${id}" data-campo="estadoPago" data-valor="${estadoPago}" ${estadoPago !== 'PENDIENTE' ? 'disabled' : ''}>${estadoPago}</button>
            </td>
            <td class="fw-bold">${simb} ${d.total || '0.00'}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary btn-pdf" data-id="${id}" data-accion="ver"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-outline-success btn-pdf" data-id="${id}" data-accion="descargar"><i class="bi bi-download"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-anular" data-id="${id}"><i class="bi bi-x-circle"></i></button>
                </div>
            </td>
        `;
        tablaHistorial.appendChild(fila);
    });
}

// --- 4. LÓGICA PARA ADJUNTAR / VER FACTURA ---
tablaHistorial.addEventListener('click', async (e) => {
    const btnAdjuntar = e.target.closest('.btn-adjuntar-base64');
    if (!btnAdjuntar) return;

    const id = btnAdjuntar.dataset.id;
    const docRef = doc(db, "ordenesCompra", id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();

    if (data.facturaPdfBase64) {
        const win = window.open();
        win.document.write(`<iframe src="${data.facturaPdfBase64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 1000000) return alert("El archivo es muy pesado. Máximo 1MB.");
            btnAdjuntar.innerHTML = `<span class="spinner-border spinner-border-sm text-primary"></span>`;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64String = event.target.result;
                try {
                    await updateDoc(docRef, { facturaPdfBase64: base64String });
                    alert("✅ Factura adjuntada con éxito.");
                } catch (err) {
                    console.error(err);
                    alert("Error al guardar la factura.");
                    renderizarTabla();
                }
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }
});

// --- 5. GENERACIÓN DE PDF ---
async function generarPDF_Historial(data, modo) {
    const simb = data.moneda || "S/";
    const element = document.createElement('div');
    const subtotalVal = data.subtotal || (parseFloat(data.total) / 1.18).toFixed(2);
    const igvVal = data.igv || (parseFloat(data.total) - parseFloat(subtotalVal)).toFixed(2);

    element.innerHTML = `
        <div style="padding: 10mm; font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="width: 25%;">
                    <img src="../imagenes/LOGOQATA.png" style="width: 150px;" onerror="this.src='https://via.placeholder.com/150x60?text=QATA+ASOCIADOS'">
                </div>
                <div style="width: 45%; text-align: center; font-size: 11px; line-height: 1.4;">
                    <h3 style="margin: 0; color: #030303; font-size: 16px;">QATA ASOCIADOS S.A.C.</h3>
                    <p style="margin: 0;">Av. Camino Real 1236, San Isidro - Lima</p>
                    <p style="margin: 0;">Email: Paster@grupoqata.pe</p> 
                    <p style="margin: 0;">Telefono: 957 254 498</p> 
                </div>
                <div style="width: 30%; border: 2.5px solid #000; text-align: center; padding: 12px; border-radius: 10px; background: #f0f7ff;">
                    <h5 style="margin: 0; font-size: 13px;">RUC: 20605226362</h5>
                    <h4 style="margin: 5px 0; font-size: 15px;">ORDEN DE COMPRA</h4>
                    <h3 style="margin: 0; color: #dc3545; font-size: 18px;">${data.nroOC}</h3>
                </div>
            </div>
            <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                <div style="flex: 1; border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
                    <div style="background: #007bff; color: white; padding: 6px 10px; font-weight: bold; font-size: 12px;">DATOS DEL PROVEEDOR</div>
                    <div style="padding: 10px; font-size: 11px; line-height: 1.6;">
                        <b>SEÑORES:</b> ${data.proveedor?.razonSocial || '---'}<br>
                        <b>RUC:</b> ${data.proveedor?.ruc || '---'}<br>
                        <b>DIRECCIÓN:</b> ${data.proveedor?.direccion || '---'}<br>
                        <b>ATENCIÓN:</b> ${data.proveedor?.atencion || '---'}
                    </div>
                </div>
                <div style="flex: 1; border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
                    <div style="background: #007bff; color: white; padding: 6px 10px; font-weight: bold; font-size: 12px;">DETALLES DEL DOCUMENTO</div>
                    <div style="padding: 10px; font-size: 11px; line-height: 1.6;">
                        <b>FECHA EMISIÓN:</b> ${data.fechaEmision || '---'}<br>
                        <b>N° COTIZACIÓN:</b> ${data.nroCotizacion || '---'}<br>
                        <b>FECHA VENC.:</b> <span style="color:red; font-weight:bold;">${data.fechaVencimiento || '---'}</span><br>
                        <b>LUGAR ENTREGA:</b> ${data.comprador?.lugarEntrega || '---'}<br>
                        <b>SOLICITADO POR:</b> ${data.comprador?.nombre || '---'}
                    </div>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; table-layout: fixed;">
                <thead>
                    <tr style="background: #212529; color: white; text-align: center;">
                        <th style="padding: 10px; border: 1px solid #333; width: 100px;">CÓD.</th>
                        <th style="padding: 10px; border: 1px solid #333; text-align: left;">DESCRIPCIÓN</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 45px;">UND</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 45px;">CANT.</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 80px;">P. UNIT</th>
                        <th style="padding: 10px; border: 1px solid #333; width: 90px;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(i => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 12px 8px; text-align: center; font-size: 8px; word-break: break-all; line-height: 1.5; vertical-align: middle;">${i.codigo}</td>
                            <td style="border: 1px solid #ddd; padding: 12px 8px; word-wrap: break-word; line-height: 1.5; vertical-align: middle;">${i.desc}</td>
                            <td style="border: 1px solid #ddd; padding: 12px 8px; text-align: center; vertical-align: middle;">${i.unidad}</td>
                            <td style="border: 1px solid #ddd; padding: 12px 8px; text-align: center; font-weight: bold; vertical-align: middle;">${i.cant}</td>
                            <td style="border: 1px solid #ddd; padding: 12px 8px; text-align: right; vertical-align: middle;">${simb} ${parseFloat(i.precio).toFixed(2)}</td>
                            <td style="border: 1px solid #ddd; padding: 12px 8px; text-align: right; font-weight: bold; vertical-align: middle;">${simb} ${parseFloat(i.total).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display: flex; justify-content: flex-end; margin-bottom: 20px; page-break-inside: avoid;">
                <div style="width: 35%; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; padding: 4px 0;">Subtotal: ${simb} ${subtotalVal}</div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0;">IGV (18%): ${simb} ${igvVal}</div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #007bff; font-weight: bold; color: #007bff; font-size: 15px;">TOTAL: ${simb} ${data.total || '0.00'}</div>
                </div>
            </div>
            <div style="margin-top: 10px; display: flex; gap: 15px; page-break-inside: avoid;">
                <div style="flex: 1; border: 1px solid #333; border-radius: 12px; padding: 15px; font-size: 11px; text-align: center;">
                    <div style="border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase;">DOCUMENTACIÓN OBLIGATORIA</div>
                    <div style="text-align: justify; line-height: 1.4;">Se solicita adjuntar todos los documentos técnicos y de respaldo correspondientes a los productos cotizados, según aplique, tales como: certificados de calidad, garantías del fabricante o distribuidor. Estos documentos son requisitos obligatorios para la validación y recepción conforme de los materiales.</div>
                </div>
                <div style="flex: 1; border: 1px solid #333; border-radius: 12px; padding: 15px; font-size: 10.5px; text-align: center;">
                    <div style="border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 10px; font-weight: bold; text-transform: uppercase;">TÉRMINOS Y CONDICIONES</div>
                    <div style="text-align: left; line-height: 1.3;">1. La recepción de esta orden constituye aceptación de condiciones.<br>
                        2. Anotar número de OC en guía y factura.<br>
                        3. La compañía se reserva el derecho de devolución parcial o total.<br>
                        4. El proveedor es responsable hasta la recepción satisfactoria.<br>
                        5. No atender a precios mayores sin autorización escrita.<br>
                        6. Enviar factura con OC firmada y guía sellada.<br>
                        7. Crédito se cuenta desde la recepción del material.<br>
                        8. Prohibida la cesión o transferencia de esta orden.<br>
                        9. Indicar si es agente de percepción.<br>
                        10. Adjuntar detalle y cuenta de detracciones si aplica.</div>
                </div>
            </div>
          <div style="text-align: center; width: 100%; page-break-inside: avoid;">
                <img src="../imagenes/sello.png" style="width: 70px; height: auto;">
            </div>
        </div>
    `;

    const opt = {
        margin: 0,
        filename: `${data.nroOC}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    if (modo === 'ver') {
        html2pdf().set(opt).from(element).outputPdf('bloburl').then(url => { window.open(url, '_blank'); });
    } else {
        html2pdf().set(opt).from(element).save();
    }
}

// --- EVENTOS Y FILTROS ---
tablaHistorial.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    if (target.classList.contains('btn-adjuntar-base64')) return;

    const { id, campo, valor, accion } = target.dataset;

    if (target.classList.contains('btn-estado')) {
        if (valor !== 'PENDIENTE') return;
        let nuevoValor = campo === 'estadoSolped' ? 'ENVIADA' : (campo === 'estadoPago' ? 'PAGO REALIZADO' : '');
        if (nuevoValor) await updateDoc(doc(db, "ordenesCompra", id), { [campo]: nuevoValor });
    }

    if (target.classList.contains('btn-pdf')) {
        const docSnap = await getDoc(doc(db, "ordenesCompra", id));
        if (docSnap.exists()) generarPDF_Historial(docSnap.data(), accion);
    }

    if (target.classList.contains('btn-anular')) {
        if (confirm("¿Seguro que desea ANULAR esta orden?")) {
            await updateDoc(doc(db, "ordenesCompra", id), {
                estadoSolped: "ANULADA", total: "0.00", subtotal: "0.00", igv: "0.00"
            });
        }
    }
});

tablaHistorial.addEventListener('keypress', async (e) => {
    if (e.target.classList.contains('input-editable') && e.key === 'Enter') {
        const id = e.target.dataset.id;
        const campo = e.target.dataset.campo;
        const valor = e.target.value.trim();

        if (valor === "") return;

        try {
            const docRef = doc(db, "ordenesCompra", id);
            await updateDoc(docRef, { [campo]: valor });
            e.target.disabled = true;
            alert(`✅ ${campo.toUpperCase()} guardado correctamente.`);
        } catch (error) {
            console.error("Error al guardar:", error);
            alert("❌ Error al guardar el dato.");
        }
    }
});

function aplicarFiltros() {
    const term = document.getElementById('busqueda').value.toLowerCase();
    const proyecto = document.getElementById('filtroProyecto').value.toUpperCase();
    const solped = document.getElementById('filtroSolped').value;
    const pago = document.getElementById('filtroPago').value;
    
    // Filtros de fecha
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;

    const filas = tablaHistorial.querySelectorAll('tr');

    filas.forEach(fila => {
        const textoFila = fila.innerText.toLowerCase();
        const valorProyecto = fila.cells[7].innerText.toUpperCase();
        const valorVencimiento = fila.cells[5].innerText; // Columna Vencimiento

        const coincideBusqueda = textoFila.includes(term);
        const coincideProyecto = proyecto === "" || valorProyecto === proyecto;
        const coincideSolped = solped === "" || fila.querySelector('[data-campo="estadoSolped"]').innerText.trim() === solped;
        const coincidePago = pago === "" || fila.querySelector('[data-campo="estadoPago"]').innerText.trim() === pago;
        
        // Lógica de rango de fechas
        let coincideFecha = true;
        if (fechaDesde || fechaHasta) {
            if (valorVencimiento === '---') {
                coincideFecha = false;
            } else {
                const dateVenc = new Date(valorVencimiento + "T00:00:00");
                if (fechaDesde && dateVenc < new Date(fechaDesde + "T00:00:00")) coincideFecha = false;
                if (fechaHasta && dateVenc > new Date(fechaHasta + "T00:00:00")) coincideFecha = false;
            }
        }

        fila.style.display = (coincideBusqueda && coincideProyecto && coincideSolped && coincidePago && coincideFecha) ? '' : 'none';
    });
}

// --- BOTÓN LIMPIAR ---
document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
    document.getElementById('busqueda').value = "";
    document.getElementById('filtroProyecto').value = "";
    document.getElementById('filtroSolped').value = "";
    document.getElementById('filtroPago').value = "";
    document.getElementById('fechaDesde').value = "";
    document.getElementById('fechaHasta').value = "";
    aplicarFiltros();
});

document.getElementById('busqueda').addEventListener('input', aplicarFiltros);
document.getElementById('filtroProyecto').addEventListener('change', aplicarFiltros);
document.getElementById('filtroSolped').addEventListener('change', aplicarFiltros);
document.getElementById('filtroPago').addEventListener('change', aplicarFiltros);
document.getElementById('fechaDesde').addEventListener('change', aplicarFiltros);
document.getElementById('fechaHasta').addEventListener('change', aplicarFiltros);

document.getElementById('btnExportarExcel').onclick = function() {
    const filas = tablaHistorial.querySelectorAll('tr');
    const datosExcel = [];
    filas.forEach(f => {
        if (f.style.display !== 'none') {
            const tds = f.querySelectorAll('td');
            const ins = f.querySelectorAll('input');
            const btns = f.querySelectorAll('button');
            datosExcel.push({
                "N° ORDEN": tds[0].innerText,
                "PAGO": tds[1].innerText,
                "FACTURA": ins[0].value,
                "FECHA": tds[3].innerText,
                "COTIZACION": tds[4].innerText,
                "VENCIMIENTO": tds[5].innerText,
                "PROVEEDOR": tds[6].innerText,
                "PROYECTO": tds[7].innerText,
                "COD. SOLPED": ins[1].value,
                "ESTADO SOLPED": btns[0].innerText,
                "ESTADO PAGO": btns[1].innerText,
                "TOTAL": tds[11].innerText
            });
        }
    });
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, "Historial_QATA.xlsx");
};

iniciarEscuchaHistorial();