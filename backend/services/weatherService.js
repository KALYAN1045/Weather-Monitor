const axios = require("axios");
const config = require("../config/default");
const { WeatherData, WeatherAlert } = require("../models/weatherData.js");
const nodemailer = require("nodemailer");

class WeatherService {
  constructor() {
    this.apiKey = config.openWeatherAPI.key;
    this.baseURL = config.openWeatherAPI.baseURL;
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async fetchWeatherForCity(city) {
    try {
      const response = await axios.get(
        `${this.baseURL}/weather?lat=${city.lat}&lon=${city.lon}&appid=${this.apiKey}&units=metric` // Added units=metric
      );

      const weatherData = new WeatherData({
        city: {
          name: city.name,
          lat: city.lat,
          lon: city.lon,
        },
        temp: response.data.main.temp, // Now in Celsius
        feels_like: response.data.main.feels_like, // Now in Celsius
        main: response.data.weather[0].main,
        humidity: response.data.main.humidity,
        wind_speed: response.data.wind.speed,
      });

      await weatherData.save();
      await this.checkAlerts(weatherData);

      return weatherData;
    } catch (error) {
      console.error(`Error fetching weather for ${city.name}:`, error);
      throw error;
    }
  }

  async fetchHistoricalData(cityName, days = 7) {
    const endDate = new Date();
    const startDate = new Date(endDate - days * 24 * 60 * 60 * 1000);

    const data = await WeatherData.find({
      "city.name": cityName,
      timestamp: { $gte: startDate, $lte: endDate },
    }).sort({ timestamp: 1 });

    // Aggregate data by day
    const aggregates = {};

    data.forEach((record) => {
      const date = record.timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!aggregates[date]) {
        aggregates[date] = {
          totalTemp: 0,
          count: 0,
          maxTemp: -Infinity,
          minTemp: Infinity,
          conditions: {},
        };
      }
      aggregates[date].totalTemp += record.temp;
      aggregates[date].count += 1;
      if (record.temp > aggregates[date].maxTemp)
        aggregates[date].maxTemp = record.temp;
      if (record.temp < aggregates[date].minTemp)
        aggregates[date].minTemp = record.temp;

      const condition = record.main || "Clear";
      aggregates[date].conditions[condition] =
        (aggregates[date].conditions[condition] || 0) + 1;
    });

    // Convert aggregates to array
    const result = Object.keys(aggregates).map((date) => ({
      timestamp: new Date(date),
      averageTemp: aggregates[date].totalTemp / aggregates[date].count,
      maxTemp: aggregates[date].maxTemp,
      minTemp: aggregates[date].minTemp,
      dominantCondition: Object.keys(aggregates[date].conditions).reduce(
        (a, b) =>
          aggregates[date].conditions[a] > aggregates[date].conditions[b]
            ? a
            : b
      ),
    }));

    return result;
  }

  async checkAlerts(weatherData) {
    const alerts = await WeatherAlert.find({
      "city.name": weatherData.city.name,
      active: true,
    });

    for (const alert of alerts) {
      let shouldTrigger = false;

      switch (alert.condition) {
        case "above":
          shouldTrigger = weatherData.temp > alert.threshold;
          break;
        case "below":
          shouldTrigger = weatherData.temp < alert.threshold;
          break;
      }

      if (shouldTrigger) {
        await this.sendAlertEmail(alert, weatherData);
      }
    }
  }

  async sendAlertEmail(alert, weatherData) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: alert.email,
      subject: `Weather Alert for ${alert.city.name}`,
      text: `The temperature in ${alert.city.name} is now ${weatherData.temp}°C, which is ${alert.condition} your set threshold of ${alert.threshold}°C.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Alert email sent for ${alert.city.name}`);
    } catch (error) {
      console.error("Error sending alert email:", error);
    }
  }

  startWeatherDataCollection(io) {
    const collectData = async () => {
      for (const city of config.cities) {
        try {
          const weatherData = await this.fetchWeatherForCity(city);
          io.emit("weatherUpdate", weatherData);
        } catch (error) {
          console.error(`Failed to collect data for ${city.name}:`, error);
        }
      }
    };

    // Collect initial data
    collectData();

    // Set up interval for regular data collection
    setInterval(collectData, config.updateInterval);
  }
}

module.exports = new WeatherService();
