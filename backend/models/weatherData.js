// models/WeatherData.js
const mongoose = require('mongoose');

const weatherDataSchema = new mongoose.Schema({
  city: {
    name: String,
    lat: Number,
    lon: Number
  },
  temp: Number,
  feels_like: Number,
  main: String,
  humidity: Number,
  wind_speed: Number,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// models/WeatherAlert.js
const weatherAlertSchema = new mongoose.Schema({
  city: {
    name: String,
    lat: Number,
    lon: Number
  },
  type: String,
  threshold: Number,
  condition: String,
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = {
  WeatherData: mongoose.model('WeatherData', weatherDataSchema),
  WeatherAlert: mongoose.model('WeatherAlert', weatherAlertSchema)
};