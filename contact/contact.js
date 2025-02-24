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




contactRoute.get("/", async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1; // Ensure integer value
        const pageSize = parseInt(req.query.pageSize, 10) || 10; // Ensure integer value
        const searchTerm = req.query.searchTerm?.trim() || ""; // Handle empty search terms

        // ✅ Validate `pageSize` and `offset`
        if (isNaN(page) || isNaN(pageSize) || page < 1 || pageSize < 1) {
            return res.status(400).json({ message: "Invalid pagination values" });
        }

        const offset = (page - 1) * pageSize;

        let query = `SELECT * FROM tbl_contact`;
        let countQuery = `SELECT COUNT(*) AS total FROM tbl_contact`;
        let params = [];
        let countParams = [];

        // Apply search filter (if provided)
        if (searchTerm !== "") {
            const searchCondition = ` WHERE FullName LIKE ? OR Email LIKE ? OR Message LIKE ?`;
            query += searchCondition;
            countQuery += searchCondition;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
            countParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
        }

        // ✅ Ensure `LIMIT` and `OFFSET` are always numbers
        query += ` ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`;
        params.push(Number(pageSize), Number(offset)); // Convert to numbers before passing

        // Fetch paginated data
        const [contacts] = await db.execute(query, params);

        // Get total count for pagination
        const [totalRows] = await db.execute(countQuery, countParams);
        const totalContacts = totalRows[0].total;

        res.status(200).json({
            data: contacts,
            pagination: {
                currentPage: page,
                pageSize,
                totalContacts,
                totalPages: Math.ceil(totalContacts / pageSize),
            },
        });
    } catch (error) {
        console.error("Error fetching contact data:", error);
        res.status(500).json({ message: "Server error." });
    }
});




contactRoute.delete("/:id", async (req, res) => {
    try {
        const contactId = req.params.id;
        const [contact] = await db.execute("SELECT * FROM tbl_contact WHERE ContactID =?", [contactId]);
        if (!contact) {
            return res.status(404).json({ message: "Contact not found." });
        }
        // Delete contact from database
        await db.execute("DELETE FROM tbl_contact WHERE ContactID = ?", [contactId]);
        res.status(200).json({ message: "Contact deleted successfully." });
        } catch (error) {
            console.error("Error deleting contact:", error);
            res.status(500).json({ message: "Server error." });
        }
        });

export default contactRoute