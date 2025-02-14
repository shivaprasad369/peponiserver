import express from "express";
import db from "../db/db.js";
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});




const contactRoute = express.Router();


contactRoute.post("/", async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // Insert data into MySQL
        const [newContact] = await db.execute(
            "INSERT INTO tbl_contact (FullName, Email, Message) VALUES (?, ?, ?)",
            [name, email, message]
        );

        if (newContact.affectedRows > 0) {
            // Send email confirmation
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: "New Contact Form Submission",
                text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
            };
           

            // User Greeting Email
            const userMailOptions = {
                from: process.env.EMAIL_USER,
                to: email, // Send to User
                subject: "Thank You for Contacting Us!",
                text: `Dear ${name},\n\nThank you for reaching out to us! We have received your message and will get back to you soon.\n\nBest Regards,\nPeponi Gallery`,
            };

            await Promise.all([
                transporter.sendMail(mailOptions), 
                transporter.sendMail(userMailOptions)
            ]);

            return res.status(200).json({ message: "Contact form submitted successfully." });
        } else {
            return res.status(500).json({ message: "Failed to submit contact form." });
        }
    } catch (error) {
        console.error("Error submitting contact form:", error);
        res.status(500).json({ message: "Server error." });
    }
});

export default contactRoute