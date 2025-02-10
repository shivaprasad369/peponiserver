import express from 'express';
import mysql from 'mysql2/promise'; // Use promise-based MySQL client
import bcrypt from 'bcryptjs';
import db from '../db/db.js';
const userRoute = express.Router();
// Registration endpoint
userRoute.post('/register', async (req, res) => {
  try {
    const { fullName, emailId, phoneNo, isVerified } = req.body;
    // Convert isVerified to integer
    const verificationStatus = isVerified ? parseInt(isVerified, 10) : 0;

    // Basic validation: phoneNo is optional
    if (!fullName || !emailId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fullName and emailId'
      });
    }

    // Check if email already exists
    const [existingUser] = await db.execute(
      'SELECT EmailID FROM tbl_user WHERE EmailID = ?',
      [emailId]
    );

    // If email exists, return success without doing anything
    if (existingUser.length > 0) {
      return res.status(201).json({
        success: true,
        message: 'User registered successfully'
      });
    }

    // Insert user data into database if email doesn't exist
    const [result] = await db.execute(
      'INSERT INTO tbl_user (FullName, EmailID, PhoneNo, Status, isVerified) VALUES (?, ?, ?, ?, ?)',
      [fullName, emailId, phoneNo, 1, verificationStatus]
    );

    if (result.affectedRows === 1) {
      console.log(`User created successfully with email: ${emailId}`);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        userId: result.insertId
      });
    } else {
      throw new Error('Failed to insert user');
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

// Verification endpoint
userRoute.put('/verify', async (req, res) => {
  try {
    const { emailId, isVerified } = req.body;
    // Convert isVerified to integer
    const verificationStatus = parseInt(isVerified, 10);

    // Basic validation
    if (!emailId || isVerified === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide emailId and isVerified status'
      });
    }

    // Update verification status
    const [result] = await db.execute(
      'UPDATE tbl_user SET isVerified = ? WHERE EmailID = ?',
      [verificationStatus, emailId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`User verified successfully with email: ${emailId}`);
    res.json({
      success: true,
      message: 'User verification status updated successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating verification status',
      error: error.message
    });
  }
});

export default userRoute;


