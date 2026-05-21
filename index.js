

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;
const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.BETTER_AUTH_SECRET;

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const verifyToken = (req, res, next) => {
  if (!jwtSecret) {
    return res.status(500).send({ message: "JWT secret is not configured" });
  }

  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, jwtSecret, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    req.decoded = decoded;
    next();
  });
};

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


    app.post('/jwt', async (req, res) => {
      try {
        if (!jwtSecret) {
          return res.status(500).send({ message: "JWT secret is not configured" });
        }

        const user = req.body;

        if (!user?.email) {
          return res.status(400).send({ message: "User email is required" });
        }

        const token = jwt.sign({ email: user.email }, jwtSecret, { expiresIn: '7d' });

        res
          .cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          })
          .send({ success: true });
      } catch (error) {
        res.status(500).send({ message: "Failed to generate token", error: error.message });
      }
    });

    app.post('/logout', async (req, res) => {
      res
        .clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        })
        .send({ success: true });
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
    app.get('/bookings', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "Forbidden access" });
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
    app.post('/cars', verifyToken, async (req, res) => {
      try {
        const car = req.body;

        if (car?.ownerEmail && car.ownerEmail !== req.decoded.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const result = await carsCollection.insertOne(car);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to insert car", error: error.message });
      }
    });

    // Create a New Booking & Update Car Booking Count
    app.post('/bookings', verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;

        if (bookingData?.userEmail !== req.decoded.email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

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

    app.get('/my-added-cars', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        if (req.decoded.email !== email) {
          return res.status(403).send({ message: "Forbidden access" });
        }

        const query = { ownerEmail: email };
        const result = await carsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch your cars", error: error.message });
      }
    });

    // Update a Car Details
    app.put('/cars/:id', verifyToken, async (req, res) => {
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

        if (existingCar.ownerEmail !== req.decoded.email) {
          return res.status(403).send({ message: "Forbidden access" });
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
    app.delete('/cars/:id', verifyToken, async (req, res) => {
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

        if (existingCar.ownerEmail !== req.decoded.email) {
          return res.status(403).send({ message: "Forbidden access" });
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
