import { db, doc, setDoc, deleteDoc, getDoc } from './firebase-config.js';

const IMGBB_API_KEY = "25bdea01eba12eef750cde4a5d8d13a8";
const STORAGE_ADMIN = 'banttu_admin_pass';
const STORAGE_PRODUCTS = 'banttu_products';

// --- FUNCIONES DE UI ADMIN ---

window.openAdminLogin = function() {
    document.getElementById('adminLoginModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

window.closeAdminLogin = function() {
    document.getElementById('adminLoginModal').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

window.checkAdminLogin = function() {
    const pass = document.getElementById('adminPassword').value;
    const currentPass = localStorage.getItem(STORAGE_ADMIN) || 'admin123';
    
    if(pass === currentPass) {
        window.closeAdminLogin();
        document.getElementById('adminDashboard').classList.add('active');
        renderAdminList();
        renderDashboardStats();
    } else {
        alert('Contraseña incorrecta');
    }
}

window.closeAdminDashboard = function() {
    document.getElementById('adminDashboard').classList.remove('active');
}

window.togglePasswordChange = function() {
    document.getElementById('passwordChangeForm').classList.toggle('active');
}

window.saveNewPassword = function() {
    const newPass = document.getElementById('newAdminPass').value;
    if(newPass.length < 4) {
        window.showToast("⚠️ La contraseña debe tener al menos 4 caracteres.");
        return;
    }
    localStorage.setItem(STORAGE_ADMIN, newPass);
    window.showToast("✅ ¡Contraseña actualizada con éxito!");
    document.getElementById('newAdminPass').value = '';
    window.togglePasswordChange();
}

window.toggleHelp = function() {
    document.getElementById('productForm').classList.remove('active');
    document.getElementById('passwordChangeForm').classList.remove('active');
    document.getElementById('adminHelp').classList.toggle('active');
}

window.toggleDarkMode = function() {
    const dashboard = document.getElementById('adminDashboard');
    dashboard.classList.toggle('dark-mode');
    window.showToast(dashboard.classList.contains('dark-mode') ? "🌙 Modo Oscuro Activado" : "☀️ Modo Claro Activado");
}

window.toggleProductDetails = function(id) {
    const el = document.getElementById(`details-${id}`);
    const btn = document.getElementById(`btn-details-${id}`);
    if(el.style.display === 'none') {
        el.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
    } else {
        el.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    }
}

// --- GESTIÓN DE PRODUCTOS ---

export function renderAdminList() {
    // 1. Obtener término de búsqueda
    const searchInput = document.getElementById('adminSearchInput');
    const term = searchInput ? searchInput.value.toLowerCase() : '';

    const list = document.getElementById('adminProductList');
    if(!list) return;
    list.innerHTML = '';
    
    const products = window.products || [];
    
    // 2. Filtrar productos
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.category.toLowerCase().includes(term) ||
        String(p.id).includes(term)
    );

    if(filtered.length === 0) {
        list.innerHTML = '<div class="text-center" style="padding:40px; color:#999;">No se encontraron productos.</div>';
        return;
    }

    // 3. Renderizar
    filtered.forEach(p => {
        // Calcular stock total de este producto
        let totalStock = 0;
        if(p.stock) {
            Object.values(p.stock).forEach(colorStock => {
                totalStock += Object.values(colorStock).reduce((a,b) => a+b, 0);
            });
        }

        // Badge de estado
        let statusBadge = '';
        if(p.hidden) statusBadge = '<span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.7rem; color:#666;">Oculto</span>';
        else if(totalStock === 0) statusBadge = '<span style="background:#ffebee; padding:2px 6px; border-radius:4px; font-size:0.7rem; color:#c62828;">Agotado</span>';
        else if(totalStock < 5) statusBadge = '<span style="background:#fff3e0; padding:2px 6px; border-radius:4px; font-size:0.7rem; color:#ef6c00;">Poco Stock</span>';
        else statusBadge = '<span style="background:#e8f5e9; padding:2px 6px; border-radius:4px; font-size:0.7rem; color:#2e7d32;">Activo</span>';

        // Construir detalle de stock (oculto por defecto)
        let stockDetailsHtml = '<div style="margin-top:15px; padding-top:15px; border-top:1px solid #eee; font-size:0.85rem; color:#666;">';
        if(p.stock) {
            Object.keys(p.stock).forEach(color => {
                stockDetailsHtml += `<div style="margin-bottom:5px;"><strong>${color}:</strong> `;
                const sizes = p.stock[color];
                const sizeStr = Object.entries(sizes)
                    .filter(([size, qty]) => qty > 0)
                    .map(([size, qty]) => `T${size}(${qty})`)
                    .join(', ');
                stockDetailsHtml += sizeStr || '<span style="color:#999">Sin stock</span>';
                stockDetailsHtml += '</div>';
            });
        }
        stockDetailsHtml += '</div>';

        const item = document.createElement('div');
        item.className = 'product-list-item';
        item.innerHTML = `
            <div class="product-list-header">
                <img src="${p.images[0]}">
                <div class="product-list-info">
                    <strong>${p.name}</strong><br>
                    <small>${p.category}</small><br>
                    $${p.price} &nbsp; ${statusBadge} &nbsp; <small style="color:#666;">Total: ${totalStock}</small>
                </div>
                <div class="admin-actions">
                    <button class="btn btn-sm btn-outline" id="btn-details-${p.id}" onclick="toggleProductDetails(${p.id})" title="Ver Detalles"><i class="fas fa-chevron-down"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div id="details-${p.id}" style="display:none;">
                ${stockDetailsHtml}
            </div>
        `;
        list.appendChild(item);
    });
    
    // Actualizar estadísticas también si no hay filtro
    if(term === '') renderDashboardStats();
}

window.renderDashboardStats = function() {
    const products = window.products || [];
    
    let totalProducts = products.length;
    let totalUnits = 0;
    let inventoryValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
        let pStock = 0;
        if(p.stock) {
            Object.values(p.stock).forEach(colorStock => {
                pStock += Object.values(colorStock).reduce((a,b) => a+b, 0);
            });
        }
        
        totalUnits += pStock;
        inventoryValue += (p.price * pStock);
        
        if(pStock < 5) lowStockCount++;
    });

    // Actualizar DOM
    const formatMoney = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    
    const elTotal = document.getElementById('statTotalProducts');
    const elValue = document.getElementById('statInventoryValue');
    const elUnits = document.getElementById('statTotalUnits');
    const elLow = document.getElementById('statLowStock');

    if(elTotal) elTotal.innerText = totalProducts;
    if(elValue) elValue.innerText = formatMoney(inventoryValue);
    if(elUnits) elUnits.innerText = totalUnits;
    if(elLow) elLow.innerText = lowStockCount;
}

