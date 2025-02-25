import mysql from 'mysql2/promise';


const db = mysql.createPool({
    host: 'localhost',           
    user: 'root', 
    password: process.env.DB_PASSWORD,           
    // password: '',    
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,       // Adjust based on your workload
    queueLimit: 0,            // No limit on the queue
    connectTimeout: 10000,    // 10 seconds
});


export default db;
