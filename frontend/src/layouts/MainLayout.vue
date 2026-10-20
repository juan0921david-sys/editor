<template>
  <div class="doc-layout">
    <header class="glass navbar">
      <div class="logo">📄 Editor_Docs</div>
      <div class="user-status"><span class="dot"></span> En línea</div>
    </header>

    <div class="toolbar-wrap">
      <div class="glass toolbar">
        <button class="tool-btn text">Archivo</button>
        <button class="tool-btn text">Editar</button>
        <button class="tool-btn text">Ver</button>

        <span class="sep"></span>

        <!-- @mousedown.prevent evita que el botón le quite el foco al bloque -->
        <button class="tool-btn" :class="{ on: activos.bold }" title="Negrita"
          @mousedown.prevent="formatear('bold')"><b>B</b></button>
        <button class="tool-btn" :class="{ on: activos.italic }" title="Cursiva"
          @mousedown.prevent="formatear('italic')"><i>I</i></button>
        <button class="tool-btn" :class="{ on: activos.underline }" title="Subrayado"
          @mousedown.prevent="formatear('underline')"><u>U</u></button>
        <button class="tool-btn" :class="{ on: activos.strikeThrough }" title="Tachado"
          @mousedown.prevent="formatear('strikeThrough')"><s>S</s></button>
        <button class="tool-btn" title="Quitar formato"
          @mousedown.prevent="formatear('removeFormat')">⌫</button>
      </div>
    </div>

    <main class="workspace-area">
      <div class="glass document-page">
        <slot></slot>
      </div>
    </main>
  </div>
</template>

<script setup>
import { reactive, onMounted, onUnmounted } from 'vue'

const activos = reactive({ bold: false, italic: false, underline: false, strikeThrough: false })

const formatear = (comando) => {
  document.execCommand(comando, false, null)
  actualizarActivos()
}

const actualizarActivos = () => {
  for (const c of Object.keys(activos)) {
    try { activos[c] = document.queryCommandState(c) } catch { activos[c] = false }
  }
}

onMounted(() => document.addEventListener('selectionchange', actualizarActivos))
onUnmounted(() => document.removeEventListener('selectionchange', actualizarActivos))
</script>

<style scoped>
.doc-layout {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ===== Cristal iOS reutilizable ===== */
.glass {
  background: linear-gradient(135deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.04) 100%);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(255,255,255,.16);
  border-top-color: rgba(255,255,255,.38);
  border-left-color: rgba(255,255,255,.26);
  box-shadow:
    0 10px 40px rgba(0,0,0,.45),
    inset 0 1px 0 rgba(255,255,255,.35),
    inset 0 -1px 0 rgba(255,255,255,.05);
}

.navbar {
  position: sticky;
  top: 12px;
  z-index: 10;
  margin: 12px auto 0;
  width: calc(100% - 32px);
  max-width: 1000px;
  padding: 12px 22px;
  border-radius: 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.logo { font-size: 1.1rem; font-weight: 700; letter-spacing: -.01em; }
.user-status {
  display: flex; align-items: center; gap: 8px;
  font-size: .8rem;
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.15);
  padding: 5px 12px;
  border-radius: 999px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80; }

.toolbar-wrap {
  position: sticky;
  top: 80px;
  z-index: 9;
  display: flex;
  justify-content: center;
  margin-top: 14px;
  padding: 0 16px;
}
.toolbar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border-radius: 20px;
  flex-wrap: wrap;
}
.sep { width: 1px; height: 22px; background: rgba(255,255,255,.2); margin: 0 6px; }

.tool-btn {
  min-width: 36px; height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: #fff;
  font-size: .95rem;
  cursor: pointer;
  transition: background .2s, transform .15s, box-shadow .2s;
}
.tool-btn.text { font-size: .85rem; font-weight: 600; color: rgba(255,255,255,.85); }
.tool-btn:hover { background: rgba(185,169,232,.22); }
.tool-btn:active { transform: scale(.92); }
.tool-btn.on {
  background: rgba(185,169,232,.4);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 0 14px rgba(185,169,232,.35);
}

.workspace-area {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 24px 16px 60px;
}
.document-page {
  width: 100%;
  max-width: 850px;
  min-height: 900px;
  padding: 60px 80px;
  border-radius: 28px;
  color: #fff;
}

@media (max-width: 720px) {
  .document-page { padding: 36px 20px 36px 52px; }
}
</style>