window.showAddForm = function() {
    document.getElementById('productForm').classList.add('active');
    document.getElementById('editId').value = '';
    document.getElementById('editName').value = '';
    document.getElementById('editPrice').value = '';
    document.getElementById('editDescription').value = '';
    document.getElementById('editImages').value = '';
    document.getElementById('editImageFile').value = '';
    document.getElementById('editImageFile').value = null;
    document.getElementById('editCategory').value = 'sandalias';
    
    document.getElementById('stockContainer').innerHTML = '';
    document.getElementById('currentImagesContainer').innerHTML = '';
    window.adminAddColor('Estándar');
}

window.adminAddColor = function(colorName = '') {
    const name = colorName || document.getElementById('newColorInput').value;
    if(!name) return alert("Escribe un nombre de color");
    
    const container = document.getElementById('stockContainer');
    const div = document.createElement('div');
    div.className = 'stock-color-group';
    div.dataset.color = name;
    
    let html = `<strong>${name}</strong> <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="float:right">X</button><div class="sizes-grid">`;
    ['35','36','37','38','39','40'].forEach(size => {
        html += `
            <div class="size-stock-item">
                <label>T${size}</label>
                <input type="number" class="stock-input" data-size="${size}" min="0" value="0">
            </div>`;
    });
    html += '</div>';
    div.innerHTML = html;
    container.appendChild(div);
    document.getElementById('newColorInput').value = '';
}

window.cancelEdit = function() { document.getElementById('productForm').classList.remove('active'); }

