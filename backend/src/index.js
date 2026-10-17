const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' } 
});

app.use(cors());
app.use(express.json());


const semaforosBloques = {};

io.on('connection', (socket) => {
  console.log('🟢 Nuevo usuario conectado:', socket.id);

  socket.on('solicitar_bloqueo', (blockId) => {
    if (!semaforosBloques[blockId]) {
      semaforosBloques[blockId] = socket.id;
      io.emit('bloqueo_aprobado', { blockId, userId: socket.id });
      console.log(`🔒 Bloque ${blockId} bloqueado por ${socket.id}`);
    } 
    else if (semaforosBloques[blockId] !== socket.id) {
      socket.emit('bloqueo_denegado', blockId);
    }
  });

  socket.on('liberar_bloqueo', (blockId) => {
    if (semaforosBloques[blockId] === socket.id) {
      delete semaforosBloques[blockId];
      io.emit('bloque_liberado', blockId);
      console.log(`🔓 Bloque ${blockId} liberado por ${socket.id}`);
    }
  });

  socket.on('actualizar_contenido', (data) => {
    const { blockId, contenido } = data;
    if (semaforosBloques[blockId] === socket.id) {
      // Envía el texto a todos los demás usuarios conectados
      socket.broadcast.emit('contenido_actualizado', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Usuario desconectado:', socket.id);
    for (const blockId in semaforosBloques) {
      if (semaforosBloques[blockId] === socket.id) {
        delete semaforosBloques[blockId];
        io.emit('bloque_liberado', blockId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
});