import express from 'express';
import mysql from 'mysql2/promise'; // Use promise-based MySQL client
import bcrypt from 'bcryptjs';
import db from '../db/db.js';
const userRoute = express.Router();

// Function to check and create the user table if it doesn't exist
const createUserTableIfNotExists = async () => {
  try {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS tbl_user (
  UserID INT AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(50),
  FirstName VARCHAR(50),
  LastName VARCHAR(50),
  EmailID VARCHAR(75) UNIQUE,
  PhoneNo VARCHAR(20),
  Address VARCHAR(100),
  City VARCHAR(50),
  ZipPostalCode VARCHAR(20),
  CountryID INT,
  PasswordHash VARCHAR(100),
  Salt CHAR(36),  
  PwdResetKey CHAR(36),
  PwdKeyCreatedTime DATETIME,
  Website VARCHAR(10)
)

    `;
    const [result] = await db.query(createTableQuery); // Await query result directly
    console.log('Table ensured to exist: tbl_user');
  } catch (error) {
    console.error('Error creating table:', error);
  }
};

// Call the function to ensure the table exists (Usually done during app startup)

// Register user route
userRoute.post('/register', async (req, res) => {
    createUserTableIfNotExists();
  const { email, password, firstName, lastName } = req.body;

  // Validate input fields
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if the email already exists in the database
    const [rows] = await db.query('SELECT * FROM tbl_user WHERE EmailID = ?', [email]);
    
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Hash the password using bcrypt
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Insert the new user into the database
    const insertQuery = 'INSERT INTO tbl_user (FirstName, LastName, EmailID, PasswordHash, Salt) VALUES (?, ?, ?, ?, ?)';
    const [result] = await db.query(insertQuery, [firstName, lastName, email, hashedPassword, salt]);

    // Respond with success
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'An error occurred during registration.' });
  }
});
userRoute.get('/', async (req, res) => {
    let { page = 1, limit = 20 } = req.query; // Default to 1st page, 20 users per page
    
    // Ensure page and limit are numbers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    
    // Calculate the offset based on page number
    const offset = (page - 1) * limit;

    try {
        // Retrieve the most recently registered users (sorted by UserID DESC)
        const query = `
            SELECT 
                UserID as id, 
                FirstName as name, 
                EmailID as email, 
                PhoneNo as phone, 
                Status as status
            FROM tbl_user
            ORDER BY UserID DESC
            LIMIT ? OFFSET ?;
        `;
        const [result] = await db.query(query, [limit, offset]);
        const countQuery = `SELECT COUNT(DISTINCT UserID) as total FROM tbl_user`;
        const [countResult] = await db.query(countQuery);
        if (result.length > 0) {
            const totalProducts = countResult[0].total;
            const totalPages = Math.ceil(totalProducts / limit);
            // Successfully retrieved users
    
            res.status(200).json({ users: result, totalProducts,
                totalPages,
                currentPage: page,
                limit, });
        } else {
            // No users found for the requested page
            res.status(404).json({ message: 'No users found.' });
        }
    } catch (error) {
        console.error('Error retrieving users:', error);
        res.status(500).json({ error: 'An error occurred while retrieving users.' });
    }
});

userRoute.put('/:id', async(req,res)=>{
 const {id}=req.params;
 const {status}=req.body
  if(!id || isNaN(id)){
    return res.status(401).send({message:'invalid Id'})
  }
  try{
    const [result]= await db.query('UPDATE tbl_user SET Status=? WHERE UserID =?',[status,id])
    res.status(200).send({message:'Updated successfully'})

  }catch(error){
    res.status(500).send({message:'internal server error'})
  }
})
userRoute.delete('/:id', async(req,res)=>{
    const {id}=req.params;
   
     if(!id || isNaN(id)){
       return res.status(401).send({message:'invalid Id'})
     }
     try{
       const [result]= await db.query('DELETE FROM tbl_user WHERE UserID =?',[id])
       res.status(200).send({message:'Deleted successfully'})
   
     }catch(error){
       res.status(500).send({message:'internal server error'})
     }
   })
export default userRoute;
