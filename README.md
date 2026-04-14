# 🎓 Sistema de Gestión Académica y Analíticos (Frontend)

Una plataforma web de alto rendimiento orientada a la gestión de datos académicos, seguimiento de progreso estudiantil y automatización de certificados oficiales. Diseñada con una estética moderna, fluida y profesional.

## 🚀 Características Principales

-   **Dashboard Inteligente**: Visualización en tiempo real de estadísticas de alumnos, certificados emitidos y materias pendientes.
*   **Generador de PDFs Bajo Demanda**: Motor dinámico para la creación de Certificados Analíticos y Diplomas, manejando lógicas complejas de programas (TD1, TD2, PRO, etc.).
-   **Importador Automático**: Ingesta inteligente de datos desde Excel (Quinttos) con auto-detección de formatos y alineación de columnas.
-   **UI Premium**: Interfaz basada en *Glassmorphism*, animaciones fluidas con `framer-motion` y modo oscuro/claro balanceado.
*   **Validación Académica**: Algoritmos de verificación de completitud para asegurar que el alumno posee todas las notas requeridas antes de emitir documentos.

## 🛠️ Tech Stack

-   **Framework**: React 18 (Vite)
*   **Lenguaje**: TypeScript
-   **Estilos**: Vanilla CSS + Tailwind CSS (Optimizado)
*   **Animaciones**: Framer Motion
-   **Iconografía**: Lucide React
*   **Gestión de PDF**: jsPDF / pdf-lib
-   **Procesamiento de Datos**: XLSX (SheetJS)
*   **Notificaciones**: React Hot Toast

## 📦 Instalación y Setup

1.  Clonar el repositorio.
2.  Instalar dependencias:
    ```bash
    npm install
    ```
3.  Configurar variables de entorno en `.env`:
    ```env
    VITE_API_URL=http://localhost:3000
    ```
4.  Iniciar servidor de desarrollo:
    ```bash
    npm run dev
    ```

---
*Desarrollado para optimizar procesos administrativos en instituciones deportivas y de entrenamiento.*
