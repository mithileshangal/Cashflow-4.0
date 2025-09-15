const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Deal = require('./models/Deal');

dotenv.config();

const seedDeals = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('Connected to MongoDB for seeding...');

        // Clear all existing deals to prevent duplicates
        await Deal.deleteMany({});
        console.log("Old deals removed successfully.");

        const smallDeals = [
            { name: "Small Business A", cost: 50000, passiveIncome: 5000, dealType: 'small' },
            { name: "Small Property B", cost: 100000, passiveIncome: 10000, dealType: 'small' },
            { name: "Online Store C", cost: 75000, passiveIncome: 7500, dealType: 'small' },
            { name: "Vintage Car", cost: 60000, passiveIncome: 6000, dealType: 'small' },
            { name: "Side Hustle", cost: 25000, passiveIncome: 2500, dealType: 'small' },
        ];

        const bigDeals = [
            { name: "Apartment Complex A", cost: 500000, passiveIncome: 50000, dealType: 'big' },
            { name: "Shopping Mall B", cost: 1000000, passiveIncome: 100000, dealType: 'big' },
            { name: "Commercial Office C", cost: 800000, passiveIncome: 80000, dealType: 'big' },
            { name: "Tech Startup D", cost: 1500000, passiveIncome: 150000, dealType: 'big' },
            { name: "Hotel Franchise E", cost: 2000000, passiveIncome: 200000, dealType: 'big' },
        ];
        
        await Deal.insertMany([...smallDeals, ...bigDeals]);
        
        console.log("New deals inserted successfully!");

    } catch (error) {
        console.error("Error seeding database:", error);
    } finally {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
    }
};

seedDeals();