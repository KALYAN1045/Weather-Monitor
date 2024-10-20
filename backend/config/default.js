require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGO_URI,
  openWeatherAPI: {
    key: process.env.OPENWEATHER_API_KEY,
    baseURL: 'https://api.openweathermap.org/data/2.5'
  },
  cities: [
    { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
    { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
    { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
    { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 }
  ],
  updateInterval: 1 * 60 * 1000, // 5 minutes in milliseconds
};