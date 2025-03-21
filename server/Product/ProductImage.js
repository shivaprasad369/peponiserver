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
        // console.log(req.body);
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

productImageRoute.get("/:ProductID", async (req, res) => {
    const { ProductID } = req.params;
    if(!ProductID || isNaN(ProductID)){
        return res.status(400).json({message:"ProductID is required"});
    }
    const query = `
        SELECT 
            p.ProductName, p.ProductID, p.MetaTitle, p.metaDescription, p.MetaKeyWords, 
            p.ProductPrice, p.DiscountPercentage, p.DiscountPrice, p.SellingPrice, 
            p.CashPrice, p.CategoryID, p.SubCategoryIDone, p.SubCategoryIDtwo, 
            p.Description, p.Image, p.Stock,
            c.CategoryName, 
            st.ProductImages, st.ProductImagesID, 
            a.attribute_name, pa.AttributeValueID, av.value 
        FROM tbl_products p
        LEFT JOIN tbl_productattribute pa ON p.ProductID = pa.ProductID
        LEFT JOIN attribute_values av ON pa.AttributeValueID = av.id
        LEFT JOIN attributes a ON av.attribute_id = a.id
        LEFT JOIN tbl_category c ON p.CategoryID = c.CategoryID
        LEFT JOIN tbl_productimages st ON st.ProductID = p.ProductID
        WHERE p.ProductID = ?`;

    try {
        const [result] = await db.query(query, [ProductID]);

        if (result.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        const formattedData = {
            ProductName: result[0].ProductName,
            ProductID: result[0].ProductID,
            MetaTitle: result[0].MetaTitle,
            metaDescription: result[0].metaDescription,
            Stock:result[0].Stock,
            MetaKeyWords: result[0].MetaKeyWords,
            ProductPrice: result[0].ProductPrice,
            DiscountPercentage: result[0].DiscountPercentage,
            DiscountPrice: result[0].DiscountPrice,
            SellingPrice: result[0].SellingPrice,
            CashPrice: result[0].CashPrice,
            CategoryID: result[0].CategoryID,
            SubCategoryIDone: result[0].SubCategoryIDone,
            SubCategoryIDtwo: result[0].SubCategoryIDtwo,
            Description: result[0].Description,
            Image: result[0].Image,
            CategoryName: result[0].CategoryName,
            ProductImages: result.filter(item => item.ProductImagesID).map(item => ({
                ImageID: item.ProductImagesID,
                ImageURL: item.ProductImages
            })).filter((value, index, self) =>
                index === self.findIndex((t) => (
                    t.ImageID === value.ImageID
                ))),
            Attributes: result.map(item => ({
                AttributeID: item.AttributeValueID,
                AttributeName: item.attribute_name,
                Value: item.value
            })) .filter((value, index, self) =>
                index === self.findIndex((t) => (
                    t.AttributeID === value.AttributeID
                ))),
        };

        res.status(200).json(formattedData);
    } catch (error) {
        console.error("Error fetching product data:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


export default productImageRoute