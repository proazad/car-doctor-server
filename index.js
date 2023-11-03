const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
// middleware 
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h7gpv70.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middleware 
const logger = async (req, res, next) => {
    console.log("called : ", req.hostname, req.originalUrl);
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log("token from Middle ware", token);
    if (!token) {
        return res.status(401).send({ message: "Not Authorized" });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized" })
        }
        req.user = decoded;
        next();
    })
}
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        const servicesCollection = client.db("carDoctor").collection("services");
        const bookingsCollection = client.db("carDoctor").collection("bookings");
        // Auth Related API 
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h"
            })
            res
                .cookie("token", token, {
                    httpOnly: true,
                    secure: false
                })
                .send({ success: true });
        });


        // Service Related API 
        app.get("/services", async (req, res) => {
            const cursor = servicesCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get("/services/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = {
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            }
            const result = await servicesCollection.findOne(query, options);
            res.send(result);
        })


        // Bookings 
        app.post("/bookings", async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        })

        app.get("/bookings", verifyToken, async (req, res) => {
            let query = {};
            console.log("User in Valid Token:", req.user);
            if(req.query.email !== req.user.email){
                return res.status(403).send({message: "Forbbiden"})
            }
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })

        app.delete("/bookings/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
        })

        app.patch("/bookings/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const bookingupdate = req.body;
            const updatedDoc = {
                $set: { status: bookingupdate.status }
            }
            const result = await bookingsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Car Doctor Server is Running");
});

app.listen(port, () => {
    console.log(`Car Doctor Server is Running on Port: ${port}`);
});