import express from 'express';

import db from '../db/db.js';
import upload from '../uploads.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { auth, dbs } from '../firebase/firebase.js';
import { getAuth } from 'firebase-admin/auth';

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


router.get("/firebase/email/:email", async (req, res) => {
  try {
    const userRecord = await auth.getUserByEmail(req.params.email);
    res.status(200).json({ user: userRecord });
  } catch (error) {
    console.error("Error fetching user:", error.message);
    res.status(404).json({ error: "User not found" });
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
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 records per page
    const offset = (page - 1) * limit;
    const tab = req.query.tab ? parseInt(req.query.tab) : 1; // Default to 1 (active users)

    let isVerified, status;

    if (tab === 0) {
      // Not verified users
      isVerified = 0;
      status = 1;
    } else if (tab === 1) {
      // Active verified users
      isVerified = 1;
      status = 1;
    } else if (tab === 2) {
      // Blocked users
      isVerified = 1;
      status = 0;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid tab value' });
    }

    // ✅ Fetch total user count
    const [[{ totalUsers }]] = await db.query(
      'SELECT COUNT(*) AS totalUsers FROM tbl_user WHERE is_verified = ? AND status = ?',
      [isVerified, status]
    );

    // ✅ Fetch paginated users
    const [users] = await db.query(
      'SELECT * FROM tbl_user WHERE is_verified = ? AND status = ? LIMIT ? OFFSET ?',
      [isVerified, status, limit, offset]
    );

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
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message,
    });
  }
});

// userRoute.delete('/:id', async (req, res) => {
//   try {
//     const userId = parseInt(req.params.id);
//     if (!userId) {
//       return res.status(400).json({ success: false, message: 'Please provide a valid user ID' });
//     }
//     const [user] = await db.query('SELECT * FROM tbl_user WHERE id =?', [userId]);
//     if (user.length === 0) {
//       return res.status(404).json({ success: false, message: 'User not found' });
//     }

//     const [result] = await db.execute('DELETE FROM tbl_user WHERE id =?', [userId]);
//     if (result.affectedRows === 0) {
//       return res.status(400).json({ success: false, message: 'Failed to delete user' });
//     }
//     res.json({ success: true, message: 'User deleted successfully' });
    
//   } catch (error) {
//     console.error('[Delete User] Error:', error);
//     res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
  
//   }
// })

userRoute.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid user ID' });
    }

    // Fetch user from MySQL database
    const [user] = await db.query('SELECT * FROM tbl_user WHERE id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userEmail = user[0].email; // Make sure your MySQL table has an email field

    if (userEmail) {
      try {
        const userRecord = await auth.getUserByEmail(userEmail);
        await auth.deleteUser(userRecord.uid);
        console.log(`User with UID ${userRecord.uid} deleted from Firebase.`);
      } catch (firebaseError) {
        console.error(`Failed to delete user from Firebase: ${firebaseError.message}`);
        return res.status(500).json({ success: false, message: 'Error deleting user from Firebase', error: firebaseError.message });
      }
    }

    // Delete from MySQL
    const [result] = await db.execute('DELETE FROM tbl_user WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Failed to delete user from MySQL' });
    }

    res.json({ success: true, message: 'User deleted successfully from MySQL and Firebase' });

  } catch (error) {
    console.error('[Delete User] Error:', error);
    res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
  }
});


userRoute.put('/disable/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid user ID' });
    }

    // Fetch user from MySQL
    const [user] = await db.query('SELECT * FROM tbl_user WHERE id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userEmail = user[0].email; 

    if (userEmail) {
      try {
        const userRecord = await auth.getUserByEmail(userEmail);
        await auth.updateUser(userRecord.uid, { disabled: true });
        console.log(`User with UID ${userRecord.uid} has been disabled in Firebase.`);
      } catch (firebaseError) {
        console.error(`Failed to disable user in Firebase: ${firebaseError.message}`);
        return res.status(500).json({ success: false, message: 'Error disabling user in Firebase', error: firebaseError.message });
      }
    }

    // Update status in MySQL
    const [result] = await db.execute('UPDATE tbl_user SET status = 0 WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Failed to disable user in MySQL' });
    }

    res.json({ success: true, message: 'User disabled successfully in MySQL and Firebase' });

  } catch (error) {
    console.error('[Disable User] Error:', error);
    res.status(500).json({ success: false, message: 'Error disabling user', error: error.message });
  }
});

userRoute.put('/enable/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid user ID' });
    }

    // Fetch user from MySQL
    const [user] = await db.query('SELECT * FROM tbl_user WHERE id = ?', [userId]);
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userEmail = user[0].email;

    if (userEmail) {
      try {
        const userRecord = await auth.getUserByEmail(userEmail);
        await auth.updateUser(userRecord.uid, { disabled: false });
        console.log(`User with UID ${userRecord.uid} has been enabled in Firebase.`);
      } catch (firebaseError) {
        console.error(`Failed to enable user in Firebase: ${firebaseError.message}`);
        return res.status(500).json({ success: false, message: 'Error enabling user in Firebase', error: firebaseError.message });
      }
    }

    // Update status in MySQL
    const [result] = await db.execute('UPDATE tbl_user SET status = 1 WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Failed to enable user in MySQL' });
    }

    res.json({ success: true, message: 'User enabled successfully in MySQL and Firebase' });

  } catch (error) {
    console.error('[Enable User] Error:', error);
    res.status(500).json({ success: false, message: 'Error enabling user', error: error.message });
  }
});



export default userRoute;


