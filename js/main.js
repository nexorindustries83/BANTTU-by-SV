import { db, collection, onSnapshot } from './firebase-config.js';
import { renderAdminList } from './admin.js';

// --- ESTADO GLOBAL ---
window.products = [];
window.cardImageIndices = {}; // Para rastrear la foto actual de cada tarjeta
const STORAGE_PRODUCTS = 'banttu_products';

const defaultProducts = [
    { id: 1, name: 'Sandalia Terracota', category: 'sandalias', price: 89.00, description: 'Sandalia elegante color terracota, ideal para eventos casuales.', images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800&auto=format&fit=crop'], stock: { 'Terracota': {'35':0, '36':5, '37':8, '38':2, '39':0, '40':0} } },
    { id: 2, name: 'Stiletto Noir', category: 'stilettos', price: 120.00, description: 'Stiletto clásico negro, imprescindible en tu armario.', images: ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=800&auto=format&fit=crop'], stock: { 'Negro': {'35':10, '36':10, '37':10, '38':10, '39':10, '40':10} } },
    { id: 3, name: 'Tenis Chunky', category: 'tenis', price: 95.00, description: 'Tenis modernos y cómodos con suela alta.', images: ['https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?q=80&w=800&auto=format&fit=crop'], stock: { 'Blanco': {'35':2, '36':5, '37':4, '38':5, '39':3, '40':0}, 'Negro': {'35':1, '36':2, '37':0, '38':1, '39':0, '40':0} } }
];

// --- INICIALIZACIÓN ---

function initStore() {
    if (db) {
        // Escuchar cambios en tiempo real desde Firebase
        onSnapshot(collection(db, 'products'), (snapshot) => {
            window.products = [];
            snapshot.forEach((doc) => {
                window.products.push({ id: parseInt(doc.id) || doc.id, ...doc.data() });
            });
            window.renderShop();
            // Si el panel admin está abierto, actualizar lista
            if(document.getElementById('adminDashboard').classList.contains('active')) {
                renderAdminList();
            }
        });
        return;
    }

    // Modo Local
    const stored = localStorage.getItem(STORAGE_PRODUCTS);
    if (stored) {
        try {
            window.products = JSON.parse(stored);
        } catch(e) { console.error("Error datos locales", e); }
    }
    
    if (!window.products.length) {
        window.products = defaultProducts;
        localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(window.products));
    }
    window.renderShop();
}

// --- RENDERIZADO DE TIENDA ---

window.renderShop = function(filter = 'all') {
    const grid = document.querySelector('.products-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const filtered = window.products.filter(p => {
        if (p.hidden) return false;
        return filter === 'all' || p.category === filter;
    });

    filtered.forEach(p => {
        let totalStock = 0;
        const colors = Object.keys(p.stock);
        colors.forEach(c => {
            totalStock += Object.values(p.stock[c]).reduce((a,b)=>a+b, 0);
        });

        // Inicializar índice de imagen para este producto
        window.cardImageIndices[p.id] = 0;

        // Generar flechas solo si hay más de 1 imagen
        const arrowsHtml = p.images.length > 1 ? `
            <button class="card-arrow prev" onclick="slideCardImage(${p.id}, -1, event)">❮</button>
            <button class="card-arrow next" onclick="slideCardImage(${p.id}, 1, event)">❯</button>
        ` : '';

        const card = document.createElement('div');
        card.className = 'product-card reveal active';
        if (totalStock === 0) card.classList.add('out-of-stock');

        let colorHtml = '';
        if (colors.length > 0) {
            colorHtml = `<div class="color-select-wrap" id="color-wrap-${p.id}">`;
            colors.forEach((c, idx) => {
                colorHtml += `<span class="color-option ${idx===0?'selected':''}" onclick="selectColor('${p.id}', '${c}', this)" data-color="${c}">${c}</span>`;
            });
            colorHtml += `</div>`;
        }

        const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

        card.innerHTML = `
            <div class="product-image">
                ${totalStock === 0 ? '<div class="sold-out-badge">Agotado</div>' : ''}
                ${arrowsHtml}
                <img src="${p.images[0]}" id="img-${p.id}" alt="${p.name}" onclick="openProductDetail(${p.id})">
            </div>
            <div class="product-info">
                <h3 class="product-name">${p.name}</h3>
                <p class="product-price">${formatCurrency(p.price)}</p>
                ${colorHtml}
                <select class="size-select" id="size-${p.id}" ${totalStock === 0 ? 'disabled' : ''}></select>
                <button class="add-to-cart-btn" onclick="addToCart('${p.id}', 'size-${p.id}')" ${totalStock === 0 ? 'disabled' : ''}>
                    ${totalStock === 0 ? 'Agotado' : 'Añadir al Carrito'}
                </button>
            </div>
        `;
        grid.appendChild(card);
        if(colors.length > 0) window.updateSizes(p.id, colors[0]);
    });
}

window.filterProducts = function(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    window.renderShop(category);
}

// Función para deslizar fotos en la tarjeta (Grid)
window.slideCardImage = function(pid, dir, event) {
    event.stopPropagation(); // Evita que se abra el modal al hacer clic en la flecha
    
    const product = window.products.find(p => p.id == pid);
    if(!product) return;

    let idx = window.cardImageIndices[pid] || 0;
    idx += dir;

    // Loop infinito (volver al inicio o ir al final)
    if(idx < 0) idx = product.images.length - 1;
    if(idx >= product.images.length) idx = 0;

    window.cardImageIndices[pid] = idx;
    
    // Actualizar imagen
    const imgEl = document.getElementById(`img-${pid}`);
    if(imgEl) imgEl.src = product.images[idx];
}

