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

    // 🏎️ Get All Cars with Search and Type Filter
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

    // 🔍 Get Single Car Details
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

    // 🎯 My Bookings: নির্দিষ্ট ইউজারের ইমেইল অনুযায়ী বুকিং ডাটা ফিল্টার করে নিয়ে আসার API
    // URL format: http://localhost:5000/bookings?email=user@example.com
    app.get('/bookings', async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};

        // ফ্রন্টএন্ড থেকে যদি ইমেইল পাঠানো হয়, তবে শুধু সেই ইউজারের ডাটা ফিল্টার হবে
        if (email) {
          query = { userEmail: email };
        }

        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch user bookings", error: error.message });
      }
    });
 
    // 👤 Create/Insert User
    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to insert user", error: error.message });
      }
    });

    // ➕ Add a New Car
    app.post('/cars', async (req, res) => {
      try {
        const car = req.body;
        const result = await carsCollection.insertOne(car);
        res.status(201).send(result); 
      } catch (error) {
        res.status(500).send({ message: "Failed to insert car", error: error.message });
      }
    });

    // 📅 Create a New Booking & Update Car Booking Count
    app.post('/bookings', async (req, res) => {
      try {
        const bookingData = req.body;
        
        // ১. বুকিং ডেটা কালেকশনে ইনসার্ট করা
        const result = await bookingsCollection.insertOne(bookingData);
        
        // ২. 🎯 অ্যাসাইনমেন্ট চ্যালেঞ্জ: $inc অপারেটর ব্যবহার করে গাড়ির booking_count ফিল্ড ১ বাড়ানো
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