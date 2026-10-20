<template>
  <div class="ios-background">
    <div class="blob indigo-blob"></div>
    <div class="blob lavender-blob"></div>
  </div>
  <MainLayout>
    <router-view />
  </MainLayout>
</template>

<script setup>
import MainLayout from './layouts/MainLayout.vue'
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

body, html { 
  margin: 0; padding: 0; 
  font-family: 'Inter', system-ui, sans-serif;
  background-color: #f8f9fa;
  color: #2B2563;
  overflow-x: hidden;
}

* { box-sizing: border-box; }

.ios-background {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: -1;
  overflow: hidden;
  background: rgba(185, 169, 232, 0.1);
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.6;
  animation: float-slow 15s infinite alternate ease-in-out;
}

.indigo-blob {
  background: #2B2563;
  width: 50vw; height: 50vw;
  top: -5vh; left: -5vw;
}

.lavender-blob {
  background: #B9A9E8;
  width: 60vw; height: 60vw;
  bottom: -10vh; right: -5vw;
  animation-delay: -5s;
}

@keyframes float-slow {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(5vw, 5vh) scale(1.05); }
}
</style>