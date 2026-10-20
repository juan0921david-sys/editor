<template>
  <div class="app-wrapper" @click="closeMenu">
    <header class="pro-navbar" @click.stop>
      <div class="nav-content">
        <div class="nav-left">
          <div class="logo-icon">📄</div>
          <div class="doc-controls">
            <input 
              type="text" 
              v-model="documentTitle" 
              class="doc-title-input"
              placeholder="Documento sin título"
            />
            <div class="doc-menu">
              <div class="menu-container" v-for="menu in menus" :key="menu.name">
                <button class="menu-item" @click="toggleMenu(menu.name)">{{ menu.name }}</button>
                <div class="dropdown-glass" v-if="activeMenu === menu.name">
                  <button 
                    class="dropdown-item" 
                    v-for="opcion in menu.options" 
                    :key="opcion"
                    @click="closeMenu"
                  >
                    {{ opcion }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="nav-right">
          <div class="connected-users">
            <img src="https://ui-avatars.com/api/?name=Juan&background=B9A9E8&color=2B2563" class="avatar">
            <img src="https://ui-avatars.com/api/?name=Nicolas&background=2B2563&color=fff" class="avatar">
          </div>
          <button class="btn-share">Compartir</button>
        </div>
      </div>
    </header>
    
    <main class="main-content">
      <slot></slot>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const documentTitle = ref('Estructura Editor Colaborativo')
const activeMenu = ref(null)

const menus = [
  { name: 'Archivo', options: ['Nuevo documento', 'Abrir...', 'Hacer una copia', 'Descargar como PDF'] },
  { name: 'Editar', options: ['Deshacer', 'Rehacer', 'Cortar', 'Copiar', 'Pegar'] },
  { name: 'Ver', options: ['Diseño de impresión', 'Modo lectura', 'Pantalla completa'] },
  { name: 'Insertar', options: ['Imagen', 'Tabla', 'Enlace', 'Caracteres especiales'] },
  { name: 'Formato', options: ['Texto', 'Estilos de párrafo', 'Alinear y aplicar sangría'] },
  { name: 'Herramientas', options: ['Ortografía y gramática', 'Contar palabras'] }
]

const toggleMenu = (menuName) => {
  activeMenu.value = activeMenu.value === menuName ? null : menuName
}

const closeMenu = () => {
  activeMenu.value = null
}
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.pro-navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(43, 37, 99, 0.45);
  backdrop-filter: blur(35px) saturate(200%);
  -webkit-backdrop-filter: blur(35px) saturate(200%);
  border-bottom: 1px solid rgba(185, 169, 232, 0.3);
  padding: 8px 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-icon {
  font-size: 2.2rem;
  color: #B9A9E8;
}

.doc-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-title-input {
  font-family: inherit;
  font-size: 1.15rem;
  font-weight: 500;
  color: #ffffff;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 6px;
  width: 300px;
  transition: all 0.2s ease;
  outline: none;
  margin-left: -6px;
}

.doc-title-input:hover {
  border-color: rgba(185, 169, 232, 0.4);
}

.doc-title-input:focus {
  background: rgba(43, 37, 99, 0.6);
  border-color: #B9A9E8;
  box-shadow: 0 0 0 2px rgba(185, 169, 232, 0.3);
}

.doc-title-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.doc-menu {
  display: flex;
  gap: 2px;
  margin-left: -6px;
}

.menu-container {
  position: relative;
}

.menu-item {
  background: transparent;
  border: none;
  color: #e2dcf5;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.menu-item:hover {
  background: rgba(185, 169, 232, 0.25);
  color: #ffffff;
}

.dropdown-glass {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 5px;
  min-width: 220px;
  background: rgba(43, 37, 99, 0.85);
  backdrop-filter: blur(25px) saturate(180%);
  -webkit-backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(185, 169, 232, 0.3);
  border-radius: 8px;
  padding: 6px 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.dropdown-item {
  background: transparent;
  border: none;
  color: #ffffff;
  text-align: left;
  padding: 8px 16px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: rgba(185, 169, 232, 0.2);
  color: #B9A9E8;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.connected-users {
  display: flex;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(185, 169, 232, 0.5);
  margin-left: -10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.btn-share {
  background: rgba(185, 169, 232, 0.8);
  backdrop-filter: blur(10px);
  color: #2B2563;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 8px 20px;
  border-radius: 24px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(43, 37, 99, 0.3);
}

.btn-share:hover {
  background: rgba(185, 169, 232, 1);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(43, 37, 99, 0.5);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
}
</style>