const express = require("express");
const router = express.Router();
const weatherService = require("../services/weatherService");
const config = require("../config/default");
const { WeatherAlert } = require("../models/weatherData");

// Get current weather for all cities
router.get("/current", async (req, res) => {
  try {
    const weatherPromises = config.cities.map((city) =>
      weatherService.fetchWeatherForCity(city)
    );
    const weatherData = await Promise.all(weatherPromises);
    res.json({ data: weatherData });
  } catch (error) {
    console.error("Error in /current route:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get historical data for a city
router.get("/historical/:cityName", async (req, res) => {
  try {
    const { cityName } = req.params;
    const { days = 7 } = req.query;
    const data = await weatherService.fetchHistoricalData(
      cityName,
      parseInt(days)
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new weather alert
router.post("/alerts", async (req, res) => {
  try {
    const { email, city, condition, threshold } = req.body;
    const cityObj = config.cities.find(
      (c) => c.name.toLowerCase() === city.toLowerCase()
    );

    if (!cityObj) {
      return res.status(400).json({ message: "City not found" });
    }

    const alert = new WeatherAlert({
      email,
      city: cityObj,
      condition,
      threshold: parseFloat(threshold),
    });

    await alert.save();
    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all active alerts
router.get("/alerts", async (req, res) => {
  try {
    const alerts = await WeatherAlert.find({ active: true });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;