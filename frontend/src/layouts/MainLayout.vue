<template>
  <div class="doc-layout">
    <!--Barra Superior-->
    <header class="navbar-indigo">
      <div class="logo">📄 Editor_Docs</div>
      <div class="user-status">● En línea</div>
    </header>

    <!--Barra de Herramientas-->
    <div class="toolbar-lavender">
      <button class="tool-btn">Archivo</button>
      <button class="tool-btn">Editar</button>
      <button class="tool-btn">Ver</button>
    </div>
    
    <!-- Área principal con fondo gris -->
    <main class="workspace-area">
      <!-- La "hoja blanca" del documento -->
      <div class="document-page">
        <slot></slot>
      </div>
    </main>
  </div>
</template>

<style scoped>
.doc-layout {
  min-height: 100vh;
  background-color: #f1f3f4; /* Gris muy claro tipo Google Docs */
  font-family: 'Inter', system-ui, sans-serif;
  display: flex;
  flex-direction: column;
}

.navbar-indigo {
  background-color: #2B2563; /* Tu color principal */
  color: #ffffff;
  padding: 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.2rem;
  font-weight: bold;
}

.user-status {
  font-size: 0.85rem;
  background: rgba(255,255,255,0.2);
  padding: 4px 10px;
  border-radius: 12px;
}

.toolbar-lavender {
  background-color: #B9A9E8; /* Tu color secundario */
  padding: 8px 20px;
  display: flex;
  gap: 15px;
  border-bottom: 1px solid #a393d1;
}

.tool-btn {
  background: transparent;
  border: none;
  color: #2B2563;
  font-weight: 600;
  cursor: pointer;
  padding: 5px 8px;
  border-radius: 4px;
}

.tool-btn:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

.workspace-area {
  flex: 1;
  overflow-y: auto;
  padding: 30px 10px;
  display: flex;
  justify-content: center;
}

.document-page {
  background-color: #ffffff;
  width: 100%;
  max-width: 850px; /* Ancho de una hoja A4/Carta */
  min-height: 1056px;
  padding: 60px 80px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
  color: #333333;
}
</style>