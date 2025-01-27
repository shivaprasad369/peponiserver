import express from "express";
import db from "../db/db.js";

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import upload from "../uploads.js";
const categoryUpdateRoute = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
categoryUpdateRoute.get('/get', async (req, res) => {
    const { id } = req.query;
    if(!id){
        return res.status(400).json({ message: "Invalid or missing Category ID" });
    }
    const [result] = await db.query(`SELECT CategoryID, CategoryName FROM tbl_category WHERE ParentCategoryID = ?`, [id]);
    res.status(200).json({ message: "Category fetched successfully", result: result });
});


categoryUpdateRoute.get('/get/:id', async (req, res) => {
    const { id } = req.params;
    if(!id){
        return res.status(400).json({ message: "Invalid or missing Category ID" });
    }
    const [result] = await db.query(`SELECT  * FROM tbl_category WHERE CategoryID = ?`, [id]);
    res.status(200).json({ message: "Category fetched successfully", result: result });
});


categoryUpdateRoute.get("/:id", async (req, res) => {
    const { id } = req.params;
    if(!id){
        return res.status(400).json({ message: "Invalid or missing Category ID" });
    }
    try{
        const [result] = await db.query(`SELECT 
            tbl_category.CategoryID, 
            tbl_category.Image, 
            tbl_category.CategoryName,
            p.CategoryName AS ParentCategoryName, 
            tbl_category.ParentCategoryID
            FROM tbl_category 
            LEFT JOIN tbl_category p ON tbl_category.ParentCategoryID = p.CategoryID

            WHERE tbl_category.SubCategoryLevel = ?`, [id]);
        if(result.length === 0){
            return res.status(400).json({ message: "Category not found" });
        }
        res.status(200).json({ message: "Category fetched successfully", result: result });
    }catch(error){
        res.status(500).json({ message: "Internal server error", error: error });
        console.log(error);
    }
});
categoryUpdateRoute.get("/categories/:id", async (req, res) => {
    const { id } = req.params;
    if(!id){
        return res.status(400).json({ message: "Invalid or missing Category ID" });
    }
    try{
        const [result] = await db.query(`SELECT
             c.CategoryID, 
             c.Image, 
             gp.CategoryName AS CategoryName,
             gp.CategoryID AS CategoryID,
             p.CategoryName AS SubCategory,
             p.CategoryID AS SubCategoryID,
             c.CategoryName AS SubCategoryLv2, 
             c.CategoryID AS SubCategoryLv2ID,
             c.ParentCategoryID
             FROM tbl_category c 
             LEFT JOIN tbl_category p ON c.ParentCategoryID = p.CategoryID
             LEFT JOIN tbl_category gp ON p.ParentCategoryID = gp.CategoryID
             WHERE c.SubCategoryLevel = ?;`, [id]);
        if(result.length === 0){
            return res.status(400).json({ message: "Category not found" });
        }
        res.status(200).json({ message: "Category fetched successfully", result: result });
    }catch(error){
        res.status(500).json({ message: "Internal server error", error: error });
        console.log(error);
    }
});

categoryUpdateRoute.put('/status/:id', async (req, res) => {
    const { id } = req.params;
    const { Status } = req.body;

    // Validate the input
    if (!id || isNaN(id)) {
        return res.status(400).send({ message: 'Invalid Id' }); // 400 for bad request
    }

    // Validate Status (if needed, for example 1 for active, 0 for inactive)
    if (Status === undefined || ![0, 1].includes(Status)) {
        return res.status(400).send({ message: 'Invalid Status value. Status must be 0 or 1.' });
    }

    try {
        // Update the category status
        const [result] = await db.query('UPDATE tbl_category SET Status = ? WHERE CategoryID = ?', [Status, id]);

        // Check if any rows were affected
        if (result.affectedRows > 0) {
            return res.status(200).send({ message: 'Category status updated successfully' });
        } else {
            return res.status(404).send({ message: 'Category not found or no changes made' });
        }
    } catch (error) {
        console.error('Error updating category status:', error);
        return res.status(500).send({ message: 'Internal server error' }); // 500 for server error
    }
});

categoryUpdateRoute.put("/:id", upload.single("NewImage"), async (req, res) => {
    const { id } = req.params;
    const { CategoryName, Image } = req.body;
    const newImage = req.file;

    // Validate required fields
    if (!id || isNaN(id)) {
        return res.status(400).json({ message: "Invalid or missing Category ID" });
    }
    if (!CategoryName) {
        return res.status(400).json({ message: "Category Name is required" });
    }

    try {
        const [existingCategory] = await db.query("SELECT * FROM tbl_category WHERE CategoryID = ?", [id]);
        if (existingCategory.length === 0) {
            return res.status(404).json({ message: "Category not found" });
        }
        let updatedImagePath = Image; 
        if (newImage) {
            const existingImagePath = path.join(__dirname, "..", existingCategory[0].Image);
            if (fs.existsSync(existingImagePath)) {
                fs.unlinkSync(existingImagePath);
                console.log("Existing image deleted successfully");
            }
            updatedImagePath = path.join("uploads", newImage.filename);
        }
        const [updateResult] = await db.query(
            "UPDATE tbl_category SET CategoryName = ?, Image = ? WHERE CategoryID = ?",
            [CategoryName, updatedImagePath, id]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(400).json({ message: "Category not updated" });
        }
        res.status(200).json({
            message: "Category updated successfully",
            updatedCategory: { CategoryID: id, CategoryName, Image: updatedImagePath },
        });
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ message: "Internal server error", error });
    }
});

export default categoryUpdateRoute;