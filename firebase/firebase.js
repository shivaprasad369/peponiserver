
import admin from 'firebase-admin';
import fs from 'fs';

// Load service account JSON using require()
// import serviceAccount from './your-service-account.json' assert { type: 'json' };
const serviceAccount={
    "type": "service_account",
    "project_id": "peponi-2135c",
    "private_key_id": "b6d68f15f10aa1e64ab6843af006f1d6d0ffb078",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDNKBPT9N5pDt8s\nFHE/L869pGl3MQ+8w2hc24C6LYzZVPulmdGQBZ8rKiTj8fDI9uW502g/RTEO/t/g\nSQInkN4PNmdb5ilxILEYqpkwCmNR7Wyfp+msuwBKgT5WFtzOkj1Le5GlriukWJXP\nVgihoKvaPgfh8Ht0aGeUfK5Zug6Xh94XYFjttLqEEkeHs2MB8dIZ9OmbriJ0kGeq\nwFsUoVA19NEop0p1ySL/2SiOLIBASiUYX6f64EBaU6BU4+ODM/DoZBbwRdcErQAm\n0GmT8o/GWtnEFmEvBx7VIEtb35sNVygFUWE15Elt5Fp+9i6ZwEpdVH48gIAaWh0L\nNN5h38vLAgMBAAECggEADvFj3FTiHEnahIXqp70ONG70xZs7t7aN8/GDA0yNDUls\n2OeGxZQ7PzQfIsE9Fg4xtmLJHY6nH5395YK71vDs07PVPHLbwuMsMw0+AitHh7Cg\n8FIVKaEnSMX4KeIZbCxnrYdPGP/CKwLOyp7MGyWuTsOk5FaVT2nJXZ3lPyDXrj60\nUiW0+fK7+J3AWNCkMIGU9SvIscV4+5icyIjDv3yz87vvpX2vtrWYKbQw5MtktUlI\n9Nb1b1qmDTsp39e+DWEnuxaiWKyXKM80HV1An677Xr6RD5IBhyt1gpi3U+/6TKmO\nR5x841rJj2D25ijbWnNtVymKx90C5PNVyQdSCiw/fQKBgQDnPRRCDbjh5TVHfkxf\n8N5VR9J1Dx46tEg+Gcog3oQ6jRr7nKeuOUmfCuvMN2DobFooKv3oDBRNsAcjAvrF\n/UVe4nTDtPyAD80Znh3IVA/iX6Da9QRksQAEtQt2z0pKLPnZF/eT1C2OW9Q6NFw6\nmJ0vtwp6e2AI4bIFoM1oPrStvQKBgQDjIAOTZOSaJnrp9vRaIErVx0nacSYG9bER\nZfmr3YwZytujHMDTeu7bYi2afw46PCPH70pMiEeRmjmo8niGqDeAH+zxLjRMjsxi\nLEZMkngWBSa2bbqy+9fRbXu46/k923cUkcOj080LjzS2m6YE4ZaGmcy9SllMj6h0\nSENrOWHkJwKBgQCsP3FBqtsXWheQA+J8bP4Q5Ik+rV5FOFm/+JH6XgZ9XvLEjnLR\nctcGY6o12uKS/3NBDJVKLwVIwWDvkZ6fsQPlpCZ6Sez0r9CFzqQ8v3F9nOJDd9Qn\n9TkgSIQbolmiW1JZhmLjeV/d9UVnfe1dsKUWD/D8P77Pnt9vFdMsXdlUuQKBgQCs\nubv+a8wuLvVq2JQbtlMzIMvZhBMXV+HBCXxGZ8YUF2HROhyqt+LOlGt6AwYe432S\nnzgx27IR2OfgxAVE4sjSd3UKNckwL6jfQCx2Ly2EEYbPVcOWOlB2xHxCtbJmiHCX\nBAN0o65cDBxagyROsgB3fJ9nlRM0VkwVop8i/BCmIQKBgBgKjbX/gEp5lgCNM0Zu\nsw3WA+ZzivY3B/scKJiOJuy61KqKtbJnr85SEJBMbLak+ju2i73kzhblCM0mvYN2\n3kNyOcbyjKpMlZ0RNmoMrqb3iVSgLb1vLc8cZ5EPMG4VQXlcvxpj2NT7CXf1URAW\nhw3JJaMfXXe0Ffcfctok1m0p\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@peponi-2135c.iam.gserviceaccount.com",
    "client_id": "118398508526169683411",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40peponi-2135c.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
  }
  
// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://peponi-2135c.firebaseio.com", // Replace with your Firebase project URL
});

// Export authentication and Firestore
export const auth = admin.auth();
export const dbs = admin.firestore();


 

