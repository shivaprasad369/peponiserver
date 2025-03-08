
import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from "dotenv";
import service from './service-account.js';
dotenv.config();
// Load service account JSON using require()
// import serviceAccount from './your-service-account.json' assert { type: 'json' };
// const serviceAccount={
//   "type": "service_account",
//   "project_id": "peponi-2135c",
//   "private_key_id": "e96fd101ceead77bec963ae300e733d047a86dc6",
//   "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCbf7oy6xUz+oHf\ng6z0BvonaCNVnYDTAMukV+sTGZnpDeFcTSGCOidDZI/6vmOO+ukgmlwN2Th6dXwW\ncmJQQ1f9vVc1cNGXKqd+IJOwl/DZ/u3SnYCy66N8uAceRZCiIs4GOW/kKZZ/aJH0\n5XXItbDvscYrMDZAJ5/rNY67LR+aTYH9933B5dpfUvaORrybuIQOiKDx3t7H48GG\nlkYb4GNXLhyOc7PgET1Tfy7/TXXs9xQ5iC909CLGcAi68MY3Fdn9fVz9ZZkdiEkO\nVzfPD1i+lxP6x+rGFwe0jhMuFsmu+JOL3K/CfDq6W3X0GTeB47sl//Gz5JQagNS2\nvTyqQ8OFAgMBAAECggEAIVTftMpvYRTxgdfX2vcj6A6KhG+ejZw+CpxN52o1c59m\nD0L5S9DrWabUtgrZjGx8TGDKGq3VTWqhjq42JL5Kvjk32Fy2kJC0FnUlM1Vea1wZ\n3mukirW39aP84qBGwHp1byAgu+euOuFPaA9HkB5iLv8MW3WaK2ZTATgZwEWL4Kcn\nAACa2RLDJnnRvgfKTAX3UXRc0PZD+WWJlHJ5yTQZLQk+hLS0avzHeiD3UciXnH9p\n1H7Rktqb/02qt/tCJCyDDvmxLGtF0+DOwc7sSD+Kq3p2bc6yN9rwTRMpHXFr6hj2\nfLAWlYr9GqXXVok4lXNWtdTvV+D/YhAsRDijHvjigQKBgQDOgdd5ACIkORLC0DFi\nFvzE/1utLn7tsfwfBdd5XlLY7yOPioPJ5D9h+p8R2dT2GrNsTShZNLhVHtzMeMij\nYv0idvz5Axi4stLaPLewN/Utlmt8Jjq34oO0QrVAAlTm1vEHLF4O0gQM+HQ65xuD\n0TNe4NJ2ChCk4gyEeJ7ffSxrnwKBgQDAxEvZIubE2eoJ55q93/2UpWnsFdVa7qkv\nJm4RDAY1Py1UMj0DpcjF78F48P1I6cDqnz3nbFSbnXxPZjPn8PyYHi2U2bWCi9O1\nVN9rLVZ4g6FacxK8+X7EbbOutqUkPNMOBPzR0h4I6qtsGc9bqOQJ4T93WQ5odWaj\n1/qojfc+WwKBgHMs58iM0n3xdw1AoMpcl84nvjHw5ModosiKsYr3mK11cxfz4V0Q\n+GjlJyMFo0k/yyJ0RjS6urR+6hcApqa55wT56E3Z9EfPNNqTUr/t9cjfREOR7t3w\ncBRxwDVbF49IAlZF4I/Tgn7Zc7oGe8ohO82HBtre8jmD+gdIXxO29LdxAoGBAKeJ\nM565XbXS6zzGhU/nIB6UEVY1t6P7byFiliDMwYx/pybZLvw/lxqpAQ7a7Ff1iUyh\nMA01suc43bSoUA6S/QY8nEMVYFLgshSUekVNNy0wwgi5oJyLfyi7a4I6jZbMIma5\n4P1/T8lSI8ClQfoY9HC9ywowZXxWJOnbqafbEvqnAoGAWbjoO6RMfCrps7QAWYb6\na+V1ciS+V8J9uEWoObB64SBX+XXtzeJx50gx/Klj5s1UfFdtpZK4VsJdFlxZdo8h\nGhhqpDQimLl00adyXQyzc8QSRLhOidn8huMqBMnD1LcUYyMWWURuFoly9zsZOIIr\nsY1cLpb+VR3PwpfFVqYu9Os=\n-----END PRIVATE KEY-----\n",
//   "client_email": "firebase-adminsdk-fbsvc@peponi-2135c.iam.gserviceaccount.com",
//   "client_id": "118398508526169683411",
//   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//   "token_uri": "https://oauth2.googleapis.com/token",
//   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//   "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40peponi-2135c.iam.gserviceaccount.com",
//   "universe_domain": "googleapis.com"
// }
  
// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(service),
  databaseURL: "https://peponi-2135c.firebaseio.com", // Replace with your Firebase project URL
});

// Export authentication and Firestore
export const auth = admin.auth();
export const dbs = admin.firestore();


 

