
import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from "dotenv";
dotenv.config();
import path from "path";
// const serviceAccount = JSON.parse(
//   fs.readFileSync(path.resolve("firebase", "service-account.json"), "utf8")
// );
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:process.env.FIREBASE_DATABASE_URL, // Replace with your Firebase project URL
});
export const auth = admin.auth();
export const dbs = admin.firestore();


 

