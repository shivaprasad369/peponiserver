import express from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import db from "../db/db.js";
import dotenv from "dotenv";
dotenv.config();
const adminroute = express.Router();
adminroute.post("/register", async (req, res) => {
    const {  UserName, Password, EmailID } = req.body;
    if (!UserName || !Password || !EmailID) {
        return res.status(400).json({ message: "All fields are required" });
    }
    try {
        const [existingUser] = await db.execute(
            `SELECT * FROM admins WHERE username = ? OR email = ?`,
            [UserName, EmailID]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({
                message: "User with the same UserName or EmailID already exists",
            });
        }
        const salt = uuidv4();
        const hashedPassword = await bcrypt.hash(Password, 10);
        const [result] = await db.execute(
            `INSERT INTO admins  ( username, PasswordHash, Salt, email) VALUES (?, ?, ?, ?)`,
            [UserName, hashedPassword, salt, EmailID]
        );

        res.status(201).json({ message: "Admin registered successfully", AdminID: result.insertId });
    } catch (error) {
        res.status(500).json({ error: "Failed to register user" });
       
    }
});
adminroute.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  console.log(username,password);
  try {
    const [rows] = await db.execute(
      `SELECT * FROM admins  WHERE username = ?`,
      [username]
    );
    if (rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Invalid credentials or email not verified" });
    }
    const user = rows[0];
    const isPasswordMatch = await bcrypt.compare(
      password,
      user.PasswordHash
    );
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { AdminID: user.id, UserName: user.username },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );
    res
      .status(200)
      .json({ token, message: "Login successful", email: user.email,username:user.username });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});
adminroute.get("/verify", (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ message: "Token is valid", user: decoded,username:decoded.UserName });
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});
adminroute.get("/:id", async (req, res) => {
  const id = req.params.id;
  if(!id || Number.isNaN(id)){
    return res.status(400).json({message:"Invalid ID"});
  }
  try {
    const [result] = await db.query('SELECT id, username, email,phone FROM admins WHERE id = ?', [id]);
    res.status(200).json({message:"Admin fetched successfully",result:result});
  } catch (error) {
    res.status(500).json({message:"Internal server error"});
  }
});
adminroute.put("/:id", async (req, res) => {
  const id = req.params.id;
  if(!id || Number.isNaN(id)){
    return res.status(400).json({message:"Invalid ID"});
  }
  const { username, email,phone } = req.body;
  if(!username || !email || !phone){
    return res.status(400).json({message:"All fields are required"});
  }
  try {
    const [result] = await db.query('UPDATE admins SET username = ?, email = ?,phone = ? WHERE id = ?', [username, email, phone, id]);
    res.status(200).json({message:"Admin updated successfully",result:result});
  } catch (error) {
    res.status(500).json({message:"Internal server error"});
  }
});

adminroute.put('/change-password/:id',async(req,res)=>{
 
  const { id, oldPassword, newPassword } = req.body;

  if (!id || !oldPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required",error:error });
  }
  try{
    const [rows] = await db.execute(
      'SELECT * FROM admins WHERE id=?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = rows[0];
    const isPasswordMatch = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Invalid old password" });
    }
    const salt = uuidv4();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await db.execute(
      'UPDATE admins SET PasswordHash=?, Salt=? WHERE id=?',
      [hashedPassword, salt, id]
    );
    if (result[0].affectedRows > 0) {
      return res.status(200).json({ message: 'Password changed successfully.' });
    } else {
      return res.status(404).json({ error: 'User not found.' });
    }
  }catch{
    return res.status(500).json({ error: "Failed to change password" });
  }
})
export default adminroute;

