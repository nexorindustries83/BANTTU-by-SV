import { db, doc, setDoc } from './firebase-config.js';

const CONFIG = {
    IMGBB_API_KEY: "25bdea01eba12eef750cde4a5d8d13a8",
    WHATSAPP: '573157243588',
    STORAGE: { CART: 'banttu_cart' }
};

let cart = [];
const cartSidebar = document.getElementById('cartSidebar');
const overlay = document.getElementById('overlay');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartCountEl = document.getElementById('cartCount');
const checkoutModal = document.getElementById('checkoutModal');

// Utilidades
const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- LÓGICA DEL CARRITO ---

window.openCart = function() {
    cartSidebar.classList.add('active');
    overlay.classList.add('active');
}

window.closeCart = function() {
    cartSidebar.classList.remove('active');
    overlay.classList.remove('active');
}

window.addToCart = function(productId, sizeSelectId, explicitColor = null) {
    // Accedemos a los productos globales definidos en main.js
    const products = window.products || [];
    const product = products.find(p => p.id == productId); // Usa == para coincidir string/number
    if (!product) return;

    const sizeSelect = document.getElementById(sizeSelectId);
    const size = sizeSelect.value;
    
    if (!size) {
        window.showToast("⚠️ Por favor, selecciona una talla.");
        return;
    }
    
    let color;
    if (explicitColor) {
        color = explicitColor;
    } else {
        const colorEl = document.querySelector(`#color-wrap-${productId} .selected`);
        color = colorEl ? colorEl.dataset.color : Object.keys(product.stock)[0];
    }
    
    // Validación de seguridad por si el color no existe en el stock
    if (!product.stock[color]) {
        console.error(`Color no encontrado: ${color}`, product);
        return window.showToast("Error: Color no disponible.");
    }

    const availableStock = (product.stock[color] && product.stock[color][size]) || 0;
    const inCartCount = cart.filter(item => item.productId === product.id && item.size === size && item.color === color).length;

    if (inCartCount >= availableStock) {
        window.showToast("No hay más stock para esta talla.");
        return;
    }
    
    cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        size: size,
        color: color
    });

    saveCart();
    renderCart();
    window.showToast("Producto añadido al carrito");
    window.openCart();
}

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    saveCart();
    renderCart();
}

