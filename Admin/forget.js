import express from 'express';
import db from '../db/db.js';
import crypto from 'crypto';  // For generating secure tokens
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const forgetRoute = express.Router();

// Function to find the user by email (outside of route handler)
async function findUserByEmail(email) {
  const query = 'SELECT * FROM admins WHERE email = ?';
  const result = await db.query(query, [email]);

  return result[0];  // Assuming the result is an array of users
}

// Function to update the reset token (outside of route handler)
async function updateResetToken(userId, resetToken, resetTokenExpires) {
  const query = `
    UPDATE admins 
    SET resetToken = ?, resetTokenExpires = ?
    WHERE id = ?
  `;
  await db.query(query, [resetToken, resetTokenExpires, userId]);
}
async function findUserByResetToken(token) {
    const query = 'SELECT * FROM admins WHERE resetToken = ?';
    const result = await db.query(query, [token]);
    return result[0]; // Assuming you're returning the user object
  }
async function updateUserPassword(userId, PasswordHash, Salt) {
    const query = 'UPDATE admins SET PasswordHash = ?, Salt = ? WHERE id = ?';
    await db.query(query, [PasswordHash, Salt, userId]);
  }
  
 async function invalidateResetToken(userId) {
    const query = 'UPDATE admins SET resetToken = NULL, resetTokenExpires = NULL WHERE id = ?';
    await db.query(query, [userId]);
  }
  
forgetRoute.post('/', async (req, res) => {
  const { email } = req.body;

  // Check if email is provided
  if (!email) {
    return res.status(400).send({ message: 'Invalid email address.' });
  }

  try {
    // Check if the email exists in the database
    const user = await findUserByEmail(email);
    console.log(user)
    if (!user.length>0) {
      return res.status(404).send({ message: 'Email not found.' });
    }

    // Check if user already has an active reset token
    if (user.resetToken && user.resetTokenExpires > Date.now()) {
      return res.status(400).send({ message: 'A password reset link is already active.' });
    }
    
    // Generate a secure password reset token and expiration date
    const resetToken = generateResetToken();
    const resetTokenExpires = Date.now() + 3600000;  // Token expires in 1 hour (3600000 ms)

    // Store the reset token and expiration time in the database
    await updateResetToken(user[0].id, resetToken, resetTokenExpires);
      
    // Construct the reset link
    const resetLink = `http://peponiadmin.vercel.app/reset-password?token=${resetToken}`;

    // Send the reset link via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `Click the following link to reset your password: ${resetLink}`,
    };

    await transporter.sendMail(mailOptions);

    // Respond with a success message
    res.status(200).send({ message: 'Password reset link sent to your email.' });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send({ message: 'An error occurred while sending the email.' });
  }
});


function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');  // 32 bytes generates a 64-character token
}

 
forgetRoute.post('/reset', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).send({ message: 'Token and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).send({ message: 'Password must be at least 6 characters long.' });
    }
  
    try {
      const user = await findUserByResetToken(token);
      
      if (!user.length>0) {
          console.log(user)
        return res.status(400).send({ message: 'Invalid or expired token.' });
      }
      if (user.resetTokenExpires < Date.now()) {
        return res.status(400).send({ message: 'Token has expired. Please request a new password reset.' });
      }
      const salt = bcrypt.genSaltSync(10); 
      const PasswordHash = bcrypt.hashSync(newPassword, salt); 
      await updateUserPassword(user[0].id, PasswordHash, salt);
      await invalidateResetToken(user[0].id);
      res.status(200).send({ message: 'Password has been reset successfully.' });
  
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).send({ message: 'An error occurred while resetting the password.' });
    }
  });
  

export default forgetRoute;
