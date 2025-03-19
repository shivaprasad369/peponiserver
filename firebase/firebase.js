
import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from "dotenv";
// import service from './service-account.js';
dotenv.config();
admin.initializeApp({
  // credential: admin.credential.cert(service),
  databaseURL: "https://peponi-2135c.firebaseio.com", // Replace with your Firebase project URL
});

// Export authentication and Firestore
export const auth = admin.auth();
export const dbs = admin.firestore();


 

