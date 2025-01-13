import express from "express";
import db from "../db/db.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import upload from "../uploads.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productImageRoute = express.Router();
productImageRoute.delete('/:ProductImageID', async (req, res) => {
    try {
        const { ProductImageID } = req.params;
        const { ProductImage } = req.body; // Ensure req.body contains ProductImages as a string
        console.log(req.body);
        console.log("ProductImages received:", ProductImage);

        if (!ProductImageID || isNaN(ProductImageID)) {
            return res.status(400).json({ message: "Invalid ProductImageID" });
        }

        if (!ProductImage || typeof ProductImage !== "string") {
            return res.status(400).json({ message: "Product image path is required and must be a string" });
        }

        // Normalize and join the path
        const oldImagePath = path.join(__dirname, '..', ProductImage.replace(/\\/g, '/'));
        console.log("Full path of old image:", oldImagePath);

        if (fs.existsSync(oldImagePath)) {
            try {
                fs.unlinkSync(oldImagePath);
                console.log("Old image deleted successfully");
            } catch (err) {
                console.error("Error deleting old image:", err);
                return res.status(500).json({ message: "Failed to delete the image file", error: err });
            }
        } else {
            console.log("Image file does not exist:", oldImagePath);
        }

        // Delete the database record
        const deleteQuery = 'DELETE FROM tbl_productimages WHERE ProductImagesID = ?';
        const [deleteResult] = await db.query(deleteQuery, [ProductImageID]);

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: "Product image not found for the given ProductImageID" });
        }

        res.status(200).json({ message: "Product image deleted successfully" });
    } catch (error) {
        console.error("Error in product image deletion:", error);
        res.status(500).json({ message: "Internal server error", error });
    }
});


export default productImageRoute