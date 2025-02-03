import express from "express";
import db from "../db/db.js";
 
const productsRoute = express.Router();
productsRoute.get('/collection', async (req, res) => {
    try {
        const { categoryName } = req.query;
        if (!categoryName) {
            return res.status(400).json({ error: "Category name required is required" });
        }
        let name=decodeURIComponent(categoryName)
       
        const [data] = await db.query(`
            SELECT c.CategoryName,p.ProductID,p.CategoryID,p.SubCategoryIDone,p.ProductName,p.ProductPrice,
            p.ProductPrice,p.CashPrice,p.Image, a.id as aid , av.id as attributeValuesId,
            av.value as attributeValue,a.attribute_name as AttributeName from tbl_category c
            JOIN tbl_products p ON p.CategoryID = c.CategoryID

            JOIN tbl_productattribute pa ON pa.ProductID=p.ProductID
            JOIN attribute_values av on av.id=pa.AttributeValueID
            JOIN attributes a ON a.id =av.attribute_id
            WHERE c.CategoryName= ?`, [name]);

        // Transform data into the correct format
        const filterData = data.reduce((acc, curr) => {
            // Check if the product already exists in the accumulator
            if (!acc[curr.ProductID]) {
                acc[curr.ProductID] = {
                    ProductID: curr.ProductID,
                    ProductName: curr.ProductName,
                    Image: curr.Image,
                    ProductPrice: curr.ProductPrice,
                    CashPrice: curr.CashPrice,
                  
                    CategoryID: Buffer.from(curr.CategoryID.toString()).toString('base64'),
                    SubCategoryIDone: curr.SubCategoryIDone,
                    attributeValues: []
                };
            }

            // Push attribute details into attributeValues array
            acc[curr.ProductID].attributeValues.push({
                AttributeName: curr.AttributeName,
                attributeValue: curr.attributeValue,
                aid: curr.aid,
                attributeValuesId: curr.attributeValuesId
            });

            return acc;
        }, {});

        // Convert object to an array and send response
        res.status(200).json(Object.values(filterData));

    } catch (error) {
        console.error("Error fetching collection:", error);
        res.status(500).json({ error: error.message });
    }
});
productsRoute.get('/all-collection', async (req, res) => {
    try {
        const { categoryName } = req.query;
        if (!categoryName) {
            return res.status(400).json({ error: "Category name required is required" });
        }
        let name=decodeURIComponent(categoryName)
       
        const [data] = await db.query(`
            SELECT c.CategoryName,p.ProductID,p.CategoryID,p.SubCategoryIDone,p.ProductName,p.ProductPrice,
            p.ProductPrice,p.CashPrice,p.Image, a.id as aid , av.id as attributeValuesId,
            av.value as attributeValue,a.attribute_name as AttributeName from tbl_category c
            JOIN tbl_products p ON p.CategoryID = c.CategoryID

            JOIN tbl_productattribute pa ON pa.ProductID=p.ProductID
            JOIN attribute_values av on av.id=pa.AttributeValueID
            JOIN attributes a ON a.id =av.attribute_id`
            );

        // Transform data into the correct format
        const filterData = data.reduce((acc, curr) => {
            // Check if the product already exists in the accumulator
            if (!acc[curr.ProductID]) {
                acc[curr.ProductID] = {
                    ProductID: curr.ProductID,
                    ProductName: curr.ProductName,
                    Image: curr.Image,
                    ProductPrice: curr.ProductPrice,
                    CashPrice: curr.CashPrice,
                  
                    CategoryID: Buffer.from(curr.CategoryID.toString()).toString('base64'),
                    SubCategoryIDone: curr.SubCategoryIDone,
                    attributeValues: []
                };
            }

            // Push attribute details into attributeValues array
            acc[curr.ProductID].attributeValues.push({
                AttributeName: curr.AttributeName,
                attributeValue: curr.attributeValue,
                aid: curr.aid,
                attributeValuesId: curr.attributeValuesId
            });

            return acc;
        }, {});

        // Convert object to an array and send response
        res.status(200).json(Object.values(filterData));

    } catch (error) {
        console.error("Error fetching collection:", error);
        res.status(500).json({ error: error.message });
    }
});
export default productsRoute