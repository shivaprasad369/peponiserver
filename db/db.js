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
// const db = mysql.createPool({
//     host: '18.168.176.225',    // Separate host without port
//     port: 3306,                // Port as separate property
//     user: 'root',              // Your MySQL username
//     password: 'Admin@123',     // Your MySQL password
//     database: 'peponi',
//     waitForConnections: true,
//     connectionLimit: 10,       // Adjust based on your workload
//     queueLimit: 0,            // No limit on the queue
//     connectTimeout: 10000,    // 10 seconds
// });

const db = mysql.createPool({
    host: 'localhost',    // Separate host without port               // Port as separate property
    user: 'root', 
    password: 'Admin@123',             // Your MySQL username
    // password: '',     // Your MySQL password
    database: 'peponi',
    waitForConnections: true,
    connectionLimit: 10,       // Adjust based on your workload
    queueLimit: 0,            // No limit on the queue
    connectTimeout: 10000,    // 10 seconds
});


export default db;
