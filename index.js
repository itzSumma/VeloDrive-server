const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]); 

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000; 

const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    
    const database = client.db("VeloDrive");
    const usersCollection = database.collection("users");
    const carsCollection = database.collection("cars"); 
    const bookingsCollection = database.collection("bookings"); 

   
    app.get('/cars', async (req, res) => {
      try {
        const { search, type } = req.query;
        let query = {};

        if (search) {
          query.name = { $regex: search, $options: "i" };
        }
        if (type && type !== "All") {
          query.type = type;
        }

        const result = await carsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch cars", error: error.message });
      }
    });

    
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
 
    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to insert user", error: error.message });
      }
    });

    
    app.post('/cars', async (req, res) => {
      try {
        const car = req.body;
        const result = await carsCollection.insertOne(car);
        res.status(201).send(result); 
      } catch (error) {
        res.status(500).send({ message: "Failed to insert car", error: error.message });
      }
    });

    
    app.post('/bookings', async (req, res) => {
      try {
        const bookingData = req.body;
        const result = await bookingsCollection.insertOne(bookingData);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to complete booking", error: error.message });
      }
    });

    
    app.get('/bookings/:userId', async (req, res) => {
      try {
        const userId = req.params.userId;
        
        let query = { userId: userId };

        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch user bookings", error: error.message });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } catch (error) {
    console.error("Database connection error:", error);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('VeloDrive Server is Running Successfully!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});