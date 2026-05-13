require('dotenv').config();


const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');

require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Smart Backup System API is running...');
});

// Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("AWS KEY:", process.env.AWS_ACCESS_KEY);
});