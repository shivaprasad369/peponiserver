import mysql from 'mysql2/promise';

// const db = mysql.createPool({
//     host : '217.21.84.52',
//     user: 'u597837427_peponi',         // Your MySQL username
//     password: 'Shivaprasad#@2000', // Your MySQL password
//     database: 'u597837427_peponi' ,
//     waitForConnections: true,
//     connectionLimit: 10, // Adjust based on your workload
//     queueLimit: 0,       // No limit on the queue
//     connectTimeout: 10000,
    
// });
const db = mysql.createPool({
    host : 'localhost',
    user: 'root',         // Your MySQL username
    // password: 'Admin@123', // Your MySQL password
    password: '', // Your MySQL password
    database: 'peponi' ,
    waitForConnections: true,
    connectionLimit: 10, // Adjust based on your workload
    queueLimit: 0,       // No limit on the queue
    connectTimeout: 10000, // 10 seconds
});



// Export the pool
export default db;
