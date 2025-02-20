import express from 'express';

import db from '../db/db.js';
const userRoute = express.Router();

// Registration endpoint
userRoute.post('/register', async (req, res) => {
  try {
    const { fullName, emailId, phoneNo, isVerified } = req.body;
    const verificationStatus = isVerified ? parseInt(isVerified, 10) : 0;

    if (!fullName || !emailId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fullName and emailId'
      });
    }

    const [existingUser] = await db.execute(
      'SELECT email FROM tbl_user WHERE email = ?',
      [emailId]
    );

    if (existingUser.length > 0) {
      return res.status(201).json({
        success: true,
        message: 'User registered successfully'
      });
    }

    const [result] = await db.execute(
      'INSERT INTO tbl_user (full_name, email, phone_num, status, is_verified) VALUES (?, ?, ?, ?, ?)',
      [fullName, emailId, phoneNo, 1, verificationStatus]
    );

    if (result.affectedRows === 1) {
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
    const verificationStatus = parseInt(isVerified, 10);

    if (!emailId || isVerified === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide emailId and isVerified status'
      });
    }

    const [result] = await db.execute(
      'UPDATE tbl_user SET is_verified = ? WHERE email = ?',
      [verificationStatus, emailId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User verification status updated successfully'
    });

  } catch (error) {
    console.error('[Verify] Error:', error);
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
    const { emailId } = req.query;

    if (!emailId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide emailId'
      });
    }

    const [users] = await db.execute(
      'SELECT full_name, email, phone_num FROM tbl_user WHERE email = ?',
      [emailId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
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
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
});

// Update Profile endpoint
userRoute.post('/profile', async (req, res) => {
  try {
    const { emailId, fullName, phoneNo } = req.body;

    if (!emailId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide emailId'
      });
    }

    let updateFields = [];
    let updateValues = [];

    if (fullName) {
      updateFields.push('full_name = ?');
      updateValues.push(fullName);
    }

    if (phoneNo) {
      updateFields.push('phone_num = ?');
      updateValues.push(phoneNo);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided for update'
      });
    }

    updateValues.push(emailId);
    const updateQuery = `UPDATE tbl_user SET ${updateFields.join(', ')} WHERE email = ?`;

    const [result] = await db.execute(updateQuery, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('[Update Profile] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

export default userRoute;