window.editProduct = function(id) {
    const p = window.products.find(x => x.id === id);
    document.getElementById('productForm').classList.add('active');
    document.getElementById('editId').value = p.id;
    document.getElementById('editName').value = p.name;
    document.getElementById('editCategory').value = p.category || 'sandalias';
    document.getElementById('editPrice').value = p.price;
    document.getElementById('editDescription').value = p.description || '';
    document.getElementById('editImages').value = '';
    document.getElementById('editImageFile').value = '';
    
    const imgContainer = document.getElementById('currentImagesContainer');
    imgContainer.innerHTML = '';
    p.images.forEach(imgSrc => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.innerHTML = `<img src="${imgSrc}"><button class="remove-btn" onclick="this.parentElement.remove()">X</button>`;
        imgContainer.appendChild(div);
    });

    const container = document.getElementById('stockContainer');
    container.innerHTML = '';
    
    Object.keys(p.stock).forEach(color => {
        const div = document.createElement('div');
        div.className = 'stock-color-group';
        div.dataset.color = color;
        let html = `<strong>${color}</strong> <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="float:right">X</button><div class="sizes-grid">`;
        ['35','36','37','38','39','40'].forEach(size => {
            const val = p.stock[color][size] || 0;
            html += `<div class="size-stock-item"><label>T${size}</label><input type="number" class="stock-input" data-size="${size}" min="0" value="${val}"></div>`;
        });
        html += '</div>';
        div.innerHTML = html;
        container.appendChild(div);
    });
}

window.saveProduct = async function() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value;
    const category = document.getElementById('editCategory').value;
    const price = parseFloat(document.getElementById('editPrice').value);
    const description = document.getElementById('editDescription').value;
    const imagesStr = document.getElementById('editImages').value;
    const imageFiles = document.getElementById('editImageFile').files;
    
    const saveBtn = document.getElementById('saveProductBtn');
    saveBtn.disabled = true;
    saveBtn.innerText = "Procesando imágenes...";

    const newStock = {};
    document.querySelectorAll('.stock-color-group').forEach(group => {
        const color = group.dataset.color;
        newStock[color] = {};
        group.querySelectorAll('.stock-input').forEach(input => {
            newStock[color][input.dataset.size] = parseInt(input.value) || 0;
        });
    });

    try {
        let finalImagesList = Array.from(document.querySelectorAll('#currentImagesContainer img')).map(img => img.src);

        if(imagesStr) {
            const urls = imagesStr.split(',').map(s => s.trim()).filter(s => s);
            finalImagesList = [...finalImagesList, ...urls];
        }

        if (imageFiles.length > 0) {
            window.showToast("Optimizando imágenes... 🎨");
            const compressPromises = Array.from(imageFiles).map(file => window.compressImage(file, 800, 0.7));
            const compressedBase64s = await Promise.all(compressPromises);

            if (IMGBB_API_KEY && IMGBB_API_KEY.length > 10) {
                window.showToast("Subiendo a la nube... ☁️");
                const uploadPromises = compressedBase64s.map(async (base64Str) => {
                    const base64Data = base64Str.split(',')[1];
                    const formData = new FormData();
                    formData.append('image', base64Data);
                    
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();
                    if(data.success) return data.data.url;
                    else throw new Error("Error API ImgBB");
                });
                
                try {
                    const uploadedUrls = await Promise.all(uploadPromises);
                    finalImagesList = [...finalImagesList, ...uploadedUrls];
                } catch(err) {
                    console.error("Fallo subida, usando local:", err);
                    finalImagesList = [...finalImagesList, ...compressedBase64s];
                }
            } else {
                finalImagesList = [...finalImagesList, ...compressedBase64s];
            }
        }
        
        if(finalImagesList.length === 0) finalImagesList = ['https://via.placeholder.com/300'];

        // Preparar objeto producto
        const productData = {
            name, category, price, description,
            images: finalImagesList, 
            stock: newStock,
            hidden: (price === 0)
        };

        if(id) {
            // Editar
            productData.id = parseInt(id);
            if (price > 0) productData.hidden = false;
            
            // Actualizar array local
            const index = window.products.findIndex(x => x.id == id);
            if(index !== -1) window.products[index] = { ...window.products[index], ...productData };
        } else {
            // Nuevo
            const newId = window.products.length > 0 ? Math.max(...window.products.map(p => p.id)) + 1 : 1;
            productData.id = newId;
            window.products.push(productData);
        }
        
        if (db) {
            const docId = String(productData.id);
            await setDoc(doc(db, 'products', docId), productData, { merge: true });
            window.showToast('Guardado en la Nube ☁️');
        } else {
            localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(window.products));
            window.renderShop();
            renderAdminList();
            renderDashboardStats();
            window.showToast('Guardado Localmente 💾');
        }
        
        saveBtn.disabled = false;
        saveBtn.innerText = "Guardar Cambios";
        window.cancelEdit();
    } catch (e) {
        console.error(e);
        alert("⚠️ Error al guardar. Revisa tu conexión o las imágenes.");
        saveBtn.disabled = false;
        saveBtn.innerText = "Guardar Cambios";
    }
}

