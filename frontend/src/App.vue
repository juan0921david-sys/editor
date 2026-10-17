<template>
  <MainLayout>
    <EditorView />
  </MainLayout>
</template>

<script setup>
import MainLayout from './layouts/MainLayout.vue'
import EditorView from './views/EditorView.vue'
</script>

<style>
body, html { margin: 0; padding: 0; background-color: #0f172a; color: #ffffff; min-height: 100vh; }
</style>