<template>
  <div class="glass-layout">
    <div class="bg-shape shape-blue"></div>
    <div class="bg-shape shape-purple"></div>

    <header class="glass-header">
      <h1>Editor Colaborativo</h1>
      <p class="status">● Sistema Glassmorphism</p>
    </header>
    
    <main class="content-area">
      <slot></slot>
    </main>
  </div>
</template>

<style scoped>
.glass-layout {
  position: relative;
  min-height: 100vh;
  background-color: #0f172a;
  color: #f8fafc;
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}
.bg-shape { position: absolute; border-radius: 50%; filter: blur(100px); z-index: 0; }
.shape-blue { width: 400px; height: 400px; background-color: rgba(56, 189, 248, 0.4); top: -100px; left: -100px; }
.shape-purple { width: 500px; height: 500px; background-color: rgba(168, 85, 247, 0.4); bottom: -150px; right: -100px; }

.glass-header {
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
h1 { margin: 0; font-size: 1.4rem; font-weight: 600; }
.status { margin: 0; font-size: 0.9rem; color: #38bdf8; }
.content-area { position: relative; z-index: 1; max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; }
</style>