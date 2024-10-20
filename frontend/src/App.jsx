// app.jsx

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Sun,
  Cloud,
  CloudRain,
  Thermometer,
  Wind,
  Droplets,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import io from "socket.io-client";

const API_BASE_URL = "http://localhost:5000/api/weather";
const socket = io("http://localhost:5000");

const config = {
  cities: [
    { name: "Delhi", lat: 28.6139, lon: 77.209 },
    { name: "Mumbai", lat: 19.076, lon: 72.8777 },
    { name: "Chennai", lat: 13.0827, lon: 80.2707 },
    { name: "Bangalore", lat: 12.9716, lon: 77.5946 },
    { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
    { name: "Hyderabad", lat: 17.385, lon: 78.4867 },
  ],
};

const WeatherDashboard = () => {
  // Fixed unit to Celsius since backend sends Celsius
  const [unit] = useState("celsius");
  const [activeTab, setActiveTab] = useState("weather");
  const [weatherData, setWeatherData] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCity, setSelectedCity] = useState(config.cities[0].name);
  const [aggregates, setAggregates] = useState({
    averageTemp: 0,
    maxTemp: 0,
    minTemp: 0,
    dominantCondition: "",
  });
  const [alertForm, setAlertForm] = useState({
    email: "",
    city: "",
    condition: "",
    threshold: "",
  });

  const fetchCurrentWeather = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/current`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error("Invalid data format received from server");
      }

      const weatherObject = {};
      result.data.forEach((cityData) => {
        if (cityData && cityData.city) {
          weatherObject[cityData.city.name.toLowerCase()] = {
            temp: cityData.temp, // Already in Celsius
            feels_like: cityData.feels_like, // Already in Celsius
            main: cityData.main || "Clear",
            humidity: cityData.humidity,
            wind_speed: cityData.wind_speed,
          };
        }
      });

      setWeatherData(weatherObject);
      setError(null);
    } catch (err) {
      console.error("Error fetching weather data:", err);
      setError(err.message || "Failed to fetch weather data");
      setWeatherData({});
    }
  }, []);

  const fetchHistoricalData = useCallback(async (cityName) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/historical/${cityName}?days=7`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid historical data format received from server");
      }

      // Assuming data has averageTemp, maxTemp, minTemp, dominantCondition
      const formattedData = data.map((record) => ({
        name: new Date(record.timestamp).toLocaleDateString(),
        averageTemp: parseFloat(record.averageTemp.toFixed(1)),
        maxTemp: parseFloat(record.maxTemp.toFixed(1)),
        minTemp: parseFloat(record.minTemp.toFixed(1)),
        dominantCondition: record.dominantCondition,
      }));
      setHistoricalData(formattedData);

      // Calculate aggregates based on formattedData
      calculateAggregates(formattedData);

      setError(null);
    } catch (err) {
      console.error("Error fetching historical data:", err);
      setError(err.message || "Failed to fetch historical data");
      setHistoricalData([]);
    }
  }, []);

  const calculateAggregates = (data) => {
    let totalTemp = 0;
    let maxTemp = -Infinity;
    let minTemp = Infinity;
    const conditionCount = {};

    data.forEach((record) => {
      totalTemp += record.averageTemp;
      if (record.maxTemp > maxTemp) maxTemp = record.maxTemp;
      if (record.minTemp < minTemp) minTemp = record.minTemp;

      const condition = record.dominantCondition || "Clear";
      conditionCount[condition] = (conditionCount[condition] || 0) + 1;
    });

    const averageTemp = totalTemp / data.length;
    const dominantCondition = Object.keys(conditionCount).reduce((a, b) =>
      conditionCount[a] > conditionCount[b] ? a : b
    );

    setAggregates({
      averageTemp: averageTemp.toFixed(2),
      maxTemp: maxTemp.toFixed(1),
      minTemp: minTemp.toFixed(1),
      dominantCondition,
    });
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid alerts data format received from server");
      }

      setAlerts(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError(err.message || "Failed to fetch alerts");
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await fetchCurrentWeather();
        if (activeTab === "historical") {
          await fetchHistoricalData(selectedCity);
        } else if (activeTab === "alerts") {
          await fetchAlerts();
        }
      } catch (err) {
        console.error("Error in data fetching:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time updates via WebSocket
    socket.on("weatherUpdate", (data) => {
      setWeatherData((prevData) => ({
        ...prevData,
        [data.city.name.toLowerCase()]: {
          temp: data.temp,
          feels_like: data.feels_like,
          main: data.main || "Clear",
          humidity: data.humidity,
          wind_speed: data.wind_speed,
        },
      }));
    });

    return () => {
      socket.off("weatherUpdate");
    };
  }, [
    activeTab,
    selectedCity,
    fetchCurrentWeather,
    fetchHistoricalData,
    fetchAlerts,
  ]);

  const convertTemp = (temp) => {
    // Temperatures are already in Celsius
    return parseFloat(temp.toFixed(1));
  };

  const WeatherCard = ({ city, data }) => (
    <Card className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          {data.main === "Clear" && <Sun className="text-yellow-500" />}
          {data.main === "Clouds" && <Cloud className="text-gray-500" />}
          {data.main === "Rain" && <CloudRain className="text-blue-500" />}
          {city.charAt(0).toUpperCase() + city.slice(1)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Thermometer className="text-red-500" />
            <span>
              {data.temp}°C
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Thermometer className="text-orange-500" />
            <span>
              Feels: {data.feels_like}°C
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="text-blue-500" />
            <span>{data.humidity}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="text-gray-500" />
            <span>{data.wind_speed} m/s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const HistoricalData = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Historical Weather Data</h2>

      <div className="mb-4">
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select City" />
          </SelectTrigger>
          <SelectContent>
            {config.cities.map((city) => (
              <SelectItem key={city.name} value={city.name}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Daily Aggregates for {selectedCity}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Thermometer className="text-red-500" />
              <span>Average Temperature: {aggregates.averageTemp}°C</span>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer className="text-orange-500" />
              <span>Maximum Temperature: {aggregates.maxTemp}°C</span>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer className="text-blue-500" />
              <span>Minimum Temperature: {aggregates.minTemp}°C</span>
            </div>
            <div className="flex items-center gap-2">
              <Cloud className="text-gray-500" />
              <span>Dominant Condition: {aggregates.dominantCondition}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Temperature Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={['auto', 'auto']} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="averageTemp"
                  stroke="#8884d8"
                  name="Average Temperature (°C)"
                  activeDot={{ r: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="maxTemp"
                  stroke="#ff7300"
                  name="Max Temperature (°C)"
                />
                <Line
                  type="monotone"
                  dataKey="minTemp"
                  stroke="#82ca9d"
                  name="Min Temperature (°C)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const AlertsPanel = () => {
    const handleAlertSubmit = async (e) => {
      e.preventDefault();
      try {
        const response = await fetch(`${API_BASE_URL}/alerts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(alertForm),
        });
        if (!response.ok) {
          throw new Error("Failed to create alert");
        }
        fetchAlerts();
        setAlertForm({ email: "", city: "", condition: "", threshold: "" });
      } catch (error) {
        console.error("Error creating alert:", error);
        setError(error.message);
      }
    };

    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Weather Alerts</h2>
        <form onSubmit={handleAlertSubmit} className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="email"
              placeholder="Email"
              value={alertForm.email}
              onChange={(e) =>
                setAlertForm({ ...alertForm, email: e.target.value })
              }
              required
            />
            <Select
              value={alertForm.city}
              onValueChange={(value) =>
                setAlertForm({ ...alertForm, city: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select City" />
              </SelectTrigger>
              <SelectContent>
                {config.cities.map((city) => (
                  <SelectItem key={city.name} value={city.name}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={alertForm.condition}
              onValueChange={(value) =>
                setAlertForm({ ...alertForm, condition: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Above</SelectItem>
                <SelectItem value="below">Below</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Threshold"
              value={alertForm.threshold}
              onChange={(e) =>
                setAlertForm({ ...alertForm, threshold: e.target.value })
              }
              required
            />
          </div>
          <Button type="submit" className="mt-4">
            Create Alert
          </Button>
        </form>
        <div className="grid gap-4">
          {alerts.map((alert, index) => (
            <Alert key={index} variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {alert.condition === "above" ? "High" : "Low"} Temperature Alert
              </AlertTitle>
              <AlertDescription>
                {alert.city.name}: {alert.condition} {alert.threshold}°C
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-50 bg-white shadow-md p-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full max-w-3xl mx-auto"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weather">Current Weather</TabsTrigger>
            <TabsTrigger value="historical">Past Days</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Conditionally render the unit selector */}
        {activeTab !== "alerts" && (
          <div className="mb-6">
            <Select value={unit} onValueChange={() => { /* Unit is fixed to Celsius */ }}>
              <SelectTrigger className="w-[180px]" disabled>
                <SelectValue placeholder="Celsius (°C)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="celsius">Celsius (°C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {activeTab === "weather" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(weatherData).map(([city, data]) => (
              <WeatherCard key={city} city={city} data={data} />
            ))}
          </div>
        )}
        {activeTab === "historical" && <HistoricalData />}
        {activeTab === "alerts" && <AlertsPanel />}
      </div>
    </div>
  );
};

export default WeatherDashboard;
