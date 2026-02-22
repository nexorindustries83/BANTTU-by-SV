# BANTTÚ by SV - Tienda Online 👠

Plataforma de comercio electrónico para calzado femenino, diseñada con un enfoque minimalista y moderno. Permite a los usuarios explorar el catálogo, gestionar un carrito de compras y finalizar pedidos directamente a través de WhatsApp.

## ✨ Características Principales

### 🛍️ Tienda (Cliente)
*   **Catálogo Dinámico:** Filtrado por categorías (Sandalias, Tacones, Tenis, etc.) en tiempo real.
*   **Carrito de Compras:** Persistencia de datos local y cálculo automático de totales.
*   **Checkout Inteligente:**
    *   Integración con **WhatsApp API** para enviar pedidos formateados.
    *   Soporte para pagos con **Nequi** (incluye subida de comprobante a la nube).
    *   Opción de pago Contra Entrega.
*   **Diseño Responsive:** Adaptado a móviles y escritorio.

### 🛠️ Panel Administrativo ("Nivel Dios")
*   **Gestión de Inventario:** Crear, editar y eliminar productos con persistencia en **Firebase Firestore**.
*   **Control de Stock:** Gestión detallada de unidades por Talla y Color.
*   **Carga Masiva:** Importación de productos desde archivos Excel/CSV.
*   **Herramientas Avanzadas:**
    *   Modo Oscuro (Dark Mode).
    *   Pruebas de Estrés y Diagnóstico de Sistema.
    *   Compresión automática de imágenes antes de subir.
    *   Alertas automáticas de stock bajo en los pedidos de WhatsApp.

## 🚀 Tecnologías Utilizadas

*   **Frontend:** HTML5, CSS3 (Variables, Flexbox, Grid), JavaScript (ES6 Modules).
*   **Backend (BaaS):** Google Firebase (Firestore Database).
*   **Almacenamiento de Imágenes:** ImgBB API.
*   **Integraciones:** WhatsApp Web API.

## 📦 Instalación y Uso

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/banttu-store.git
    ```
2.  **Ejecutar localmente:**
    Debido al uso de Módulos de ES6 (`import/export`), es necesario usar un servidor local.
    *   Con VS Code: Click derecho en `index.html` -> "Open with Live Server".
    *   Con Python: `python -m http.server`
    *   Con Node: `npx http-server`

---
Desarrollado por **Nexor - Tecnology Systems** © 2026