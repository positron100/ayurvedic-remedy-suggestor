// const fs=require('fs');
const express = require("express");
const app = express();
const path = require("path");
const bodyparser = require("body-parser");
const hostname = "localhost";
const port = 3000;
require('dotenv').config({ path: './.env.local' });
// Add this line at the top to load environment variables
// using mongoose module
// using mongoose module
var mongoose = require("mongoose");

// Updated connection string for MongoDB Atlas
const mongoURI = process.env.mongoURI;
// Replace <username>, <password>, <cluster-address>, and <dbname> with the actual values
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("MongoDB connection established");
}).catch((error) => {
    console.log("MongoDB connection error:", error);
});

// Define Mongoose schema
var contactSchema = new mongoose.Schema({
    Name: String,
    Email: String,
    Contact: String,
    DOB: Date,
});

// Defining a model
var Contact = mongoose.model("Contact", contactSchema);

var dataSchema = new mongoose.Schema({
    disease: String,
    gender: String,
    severity: String,
    age: Number,
});

// Defining a model
var data = mongoose.model("data", dataSchema);

app.use(bodyparser.urlencoded({ extended: true })); // explicitly set the extended option to true or false
app.use("/static", express.static("static"));
app.use(express.urlencoded());

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
    res.status(200).render("ayurved.pug");
});

app.get("/contact", (req, res) => {
    res.status(200).render("contact.pug");
});

app.get("/details", (req, res) => {
    res.status(200).render("details.pug");
});

//  post request for CONTACT page

app.post("/contact", (req, res) => {
    // Everytime user is filling a form it is being stored at the database
    var myData = new Contact(req.body);
    myData
        .save()
        .then(() => {
            // res.send('This item has been saved to database');
            res.status(200).render("details.pug");
        })
        // ERROR BLOCK
        .catch(() => {
            res.status(400).send("Item was not saved to the database");
        });
});

// post request for details page
app.post("/details", (req, res) => {
    Disease = req.body.Disease;
    Gender = req.body.Gender;
    Severity = req.body.Severity;
    Age = req.body.Age;

    data
        .findOne({
            disease: Disease,
            gender: Gender,
            severity: Severity,
            age: Age,
        }, {
            _id: false,
            drug: true,
        })
        .then((medicine) => {
            if (medicine) {
                let medicinename = JSON.stringify(medicine);
                let medicinename2 = medicinename.slice(9, medicinename.length);
                let medicinename3 = medicinename2.slice(0, medicinename2.length - 2);
                console.log("Fetched medicine:", medicinename3);
                let params = {
                    content: medicinename3,
                };
                res.status(200).render("medicine.pug", params);
            } else {
                let params = {
                    content: "database has not been updated yet",
                };
                res.status(200).render("medicine.pug", params);
                console.log("medicine not found.");
            }
        });
});

app.listen(port, hostname, () => {
    console.log(
        `The website is succesfully running at http://${hostname}:${port}/`
    );
});