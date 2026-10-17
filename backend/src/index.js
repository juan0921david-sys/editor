const express = require('express');
const cors = require('cors');
const db = require('./config/db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Ruta para probar que sí llega a tu laptop
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('⏳ Intentando conectar a la base de datos...');
    const result = await db.query('SELECT NOW()');
    console.log('✅ Conexión exitosa a la laptop');
    res.json({ success: true, message: '¡Conectado a la laptop!', time: result.rows[0].now });
  } catch (error) {
    console.error('❌ ERROR COMPLETO:', error); // Esto forzará que el error salga en la terminal
    res.status(500).json({ success: false, error: error.message || 'Error desconocido' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));