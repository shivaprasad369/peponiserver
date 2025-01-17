import express from "express";
import db from "../db/db.js";
import upload from '../uploads.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const blogRoute = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
blogRoute.get("/", async (req, res) => {
    try {
        const [result] = await db.query("SELECT id,title,shortdesc,description,image,author FROM blogs");
        if(result.length === 0){
            return res.status(404).json({ message: "No blogs found" });
        }
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
    try {
        const image = req.file ? path.join("uploads", req.file.filename) : null;
       
        const [result] = await db.query("INSERT INTO blogs (title, description, shortdesc, image,author) VALUES (?, ?, ?, ?, ?)", 
            [title, description, shortdesc, image,author]);
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
            "UPDATE blogs SET title = ?, description = ?, shortdesc = ?, image = ?, author = ? WHERE id = ?", 
            [title, description, shortdesc, newImage, author, id]
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
export default blogRoute;   