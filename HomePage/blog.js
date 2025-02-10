import express from "express";
import db from "../db/db.js";
const blogsRoute = express.Router()


  
blogsRoute.get("/", async (req, res) => {
    try {
        const [result] = await db.query("SELECT id,title,shortdesc,description,image,author,created_at,Status,slug FROM blogs WHERE Status=1 ORDER BY id DESC ");
        if(result.length === 0){
            return res.status(404).json({ message: "No blogs found" });
        }
        res.status(200).json({ message: "Blog fetched successfully", result: result });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error });
    }
});
blogsRoute.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("SELECT * FROM blogs WHERE slug = ? AND Status=?", [id,1]);
        res.status(200).json({ message: "Blog fetched successfully", result: result });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error });
    }
});






export default blogsRoute;   