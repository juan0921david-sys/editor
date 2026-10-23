<template>
  <div class="retro-bg no-print">
    <div class="retro-grid"></div>
    <div class="blob indigo-blob"></div>
    <div class="blob lavender-blob"></div>
  </div>
  <div class="crt-overlay no-print"></div>
  <PantallaInicio v-if="!sesion.listo" />
  <MainLayout v-else>
    <router-view />
  </MainLayout>
</template>

<script setup>
import MainLayout from './layouts/MainLayout.vue'
import PantallaInicio from './components/PantallaInicio.vue'
import { sesion } from './stores/sesion'
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Press+Start+2P&family=VT323&display=swap');

html {
  scroll-padding-top: 200px;
}

@media print {
  .doc-sheet {
    zoom: 1 !important;
  }
}
:root {
  --bg: #ece8fa;
  --bg-grid: rgba(43, 37, 99, 0.08);
  --panel: #f6f3ff;
  --sheet: #ffffff;
  --ink: #2b2563;
  --accent: #b9a9e8;
  --accent-soft: rgba(185, 169, 232, 0.35);
  --hover: rgba(185, 169, 232, 0.16);
  --shadow: #2b2563;
  --text: #1b1740;
  --muted: #6c64a6;
  --on-ink: #f6f3ff;
  --on-accent: #1b1740;
  --scan: rgba(43, 37, 99, 0.05);
  --vignette: rgba(43, 37, 99, 0.14);
  --blob-a: 0.35;
  --blob-b: 0.5;
  --nav-h: 90px;
  color-scheme: light;
}

:root[data-theme='dark'] {
  --bg: #050505;
  --bg-grid: rgba(185, 169, 232, 0.07);
  --panel: #100d22;
  --sheet: #0b0918;
  --ink: #b9a9e8;
  --accent: #b9a9e8;
  --accent-soft: rgba(185, 169, 232, 0.16);
  --hover: rgba(185, 169, 232, 0.07);
  --shadow: #2b2563;
  --text: #eeeaff;
  --muted: #9a91d3;
  --on-ink: #1b1740;
  --on-accent: #1b1740;
  --scan: rgba(0, 0, 0, 0.3);
  --vignette: rgba(0, 0, 0, 0.6);
  --blob-a: 0.6;
  --blob-b: 0.28;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family: 'VT323', monospace;
  font-size: 1.25rem;
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}

button,
input {
  font-family: inherit;
}

button:focus-visible,
input:focus-visible {
  outline: 2px dashed var(--ink);
  outline-offset: 2px;
}

::selection {
  background: var(--accent);
  color: var(--on-accent);
}

::-webkit-scrollbar {
  width: 14px;
  height: 14px;
}

::-webkit-scrollbar-track {
  background: var(--panel);
  border-left: 2px solid var(--ink);
}

::-webkit-scrollbar-thumb {
  background: var(--accent);
  border: 2px solid var(--ink);
}

.retro-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: var(--bg);
  transition: background 0.3s;
}

.retro-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(var(--bg-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px);
  background-size: 32px 32px;
  animation: grid-move 24s linear infinite;
  -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 85%);
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 85%);
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  animation: float-slow 18s infinite alternate ease-in-out;
}

.indigo-blob {
  background: #2b2563;
  opacity: var(--blob-a);
  width: 50vw;
  height: 50vw;
  top: -10vh;
  left: -10vw;
}

.lavender-blob {
  background: #b9a9e8;
  opacity: var(--blob-b);
  width: 55vw;
  height: 55vw;
  bottom: -15vh;
  right: -10vw;
  animation-delay: -6s;
}

.crt-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, var(--scan) 0px, var(--scan) 1px, transparent 1px, transparent 3px),
    radial-gradient(ellipse at center, transparent 62%, var(--vignette) 100%);
}

:root[data-crt='off'] .crt-overlay {
  display: none;
}

.px-panel {
  background: var(--panel);
  border: 3px solid var(--ink);
  box-shadow: 6px 6px 0 var(--shadow), inset 0 0 0 2px var(--panel), inset 0 0 0 4px var(--accent-soft);
}

.px-btn {
  height: 40px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--panel);
  color: var(--text);
  border: 3px solid var(--ink);
  box-shadow: 3px 3px 0 var(--shadow);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 0.06s, box-shadow 0.06s, background 0.15s;
}

.px-btn:hover {
  background: var(--accent-soft);
}

.px-btn:active {
  transform: translate(3px, 3px);
  box-shadow: none;
}

.px-btn.primary {
  background: var(--accent);
  color: var(--on-accent);
}

.px-btn.primary:hover {
  filter: brightness(1.08);
}

@keyframes grid-move {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 0 32px;
  }
}

@keyframes float-slow {
  0% {
    transform: translate(0, 0) scale(1);
  }
  100% {
    transform: translate(5vw, 5vh) scale(1.08);
  }
}

@keyframes parpadeo {
  50% {
    opacity: 0;
  }
}

@keyframes pop {
  0% {
    transform: translate(-50%, 12px);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .retro-grid,
  .blob {
    animation: none;
  }
}

@media print {
  .no-print,
  .retro-bg,
  .crt-overlay {
    display: none !important;
  }

  html,
  body {
    background: #ffffff !important;
  }

  .main-content {
    padding: 0 !important;
  }

  .doc-sheet {
    border: none !important;
    box-shadow: none !important;
    background: #ffffff !important;
    min-height: 0 !important;
  }

  .doc-sheet .sheet-body {
    padding: 0 !important;
  }

  .doc-sheet .rich-textarea,
  .doc-sheet .rich-textarea * {
    color: #000000 !important;
    border-color: transparent !important;
    background: transparent !important;
  }
}
</style>