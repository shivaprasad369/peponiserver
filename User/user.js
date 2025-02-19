import express from 'express';

import db from '../db/db.js';
const userRoute = express.Router();

// Registration endpoint
userRoute.post('/register', async (req, res) => {
  try {
    console.log('[Register] Request received:', req.body);
    const { fullName, emailId, phoneNo, isVerified } = req.body;
    const verificationStatus = isVerified ? parseInt(isVerified, 10) : 0;
    
    console.log('[Register] Parsed data:', {
      fullName,
      emailId,
      phoneNo,
      verificationStatus
    });

    if (!fullName || !emailId) {
      console.log('[Register] Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide fullName and emailId'
      });
    }

    console.log('[Register] Checking for existing user with email:', emailId);
    const [existingUser] = await db.execute(
      'SELECT email FROM tbl_user WHERE email = ?',
      [emailId]
    );
    console.log('[Register] Existing user check result:', existingUser);

    if (existingUser.length > 0) {
      console.log('[Register] User already exists with email:', emailId);
      return res.status(201).json({
        success: true,
        message: 'User registered successfully'
      });
    }

    console.log('[Register] Attempting to insert new user');
    const [result] = await db.execute(
      'INSERT INTO tbl_user (full_name, email, phone_num, status, is_verified) VALUES (?, ?, ?, ?, ?)',
      [fullName, emailId, phoneNo, 1, verificationStatus]
    );
    console.log('[Register] Database insert result:', result);

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
    console.error('[Register] Error:', error);
    console.error('[Register] Stack trace:', error.stack);
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
    console.log('[Verify] Request received:', req.body);
    const { emailId, isVerified } = req.body;
    const verificationStatus = parseInt(isVerified, 10);
    
    console.log('[Verify] Parsed data:', {
      emailId,
      verificationStatus
    });

    if (!emailId || isVerified === undefined) {
      console.log('[Verify] Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide emailId and isVerified status'
      });
    }

    console.log('[Verify] Attempting to update verification status');
    const [result] = await db.execute(
      'UPDATE tbl_user SET is_verified = ? WHERE email = ?',
      [verificationStatus, emailId]
    );
    console.log('[Verify] Database update result:', result);

    if (result.affectedRows === 0) {
      console.log('[Verify] No user found with email:', emailId);
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
    console.error('[Verify] Error:', error);
    console.error('[Verify] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error updating verification status',
      error: error.message
    });
  }
});

// Profile endpoint
userRoute.get('/profile', async (req, res) => {
  try {
    console.log('[Profile] Request received:', req.query);
    const { emailId } = req.query;

    if (!emailId) {
      console.log('[Profile] Validation failed: Missing email');
      return res.status(400).json({
        success: false,
        message: 'Please provide emailId'
      });
    }

    console.log('[Profile] Fetching user profile for email:', emailId);
    const [users] = await db.execute(
      'SELECT full_name, email, phone_num FROM tbl_user WHERE email = ?',
      [emailId]
    );
    console.log('[Profile] Database query result:', users);

    if (users.length === 0) {
      console.log('[Profile] No user found with email:', emailId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    console.log('[Profile] Sending user profile data');
    res.json({
      success: true,
      data: {
        fullName: user.full_name,
        email: user.email,
        phoneNo: user.phone_num
      }
    });

  } catch (error) {
    console.error('[Profile] Error:', error);
    console.error('[Profile] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
});

export default userRoute;


