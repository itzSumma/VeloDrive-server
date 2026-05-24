

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const database = client.db("VeloDrive");
const usersCollection = database.collection("users");
const carsCollection = database.collection("cars");
const bookingsCollection = database.collection("bookings");

let isConnected = false;
async function connectToDatabase() {
  if (isConnected) return;
  await client.connect();
  isConnected = true;
  console.log("Successfully connected to MongoDB!");
}

// Middleware to ensure DB connection is active before processing requests
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("Database connection middleware error:", error);
    res.status(500).send({ message: "Failed to connect to database", error: error.message });
  }
});




    // Get All Cars with Search and Type Filter
    app.get('/cars', async (req, res) => {
      try {
        const { search, type } = req.query;
        const filters = [];

        if (search) {
          filters.push({
            $or: [
              { name: { $regex: search, $options: "i" } },
              { carModel: { $regex: search, $options: "i" } },
            ],
          });
        }

        if (type && type !== "All") {
          filters.push({
            $or: [
              { type: { $in: [type] } },
              { carType: { $in: [type] } },
            ],
          });
        }

        const query = filters.length > 0 ? { $and: filters } : {};

        const result = await carsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch cars", error: error.message });
      }
    });

    // Get Single Car Details
    app.get('/cars/:id', async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Car ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await carsCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "Car not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch car details", error: error.message });
      }
    });

    // My Bookings
    app.get('/bookings', async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const query = { userEmail: email };
        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch user bookings", error: error.message });
      }
    });

    // Create/Insert User
    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to insert user", error: error.message });
      }
    });

    // Add a New Car
    app.post('/cars', async (req, res) => {
      try {
        const car = req.body;

        const result = await carsCollection.insertOne(car);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to insert car", error: error.message });
      }
    });

    // Create a New Booking & Update Car Booking Count
    app.post('/bookings', async (req, res) => {
      try {
        const bookingData = req.body;

        const result = await bookingsCollection.insertOne(bookingData);

        if (bookingData.carId && ObjectId.isValid(bookingData.carId)) {
          await carsCollection.updateOne(
            { _id: new ObjectId(bookingData.carId) },
            { $inc: { booking_count: 1 } }
          );
        }

        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to complete booking", error: error.message });
      }
    });

    app.get('/my-added-cars', async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const query = { ownerEmail: email };
        const result = await carsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch your cars", error: error.message });
      }
    });

    // Update a Car Details
    app.put('/cars/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updatedCarData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Car ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        const existingCar = await carsCollection.findOne(filter);

        if (!existingCar) {
          return res.status(404).send({ message: "Car not found" });
        }

        const updateDoc = {
          $set: {
            dailyRentPrice: updatedCarData.dailyRentPrice,
            availability: updatedCarData.availability,
            description: updatedCarData.description,
          },
        };

        const result = await carsCollection.updateOne(filter, updateDoc);
        res.send({ message: "Car updated successfully", result });
      } catch (error) {
        res.status(500).send({ message: "Failed to update car", error: error.message });
      }
    });

    // Delete a Car
    app.delete('/cars/:id', async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Car ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const existingCar = await carsCollection.findOne(query);

        if (!existingCar) {
          return res.status(404).send({ message: "Car not found" });
        }

        const result = await carsCollection.deleteOne(query);
        res.send({ message: "Car deleted successfully", result });
      } catch (error) {
        res.status(500).send({ message: "Failed to delete car", error: error.message });
      }
    });

    // Connection is now managed dynamically via middleware for Serverless compatibility


app.get('/', (req, res) => {
  res.send('VeloDrive Server is Running Successfully!');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;