// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config/default');
const weatherRoutes = require('./routes/weather');
const weatherService = require('./services/weatherService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this to your frontend's origin in production
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/weather', weatherRoutes);

// Start weather data collection service

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
weatherService.startWeatherDataCollection(io); // Pass io instance

const PORT = config.port;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
