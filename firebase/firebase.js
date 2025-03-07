
import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from "dotenv";
dotenv.config();
// Load service account JSON using require()
// import fs from "fs";
import path from "path";

// Read the service account JSON file
const serviceAccount = JSON.parse(
  fs.readFileSync(path.resolve("firebase", "service-account.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://peponi-2135c.firebaseio.com", // Replace with your Firebase project URL
});

// Export authentication and Firestore
export const auth = admin.auth();
export const dbs = admin.firestore();


 