window.updateSizes = function(pid, color) {
    const product = window.products.find(p => p.id == pid);
    const select = document.getElementById(`size-${pid}`);
    const stockData = product.stock[color];
    
    let html = '<option value="">Talla</option>';
    for (const [size, qty] of Object.entries(stockData)) {
        if (qty > 0) html += `<option value="${size}">${size}</option>`;
        else html += `<option value="${size}" disabled>${size} (Agotado)</option>`;
    }
    select.innerHTML = html;
}

window.selectColor = function(pid, color, btn) {
    const wrap = document.getElementById(`color-wrap-${pid}`);
    wrap.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    window.updateSizes(pid, color);
}

// --- DETALLE DE PRODUCTO ---

// Variables de estado para el modal
let currentDetailProductId = null;
let currentDetailImageIndex = 0;
let currentDetailColor = '';

window.openProductDetail = function(pid) {
    const product = window.products.find(p => p.id == pid);
    if(!product) return;
    
    currentDetailProductId = pid;
    currentDetailImageIndex = 0;
    
    // 1. Información Básica
    document.getElementById('detailName').innerText = product.name;
    document.getElementById('detailCategory').innerText = product.category || '';
    const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    document.getElementById('detailPrice').innerText = formatCurrency(product.price);

    // 2. Descripción
    const descContainer = document.getElementById('detailDescription');
    if (product.description) {
        descContainer.innerHTML = `<p>${product.description.replace(/\n/g, '<br>')}</p>`;
    } else {
        descContainer.innerHTML = `<p>Diseño exclusivo BANTTÚ by SV. Elaborado con materiales de alta calidad que garantizan durabilidad y confort en cada paso.</p>`;
    }
    
    // 3. Imágenes (Galería)
    window.renderDetailImages(product);

    // 4. Colores y Tallas
    const colors = Object.keys(product.stock);
    const colorsContainer = document.getElementById('detailColors');
    colorsContainer.innerHTML = '';
    
    if (colors.length > 0) {
        currentDetailColor = colors[0]; // Primer color por defecto
        colors.forEach(color => {
            const span = document.createElement('span');
            span.className = `color-option ${color === currentDetailColor ? 'selected' : ''}`;
            span.innerText = color;
            span.onclick = () => window.selectDetailColor(color);
            colorsContainer.appendChild(span);
        });
        window.updateDetailSizes(currentDetailColor);
    }

    // 5. Configurar botón añadir del modal
    document.getElementById('detailAddBtn').onclick = () => {
        if(window.addToCart) {
            // Pasamos el color explícitamente
            window.addToCart(product.id, 'detailSize', currentDetailColor);
            window.closeProductDetail();
        }
    };

    document.getElementById('productDetailModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
}

window.renderDetailImages = function(product) {
    const mainImg = document.getElementById('detailMainImg');
    const thumbsContainer = document.getElementById('detailThumbnails');
    
    mainImg.src = product.images[currentDetailImageIndex];
    
    thumbsContainer.innerHTML = '';
    product.images.forEach((img, idx) => {
        const thumb = document.createElement('img');
        thumb.src = img;
        thumb.className = `thumb-img ${idx === currentDetailImageIndex ? 'active' : ''}`;
        thumb.onclick = () => {
            currentDetailImageIndex = idx;
            window.renderDetailImages(product);
        };
        thumbsContainer.appendChild(thumb);
    });
}

window.navDetailImage = function(direction) {
    const product = window.products.find(p => p.id == currentDetailProductId);
    if(!product) return;
    
    currentDetailImageIndex += direction;
    if(currentDetailImageIndex < 0) currentDetailImageIndex = product.images.length - 1;
    if(currentDetailImageIndex >= product.images.length) currentDetailImageIndex = 0;
    
    window.renderDetailImages(product);
}

window.selectDetailColor = function(color) {
    currentDetailColor = color;
    const container = document.getElementById('detailColors');
    Array.from(container.children).forEach(child => {
        child.classList.toggle('selected', child.innerText === color);
    });
    window.updateDetailSizes(color);
}

window.updateDetailSizes = function(color) {
    const product = window.products.find(p => p.id == currentDetailProductId);
    const select = document.getElementById('detailSize');
    const stockData = product.stock[color];
    
    let html = '<option value="">Seleccionar Talla</option>';
    for (const [size, qty] of Object.entries(stockData)) {
        if (qty > 0) html += `<option value="${size}">${size}</option>`;
        else html += `<option value="${size}" disabled>${size} (Agotado)</option>`;
    }
    select.innerHTML = html;
}

window.closeProductDetail = function() {
    document.getElementById('productDetailModal').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
}

// --- UTILIDADES UI ---

window.showToast = function(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3000);
}

window.scrollToTop = function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- UTILIDAD GLOBAL: COMPRESIÓN DE IMÁGENES ---
window.compressImage = function(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Redimensionar manteniendo aspecto
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Event Listeners Globales
document.addEventListener('DOMContentLoaded', () => {
    initStore();

    // Mobile Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');
    if(mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = mobileToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Scroll Top
    const scrollTopBtn = document.querySelector('.scroll-top');
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) scrollTopBtn.classList.add('active');
        else scrollTopBtn.classList.remove('active');
    });

    // Animaciones
    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    revealElements.forEach(el => revealObserver.observe(el));
});