function renderCart() {
    cartCountEl.innerText = cart.length;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-center" style="margin-top: 50px; color: #999;">Tu carrito está vacío.</p>';
        cartTotalEl.innerText = '$0.00';
        return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = '';

    cart.forEach((item, index) => {
        total += item.price;
        const itemEl = document.createElement('div');
        itemEl.classList.add('cart-item');
        itemEl.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-details">
                <h4 style="font-size: 0.9rem; margin-bottom: 5px;">${item.name} <br><span style="font-weight:normal; font-size:0.8em; color:#666;">${item.color} | Talla: ${item.size}</span></h4>
                <p style="color: var(--color-accent); font-weight: 500;">${formatCurrency(item.price)}</p>
                <span class="cart-item-remove" onclick="removeFromCart(${index})" role="button" tabindex="0">Eliminar</span>
            </div>
        `;
        cartItemsContainer.appendChild(itemEl);
    });

    cartTotalEl.innerText = formatCurrency(total);
}

function saveCart() {
    localStorage.setItem(CONFIG.STORAGE.CART, JSON.stringify(cart));
}

// --- CHECKOUT & PAGOS ---

window.openCheckout = function() {
    if(cart.length === 0) return alert("El carrito está vacío");
    window.closeCart();
    checkoutModal.classList.add('active');
    overlay.classList.add('active');
}

window.closeModal = function() {
    checkoutModal.classList.remove('active');
    overlay.classList.remove('active');
}

window.togglePaymentMethod = function(method) {
    document.querySelectorAll('.payment-details').forEach(el => el.classList.remove('active'));
    document.getElementById('details-' + method).classList.add('active');
    document.querySelectorAll('.payment-details input').forEach(input => input.required = false);
    document.querySelectorAll(`#details-${method} input`).forEach(input => input.required = true);
}

window.processPayment = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('payBtn');
    const originalText = btn.innerText;
    
    const name = document.getElementById('customerName').value;
    const address = document.getElementById('customerAddress').value;
    
    let paymentMethod = '';
    let paymentDetails = '';
    
    btn.innerHTML = '<div class="loader"></div> Procesando...';
    btn.disabled = true;

    if(document.getElementById('pm-nequi').checked) {
        paymentMethod = 'Transferencia Nequi';
        const nequiCode = document.getElementById('nequiPhoneNumber').value;
        const receiptFile = document.getElementById('nequiReceipt').files[0];
        paymentDetails = `Comprobante: ${nequiCode || '3157243588'}`;
        
        if(receiptFile && window.compressImage) {
            try {
                btn.innerHTML = '<div class="loader"></div> Subiendo comprobante...';
                const compressedReceipt = await window.compressImage(receiptFile, 800, 0.6);
                
                // Subir a ImgBB
                const base64Data = compressedReceipt.split(',')[1];
                const formData = new FormData();
                formData.append('image', base64Data);

                const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_API_KEY}`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if(data.success) {
                    paymentDetails += ` %0A📎 *VER COMPROBANTE:* ${data.data.url}`;
                }
            } catch(err) { console.error("Error subiendo recibo", err); }
        }
    } else {
        paymentMethod = 'Contra Entrega';
        paymentDetails = 'Cobrar en efectivo al entregar';
    }
    
    await delay(500);

    // Descontar Stock
    const products = window.products;
    let stockAlerts = [];
    const productsToUpdate = new Set(); // Usamos un Set para no guardar duplicados

    cart.forEach(cartItem => {
        // Usamos == para asegurar coincidencia de tipos
        const productIndex = products.findIndex(p => p.id == cartItem.productId);
        
        if (productIndex !== -1) {
            const p = products[productIndex];
            if (p.stock[cartItem.color] && p.stock[cartItem.color][cartItem.size] > 0) {
                p.stock[cartItem.color][cartItem.size]--;
                
                // Marcar producto para actualizar en DB
                productsToUpdate.add(p);

                // Detectar si el stock llegó a cero tras la venta
                if (p.stock[cartItem.color][cartItem.size] === 0) {
                    stockAlerts.push(`⚠️ AGOTADO: ${p.name} (${cartItem.color} T${cartItem.size})`);
                }
            }
        }
    });

    if (db) {
        // Actualizar en Firebase SOLO los productos modificados
        productsToUpdate.forEach(p => setDoc(doc(db, 'products', String(p.id)), p));
    } else {
        localStorage.setItem('banttu_products', JSON.stringify(products));
    }
    if(window.renderShop) window.renderShop();

    // Mensaje WhatsApp
    let message = `*HOLA BANTTÚ, NUEVO PEDIDO WEB* 🛍️%0A%0A`;
    message += `👤 *Cliente:* ${encodeURIComponent(name)}%0A`;
    message += `📍 *Dirección:* ${encodeURIComponent(address)}%0A`;
    message += `💳 *Método:* ${paymentMethod}%0A`;
    message += `📝 *Detalle Pago:* ${encodeURIComponent(paymentDetails)}%0A%0A`;
    message += `*RESUMEN DE COMPRA:*%0A`;
    
    let total = 0;
    cart.forEach(item => {
        message += `▪️ [Ref: ${item.productId}] ${item.name} (${item.color}, T${item.size}) - ${formatCurrency(item.price)}%0A`;
        total += item.price;
    });
    
    message += `%0A💰 *TOTAL A PAGAR: ${formatCurrency(total)}*`;

    // Agregar alertas de stock al mensaje de WhatsApp si existen
    if (stockAlerts.length > 0) {
        message += `%0A%0A🚨 *ALERTA DE INVENTARIO:*%0A${stockAlerts.join('%0A')}`;
    }

    window.location.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${message}`;
    
    cart = [];
    saveCart();
    renderCart();
    window.closeModal();
    btn.innerText = originalText;
    btn.disabled = false;
    document.getElementById('paymentForm').reset();
}

window.checkoutWhatsApp = function() {
    if(cart.length === 0) return;
    // ... lógica simplificada de WhatsApp ...
    window.openCheckout(); // Reutilizamos el modal para pedir datos primero
}

// --- HERRAMIENTA DE PRUEBA ---
window.testCartSystem = function() {
    console.group("🛒 Diagnóstico del Carrito");
    console.log("Productos cargados:", window.products ? window.products.length : 0);
    console.log("Items en carrito:", cart.length);
    console.log("Elementos DOM:", {
        sidebar: !!document.getElementById('cartSidebar'),
        modal: !!document.getElementById('checkoutModal'),
        itemsContainer: !!document.getElementById('cartItems')
    });
    console.log("Configuración:", CONFIG);
    console.groupEnd();
    return "Prueba finalizada. Revisa la consola.";
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    const savedCart = localStorage.getItem(CONFIG.STORAGE.CART);
    if (savedCart) {
        cart = JSON.parse(savedCart);
        renderCart();
    }
});