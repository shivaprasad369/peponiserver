import mysql from 'mysql2/promise';

const db = mysql.createPool({
    host : '217.21.84.52',
    user: 'u597837427_peponi',         // Your MySQL username
    password: 'Shivaprasad#@2000', // Your MySQL password
    database: 'u597837427_peponi' ,
   
});
    

// Export the pool
export default db;