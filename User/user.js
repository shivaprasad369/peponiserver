import express from 'express';

import db from '../db/db.js';
import upload from '../uploads.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const userRoute = express.Router();
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
      'SELECT full_name, email, phone_num,image_url FROM tbl_user WHERE email = ?',
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
        phoneNo: user.phone_num,
        imageUrl: user.image_url
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
userRoute.post('/profile', upload.single('profilePicture'), async (req, res) => {
  try {
      const { emailId, fullName, phoneNo } = req.body;
      if (!emailId) {
          return res.status(400).json({ success: false, message: 'Please provide emailId' });
      }

      // Fetch existing profile
      const [existingProfile] = await db.query('SELECT * FROM tbl_user WHERE email = ?', [emailId]);
      if (existingProfile.length === 0) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }

      const updates = [];
      const values = [];

      if (fullName) {
          updates.push('full_name = ?');
          values.push(fullName);
      }

      if (phoneNo) {
          updates.push('phone_num = ?');
          values.push(phoneNo);
      }

      // Handle profile picture update
      let newImage = existingProfile[0].image_url || "";

if (req.file) {
    const oldImagePath = existingProfile[0].image_url ? path.join(__dirname, '..', existingProfile[0].image_url) : null;

    if (oldImagePath && fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath); // Delete old image
    }

    newImage = path.join("uploads", req.file.filename); // Corrected path format
    updates.push('image_url = ?');
    values.push(newImage);
}


      // If no fields are updated
      if (updates.length === 0) {
          return res.status(400).json({ success: false, message: 'No fields provided for update' });
      }

      values.push(emailId);
      const updateQuery = `UPDATE tbl_user SET ${updates.join(', ')} WHERE email = ?`;
      const [result] = await db.execute(updateQuery, values);

      if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: 'Failed to update profile' });
      }

      res.json({ success: true, message: 'Profile updated successfully', imageUrl: newImage });

  } catch (error) {
      console.error('[Update Profile] Error:', error);
      res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
  }
});

userRoute.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // ✅ Ensure `page` is a number
    const limit = parseInt(req.query.limit) || 10; // ✅ Ensure `limit` is a number
    const offset = (page - 1) * limit;
    const tab=req.query.tab || 1

    // ✅ Fetch total user count
    const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) AS totalUsers FROM tbl_user where is_verified=? AND status=?',[
      tab==='1'? 1:0, // tab 1 shows verified users
      tab==='2'? 0:1 // tab 2 shows unverified users
    ]);

    // ✅ Fetch paginated users
    const [users] = await db.query('SELECT * FROM tbl_user where is_verified=? AND status=? LIMIT ? OFFSET ?', [tab==='1'? 1:0, // tab 1 shows verified users
      tab==='2'? 0:1,limit, offset]);

    res.json({
      success: true,
      data: users,
      pagination: {
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
        limit,
      },
    });

  } catch (error) {
    console.error('[Get Users] Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching users', error: error.message });
  }
});

userRoute.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid user ID' });
    }
    const [user] = await db.query('SELECT * FROM tbl_user WHERE id =?', [userId]);
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const [result] = await db.execute('DELETE FROM tbl_user WHERE id =?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Failed to delete user' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('[Delete User] Error:', error);
    res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
  
  }
})


export default userRoute;


