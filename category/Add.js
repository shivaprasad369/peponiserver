import express from "express";
import db from "../db/db.js";

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import upload from "../uploads.js";
const categoryRoute = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

categoryRoute.post("/", upload.single('Image'), async (req, res) => {
    const { CategoryName, Image  } = req.body;
    if(!CategoryName ){
        return res.status(400).json({ message: "name and image are required" });
    }
    const imagePath = req.file ? path.join("uploads", req.file.filename) : null;
try{
    console.log("File uploaded:", Image); 
        
    const [result] = await db.query(
        "INSERT INTO tbl_category (CategoryName, CatURL, Title, KeyWord, Description, Image, ParentCategoryID, SubCategoryLevel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          req.body.CategoryName, 
          req.body.CatURL || '',
          req.body.Title || '',
          req.body.KeyWord || '',
          req.body.Description || '',
          imagePath,
          req.body.ParentCategoryID || null, 
          req.body.SubCategoryLevel || 1     
        ]
      );
      if(result.affectedRows === 0){
        return res.status(400).json({ message: "Category not added" });
      }

    res.status(200).json({ message: "Category added successfully", result: result });
}catch(error){
    res.status(500).json({ message: "Internal server error", error: error });
    console.log(error);
}
});

categoryRoute.get("/", async (req, res) => {
    const [result] = await db.query(`SELECT CategoryID,Image, CategoryName,Status
         FROM tbl_category WHERE ParentCategoryID IS NULL`);
    if(result.length === 0){
        return res.status(400).json({ message: "No categories found" });
    }   
    res.status(200).json({ message: "Category fetched successfully", result: result });
});
categoryRoute.get("/pagination", async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1; // Default to page 1
        const pageSize = parseInt(req.query.pageSize, 10) || 10; // Default to 10 items per page
        const searchTerm = req.query.search ? `%${req.query.search}%` : null;

        const offset = pageSize;

        let query = `
            SELECT CategoryID, Image, CategoryName, Status 
            FROM tbl_category 
            WHERE ParentCategoryID IS NULL
        `;

        let queryParams = [];

        if (searchTerm) {
            query += ` AND CategoryName LIKE ? `;
            queryParams.push(searchTerm);
        }

        query += ` ORDER BY CategoryID DESC LIMIT ? OFFSET ?`;
        queryParams.push(pageSize, offset);

        const [categories] = await db.query(query, queryParams);

        // if (categories.length === 0) {
        //     return res.status(404).json({ message: "No categories found" });
        // }

        // Get total count for pagination
        let countQuery = `SELECT COUNT(CategoryID) AS total FROM tbl_category WHERE ParentCategoryID IS NULL`;
        let countParams = [];

        if (searchTerm) {
            countQuery += ` AND CategoryName LIKE ?`;
            countParams.push(searchTerm);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const totalCategories = countResult[0].total;
        const totalPages = Math.ceil(totalCategories / pageSize);

        res.status(200).json({
            message: "Categories fetched successfully",
            categories,
            totalCategories,
            totalPages,
            currentPage: page,
            pageSize
        });

    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

categoryRoute.get("/:id", async (req, res) => {
    const { id } =req.params;
    console.log(id)
    if(!id || isNaN(id)){
        return res.status(400).json({ message: "Category ID is required" });
    }
    try{
    const [result] = await db.query("SELECT * FROM tbl_category WHERE CategoryID = ?", [id]);
    if(result.length === 0){
        return res.status(400).json({ message: "No categories found" });
    }   
    res.status(200).json({ message: "Category fetched successfully", result: result });
}catch(error){
    res.status(500).json({ message: "Internal server error", error: error });
    console.log(error);
}
});

categoryRoute.delete("/:id", async (req, res) => {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(id)) {
        return res.status(400).json({ message: "Invalid Category ID" });
    }

    try {
        // Check if the category exists
        const [categoryResult] = await db.query("SELECT * FROM tbl_category WHERE CategoryID = ?", [id]);
        if (categoryResult.length === 0) {
            return res.status(404).json({ message: "Category not found" });
        }

        // Use recursive query to fetch all categories in the hierarchy
        const [categoriesToDelete] = await db.query(`
            WITH RECURSIVE CategoryTree AS (
                SELECT CategoryID, Image
                FROM tbl_category
                WHERE CategoryID = ?
                
                UNION ALL
                
                SELECT c.CategoryID, c.Image
                FROM tbl_category c
                INNER JOIN CategoryTree ct ON c.ParentCategoryID = ct.CategoryID
            )
            SELECT CategoryID, Image FROM CategoryTree;
        `, [id]);

        // Collect CategoryIDs and Images
        const categoryIDs = categoriesToDelete.map(row => row.CategoryID);
        const imagesToDelete = categoriesToDelete.map(row => row.Image).filter(Boolean); // Exclude null or undefined images

        // Delete images
        for (const imagePath of imagesToDelete) {
            const filePath = path.join(__dirname, "..", imagePath);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted image: ${filePath}`);
                } else {
                    console.log(`Image file not found, skipping: ${filePath}`);
                }
            } catch (fileError) {
                console.error(`Error deleting image file (${filePath}):`, fileError);
            }
        }

        // Perform the delete operation
        if (categoryIDs.length > 0) {
            const [deleteResult] = await db.query(`
                DELETE FROM tbl_category WHERE CategoryID IN (?);
            `, [categoryIDs]);

            if (deleteResult.affectedRows === 0) {
                return res.status(400).json({ message: "No categories were deleted." });
            }

            res.status(200).json({
                message: "Category and associated images deleted successfully",
                affectedRows: deleteResult.affectedRows,
                deletedImages: imagesToDelete.length,
            });
        } else {
            res.status(400).json({ message: "No categories to delete." });
        }
    } catch (error) {
        console.error("Error during category deletion:", error);
        res.status(500).json({ message: "Internal server error", error });
    }
});

// categoryRoute.delete("/:id", async (req, res) => {
//     const { id } = req.params;

//     if (!id || isNaN(id)) {
//         return res.status(400).json({ message: "Invalid Category ID" });
//     }

//     try {
//         // Check if the category exists
//         const [categoryResult] = await db.query("SELECT * FROM tbl_category WHERE CategoryID = ?", [id]);
//         if (categoryResult.length === 0) {
//             return res.status(404).json({ message: "Category not found" });
//         }

//         const category = categoryResult[0];

//         // Delete associated image if it exists
//         if (category.Image) {
//             const filePath = path.join(__dirname, "..", category.Image);
//             try {
//                 if (fs.existsSync(filePath)) {
//                     fs.unlinkSync(filePath);
//                 } else {
//                     console.log("Image file not found, skipping deletion.");
//                 }
//             } catch (fileError) {
//                 console.error("Error deleting image file:", fileError);
//                 return res.status(500).json({ message: "Failed to delete associated image", error: fileError });
//             }
//         }

//         // Use recursive query to fetch CategoryIDs
//         const [categoriesToDelete] = await db.query(`
//             WITH RECURSIVE CategoryTree AS (
//                 SELECT CategoryID
//                 FROM tbl_category
//                 WHERE CategoryID = ?
                
//                 UNION ALL
                
//                 SELECT c.CategoryID
//                 FROM tbl_category c
//                 INNER JOIN CategoryTree ct ON c.ParentCategoryID = ct.CategoryID
//             )
//             SELECT CategoryID FROM CategoryTree;
//         `, [id]);

//         const categoryIDs = categoriesToDelete.map(row => row.CategoryID);

//         // Perform the delete operation
//         if (categoryIDs.length > 0) {
//             const [deleteResult] = await db.query(`
//                 DELETE FROM tbl_category WHERE CategoryID IN (?);
//             `, [categoryIDs]);

//             if (deleteResult.affectedRows === 0) {
//                 return res.status(400).json({ message: "No categories were deleted." });
//             }

//             res.status(200).json({ message: "Category deleted successfully", affectedRows: deleteResult.affectedRows });
//         } else {
//             res.status(400).json({ message: "No categories to delete." });
//         }
//     } catch (error) {
//         console.error("Error during category deletion:", error);
//         res.status(500).json({ message: "Internal server error", error });
//     }
// });
export default categoryRoute;