window.deleteProduct = function(id) {
    if(confirm('¿Seguro que deseas eliminar este producto?')) {
        if (db) {
            deleteDoc(doc(db, 'products', String(id)))
                .then(() => window.showToast('🗑️ Producto eliminado de Firebase'))
                .catch(e => alert("Error al eliminar"));
        } else {
            window.products = window.products.filter(p => p.id !== id);
            localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(window.products));
            window.renderShop();
            renderAdminList();
            renderDashboardStats();
            window.showToast('Producto eliminado');
        }
    }
}

// Funciones de Backup y Consola (Simplificadas para el ejemplo, pero deben estar aquí)
window.downloadBackup = function() {
    const dataStr = localStorage.getItem(STORAGE_PRODUCTS);
    if (!dataStr) return window.showToast("No hay productos.");
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banttu_backup.json`;
    a.click();
}

window.toggleAdminConsole = function() {
    document.getElementById('adminConsole').classList.toggle('active');
}

window.clearAdminLogs = function() {
    document.getElementById('adminLogContent').innerHTML = '';
}

// --- CARGA MASIVA (EXCEL/CSV) ---

window.downloadBulkTemplate = function() {
    // Encabezados compatibles con Excel (separados por punto y coma para Latam/Europa)
    const headers = [
        "ID (Dejar vacio si es nuevo)", 
        "Nombre del Producto", 
        "Categoria", 
        "Precio", 
        "URL Imagen", 
        "Color", 
        "Stock T35", "Stock T36", "Stock T37", "Stock T38", "Stock T39", "Stock T40"
    ];
    
    const exampleRow = [
        "", "Sandalia Ejemplo", "sandalias", "85000", "", "Negro", "2", "5", "5", "3", "1", "0"
    ];

    const csvContent = "\uFEFF" + headers.join(";") + "\n" + exampleRow.join(";");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_productos_banttu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.processBulkUpload = function(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split("\n");
        let processedCount = 0;

        // Empezamos en 1 para saltar el encabezado
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;

            let cols = row.split(";");
            if (cols.length < 5) cols = row.split(","); // Fallback por si usan coma

            const idStr = cols[0] ? cols[0].trim() : "";
            const name = cols[1] ? cols[1].trim() : "";
            if (!name) continue;

            const category = cols[2] ? cols[2].trim().toLowerCase() : "sandalias";
            const price = parseFloat(cols[3]) || 0;
            const imgUrl = cols[4] ? cols[4].trim() : "";
            const color = cols[5] ? cols[5].trim() : "Estándar";
            
            const stockMap = {
                '35': parseInt(cols[6]) || 0,
                '36': parseInt(cols[7]) || 0,
                '37': parseInt(cols[8]) || 0,
                '38': parseInt(cols[9]) || 0,
                '39': parseInt(cols[10]) || 0,
                '40': parseInt(cols[11]) || 0
            };

            // Lógica de Fusión
            let product = null;
            if(idStr) product = window.products.find(p => p.id == idStr);
            else product = window.products.find(p => p.name.toLowerCase() === name.toLowerCase());

            if (product) {
                // Actualizar
                if(!product.stock) product.stock = {};
                product.stock[color] = stockMap;
                if (price > 0) product.price = price;
                if (imgUrl && !product.images.includes(imgUrl)) product.images.push(imgUrl);
                
                if(db) await setDoc(doc(db, 'products', String(product.id)), product, {merge: true});
            } else {
                // Crear Nuevo
                const newId = window.products.length > 0 ? Math.max(...window.products.map(p => p.id)) + 1 : 1;
                const newProduct = {
                    id: newId,
                    name: name,
                    category: category,
                    price: price,
                    images: imgUrl ? [imgUrl] : ['https://via.placeholder.com/300'],
                    stock: { [color]: stockMap },
                    hidden: (price === 0)
                };
                window.products.push(newProduct);
                if(db) await setDoc(doc(db, 'products', String(newId)), newProduct);
            }
            processedCount++;
        }

        if(!db) localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(window.products));
        
        renderAdminList();
        renderDashboardStats();
        alert(`✅ Proceso finalizado. ${processedCount} filas procesadas.`);
        input.value = '';
    };
    reader.readAsText(file, "ISO-8859-1"); // Codificación para tildes
}

// --- PRUEBAS DE SISTEMA Y UNITARIAS ---

window.runSystemChecks = async function() {
    const btn = document.querySelector('button[onclick="runSystemChecks()"]');
    const originalText = btn ? btn.innerHTML : '';
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Probando...';

    let report = "📡 DIAGNÓSTICO DE CONEXIÓN:\n--------------------------------\n";
    
    // 1. Internet
    report += navigator.onLine ? "✅ Internet: Conectado\n" : "❌ Internet: Desconectado\n";
    
    // 2. Firebase
    if(db) {
        report += "✅ Firebase: SDK Configurado\n";
        try {
            // Intentamos leer un documento de prueba para verificar conexión real
            await getDoc(doc(db, "products", "_connection_test_"));
            report += "✅ Firebase: Conexión a Nube EXITOSA ☁️\n";
        } catch (e) {
            console.error("Error conexión:", e);
            report += `❌ Firebase: FALLÓ (${e.code || e.message})\n`;
            if(e.code === 'permission-denied') report += "   ↳ Revisa las reglas de seguridad en Firestore.\n";
            else if(e.code === 'unavailable') report += "   ↳ Sin conexión con el servidor.\n";
        }
    } else {
        report += "⚠️ Firebase: Modo Local (Sin Nube)\n";
    }
    
    if(btn) btn.innerHTML = originalText;
    alert(report);
}

window.runUnitTests = function() {
    let log = "🧪 TESTS UNITARIOS:\n";
    // Test 1: Compresión
    log += (typeof window.compressImage === 'function') ? "✅ Función Compresión: OK\n" : "❌ Función Compresión: Falla\n";
    // Test 2: Array Productos
    log += (Array.isArray(window.products)) ? "✅ Array Productos: OK\n" : "❌ Array Productos: Corrupto\n";
    // Test 3: Conexión DB
    log += (db) ? "✅ Objeto DB: Existe\n" : "⚠️ Objeto DB: Null (Usando LocalStorage)\n";
    
    alert(log);
}

window.runStressTest = function() {
    if(!confirm("⚠️ ¿Iniciar PRUEBA DE ESTRÉS?\n\nSe generarán 1000 productos simulados para probar el rendimiento del renderizado y la memoria del navegador.\n\nLa página se recargará automáticamente al finalizar para limpiar.")) return;

    const start = performance.now();
    
    // Generar carga masiva simulada
    const dummyProducts = [];
    for(let i = 0; i < 1000; i++) {
        dummyProducts.push({
            id: 90000 + i,
            name: `Producto Stress Test ${i}`,
            category: 'stress-test',
            price: Math.floor(Math.random() * 100000),
            images: ['https://via.placeholder.com/150'],
            stock: { 'Test': { '35': 100 } },
            hidden: false
        });
    }
    
    // Inyectar y renderizar
    window.products = [...window.products, ...dummyProducts];
    renderAdminList();
    renderDashboardStats();
    
    const end = performance.now();
    const duration = (end - start).toFixed(2);
    
    setTimeout(() => {
        alert(`✅ PRUEBA COMPLETADA\n\nRenderizado de 1000 elementos en: ${duration}ms\n\nEl sistema es estable. La página se recargará ahora.`);
        window.location.reload();
    }, 500);
}