import express from "express";
import db from "../db/db.js";
import upload from '../uploads.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import slugify from "slugify";
const blogRoute = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateUniqueSlug(title) {
    let slug = slugify(title, { lower: true, strict: true });
  
    let [existing] = await db.query("SELECT COUNT(*) AS count FROM blogs WHERE slug = ?", [slug]);
  
    let count = existing[0].count;
    while (count > 0) {
      slug = `${slug}-${count}`;
      [existing] = await db.query("SELECT COUNT(*) AS count FROM blogs WHERE slug = ?", [slug]);
      count = existing[0].count;
    }
  
    return slug;
  }
blogRoute.get("/", async (req, res) => {
    try {
        const [result] = await db.query("SELECT id,title,shortdesc,description,image,author,created_at,Status FROM blogs ORDER BY id DESC");
        if(result.length === 0){
            return res.status(404).json({ message: "No blogs found" });
        }
        res.status(200).json({ message: "Blog fetched successfully", result: result });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error });
    }
});
blogRoute.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("SELECT * FROM blogs WHERE id = ?", [id]);
        res.status(200).json({ message: "Blog fetched successfully", result: result });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error });
    }
});
blogRoute.post("/", upload.single('Image'), async (req, res) => {
    const { title, description, shortdesc ,author} = req.body;

    if(!title || !description || !shortdesc){
        return res.status(400).json({ message: "Title, description and shortdesc are required" });
    }
    const slug = await generateUniqueSlug(title);

    try {
        const image = req.file ? path.join("uploads", req.file.filename) : null;
       
        const [result] = await db.query("INSERT INTO blogs (title, description, shortdesc, image,author,slug) VALUES (?, ?, ?, ?, ?,?)", 
            [title, description, shortdesc, image,author,slug]);
        if(result.affectedRows === 0){
            return res.status(400).json({ message: "Blog not added" });
        }
        res.status(200).json({ message: "Blog added successfully", result: result });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error });
    }
});

blogRoute.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try { 
        const [result1] = await db.query("SELECT * FROM blogs WHERE id = ?", [id]);
        
        if (result1.length === 0) {
            return res.status(404).json({ message: "Blog not found" });
        }
        const filePath = path.join(__dirname, '..', result1[0].image);
     
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
           
        } else {
            console.log("Image not found, skipping deletion");
        }
        const [result] = await db.query("DELETE FROM blogs WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Blog not found" });
        }
        
        res.status(200).json({ message: "Blog deleted successfully" });
    } catch (error) {
        console.error("Error during blog deletion: ", error);
        res.status(500).json({ message: "Internal server error", error: error });
    }
});
blogRoute.put("/:id", upload.single('Image'), async (req, res) => {
    const { id } = req.params;
    const { title, description, shortdesc, author } = req.body;

 const slug = await generateUniqueSlug(title);
    if (!title || !description || !shortdesc) {
        return res.status(400).json({ message: "Title, description and shortdesc are required" });
    }

    try {
        const [existingBlog] = await db.query("SELECT * FROM blogs WHERE id = ?", [id]);
        
        if (existingBlog.length === 0) {
            return res.status(404).json({ message: "Blog not found" });
        }

        let newImage = existingBlog[0].image;

        if (req.file) {
            // Delete old image if it exists
            if (existingBlog[0].image) {
                const filePath = path.join(__dirname, '..', existingBlog[0].image);      
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            // Set new image path
            newImage = path.join("uploads", req.file.filename);
        }

        const [result] = await db.query(
            "UPDATE blogs SET title = ?, description = ?, shortdesc = ?, image = ?, author = ?,slug=? WHERE id = ?", 
            [title, description, shortdesc, newImage, author,slug, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Failed to update blog" });
        }

        res.status(200).json({ message: "Blog updated successfully" });
    } catch (error) {
        console.error("Error updating blog:", error);
        res.status(500).json({ message: "Internal server error", error: error });
    }
});
blogRoute.put('/status/:id', async (req, res) => {
    const { id } = req.params;
    const { Status } = req.body;

    // Validate the 'id' parameter (should be a valid number)
    if (!id || isNaN(id)) {
        return res.status(400).send({ message: 'Invalid ID' }); // 400 Bad Request for invalid ID
    }

    // Validate the 'Status' field (optional: could be a specific set of values like 0, 1)
    if (Status === undefined || ![0, 1].includes(Status)) {
        return res.status(400).send({ message: 'Invalid Status value. Status must be 0 or 1.' });
    }

    try {
        // Update the status in the database
        const [result] = await db.query('UPDATE blogs SET Status = ? WHERE id = ?', [Status, id]);

        // Check if any rows were updated
        if (result.affectedRows > 0) {
            return res.status(200).send({ message: 'Blog status updated successfully' });
        } else {
            return res.status(404).send({ message: 'Blog not found or no changes made' });
        }
    } catch (error) {
        console.error('Error updating blog status:', error);
        return res.status(500).send({ message: 'Internal server error' }); // 500 for server error
    }
});

export default blogRoute;   