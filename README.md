# Editor Colaborativo 📝

Un espacio para escribir, organizar ideas y trabajar en un mismo documento con otras personas, sin tener que estar enviando versiones diferentes del archivo.

Este proyecto nació de una idea sencilla: **hacer más fácil la escritura en equipo**. Cada persona puede entrar con su nombre y un color, compartir el documento mediante un enlace y ver quiénes están conectados. La interfaz tiene un estilo inspirado en los videojuegos retro, pero la idea es que editar un documento siga siendo algo práctico y cómodo.

## ¿Qué puedes hacer?

- **Editar en tiempo real:** los cambios se comparten entre las personas conectadas al mismo documento.
- **Trabajar por bloques:** agregar, eliminar, mover y cambiar el tipo de los bloques de contenido.
- **Evitar conflictos de edición:** el sistema bloquea temporalmente un bloque mientras alguien lo está editando.
- **Dar formato al texto:** usar títulos, listas, tareas, citas y otras opciones de formato.
- **Compartir documentos:** invitar a otras personas mediante un enlace o código de documento.
- **Personalizar la experiencia:** elegir un color de jugador, cambiar entre tema claro y oscuro y usar el modo enfoque.
- **Configurar las páginas:** ajustar tamaño, orientación, márgenes y zoom.
- **Exportar el trabajo:** descargar documentos en **PDF, Word (DOCX), HTML, Markdown (MD) o TXT**.
- **Guardar los cambios:** el servidor administra el guardado de los documentos en PostgreSQL.

## Tecnologías utilizadas

**Frontend:** Vue 3, Vite, TypeScript y JavaScript, Pinia, Vue Router, Axios y Socket.IO Client.

**Backend:** Node.js, Express, Socket.IO, PostgreSQL, JSON Web Tokens (JWT) y Zod.

## Estructura del proyecto

```text
editor/
├── frontend/           # Interfaz y componentes del editor
│   └── src/
│       ├── components/ # Bloques, barra de formato y pantalla de inicio
│       ├── layouts/    # Estructura visual de la aplicación
│       ├── stores/     # Estado de la sesión
│       ├── utils/      # Exportación, formatos y funciones de apoyo
│       └── views/      # Vista principal del editor
└── backend/
    └── src/
        ├── config/     # Base de datos y configuración
        ├── controllers/ # Controladores HTTP
        ├── models/     # Acceso a los datos
        ├── routes/     # Rutas de la API
        └── services/   # Lógica para administrar documentos
```

## Cómo ejecutar el proyecto en tu computador

Necesitas tener instalado **Node.js**, **npm** y **PostgreSQL**. Usa una versión de Node.js compatible con la versión de Vite incluida en el proyecto.

### 1. Descarga el repositorio

```bash
git clone https://github.com/juan0921david-sys/editor.git
cd editor
```

### 2. Configura el backend

Desde una terminal, entra a la carpeta del servidor e instala sus dependencias:

```bash
cd backend
npm install
```

Crea un archivo llamado `.env` dentro de `backend/` y configura tus propios datos:

```env
PORT=3000
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/editor_colaborativo
JWT_ACCESS_SECRET=coloca_aqui_una_clave_segura
JWT_REFRESH_SECRET=coloca_aqui_otra_clave_segura
```

Antes de iniciar, crea la base de datos `editor_colaborativo` en PostgreSQL (o usa el nombre que prefieras y actualiza `DATABASE_URL`). El backend intenta crear la tabla de documentos automáticamente si el usuario de la base de datos tiene los permisos necesarios.

Inicia el servidor con:

```bash
node src/index.js
```

Por defecto, el backend escucha en `http://localhost:3000`.

### 3. Configura el frontend

Abre otra terminal desde la carpeta principal del repositorio:

```bash
cd frontend
npm install
```

Crea un archivo `.env` dentro de `frontend/` con estas variables:

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:3000
```

Luego inicia la aplicación:

```bash
npm run dev
```

Abre en tu navegador la dirección que aparezca en la terminal (normalmente `http://localhost:5173`).

## ¿Cómo se usa?

Al abrir el editor, elige tu nombre y un color. Después podrás empezar a escribir, crear nuevos bloques y organizar el documento. Para trabajar con otra persona, comparte el enlace del documento: cuando entre, podrá ver el contenido y los cambios que se realicen.

El bloqueo de bloques ayuda a que dos personas no escriban sobre el mismo contenido al mismo tiempo. Al terminar, puedes exportar el documento en el formato que necesites.

## Estado del proyecto

**En desarrollo.** Seguimos ajustando la configuración, corrigiendo errores y mejorando la experiencia de edición colaborativa. Algunas funciones o pasos de instalación pueden cambiar a medida que avance el proyecto.

## Nota de seguridad

No subas los archivos `.env` a GitHub: contienen datos de conexión y claves que deben mantenerse privados. Usa tus propias credenciales al ejecutar el proyecto.

---

*La idea es sencilla: escribir juntos, sin complicarnos con distintas versiones del mismo documento.*
