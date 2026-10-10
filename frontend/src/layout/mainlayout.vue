<template>
  <div class="app-container">
    <!-- Barra de navegación global -->
    <header>
      <nav>
        <router-link to="/">Inicio</router-link>
        <router-link to="/editor">Editor</router-link>
      </nav>
    </header>

    <!-- Aquí se inyectan las vistas hijas -->
    <main class="main-content">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
// Lógica global del layout (si se necesita después)
</script>