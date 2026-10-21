const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const db = require('./config/db'); 

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' } 
});

app.use(cors());
app.use(express.json());


app.get('/api/status', async (req, res) => {
  try {
    const respuesta = await db.query('SELECT NOW()'); 
    res.status(200).json({ 
      status: 'success',
      message: 'Conexión a PostgreSQL establecida correctamente.', 
      timestamp: respuesta.rows[0].now 
    });
  } catch (error) {
    console.error('Error de conexión a la base de datos:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error interno del servidor. No se pudo establecer conexión con la base de datos.' 
    });
  }
});
// ==========================================


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
  console.log(`🚀 Servidor backend ejecutándose correctamente en el puerto ${PORT}`);
});