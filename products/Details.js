import express from "express";
import db from "../db/db.js";
const detailRoute = express.Router();

detailRoute.get("/:id", async (req, res) => {
    try {
        const productId =  Buffer.from(req.params.id, "base64").toString("utf-8");
            // console.log(productId)
        if (!productId) {
            return res.status(400).json({ error: "Product ID is required" });
        }

        const query = `
            SELECT 
                p.*, 
                pi.ProductImages, 
                av.value AS attribute_value, 
                a.attribute_name, 
                pa.ProductAttributeID as ProductAttributeID ,
                pr.rating, 
                pr.review_text, 
                pr.review_date, 
                pr.review_title 
            FROM tbl_products p 
            LEFT JOIN tbl_productimages pi ON pi.ProductID = p.ProductID
            LEFT JOIN tbl_productattribute pa ON pa.ProductID = p.ProductID
            LEFT JOIN attribute_values av ON pa.AttributeValueID = av.id
            LEFT JOIN attributes a ON a.id = av.attribute_id
            LEFT JOIN tbl_productreviews pr ON pr.product_id = p.ProductID
            WHERE p.ProductID = ?`;

        const [rows] = await db.query(query, [productId]);
        // console.log(rows)
        if (rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }


        // Organize product data
        const product = {
            ProductID: Buffer.from(rows[0].ProductID.toString()).toString('base64'),
            ProductName: rows[0].ProductName,
            subCat:rows[0].SubCategoryIDone,
            ProductAttributeID:rows[0].ProductAttributeID,
            Description: rows[0].Description,
            ProductPrice: rows[0].ProductPrice,
            Discount: rows[0].Discount,
            CashPrice: rows[0].CashPrice,
            Stock: rows[0].Stock,
            Status: rows[0].Status,
            Image: rows[0].Image,
            DiscountPercentage: rows[0].DiscountPercentage,
            DiscountPrice: rows[0].DiscountPrice,
            SellingPrice: rows[0].SellingPrice,
            ProductUrl: rows[0].ProductUrl,
            MetaTitle: rows[0].MetaTitle,
            MetaKeyWords: rows[0].MetaKeyWords,
            MetaDescription: rows[0].MetaDescription,
            ProductImages: [],
            Attributes: [],
            Reviews: []
        };

        rows.forEach((row) => {
            if (row.ProductImages && !product.ProductImages.includes(row.ProductImages)) {
                product.ProductImages.push(row.ProductImages);
            }
            if (row.attribute_name && row.attribute_value) {
                product.Attributes.push({
                    attribute_name: row.attribute_name,
                    value: row.attribute_value
                });
            }
            if (row.rating) {
                product.Reviews.push({
                    rating: row.rating,
                    review_title: row.review_title,
                    review_text: row.review_text,
                    review_date: row.review_date
                });
            }
        });
        

        res.status(200).json(product);
    } catch (error) {
        console.error("Error fetching product details:", error.message);
        res.status(500).json({ error: "Server error" });
    }
});
detailRoute.get('/related/:id',async(req,res)=>{
    try {
        const {id}=req.params;
        if(!id || isNaN(id)){
            return res.status(400).json({error: 'Product ID is required'})
        }
        const query=`
        SELECT p.ProductName, p.ProductID,p.ProductPrice,p.CashPrice, p.CategoryID,c.CategoryName, p.Image, p.SubCategoryIDone, 
                   av.value AS attributeValue, a.attribute_name AS AttributeName, 
                   a.id AS aid, av.id AS attributeValuesId
            FROM tbl_products p
            JOIN tbl_productattribute pa ON pa.ProductID = p.ProductID
            JOIN tbl_category c ON p.CategoryID=c.CategoryID
            JOIN attribute_values av ON av.id = pa.AttributeValueID
            JOIN attributes a ON av.attribute_id = a.id
            WHERE p.SubCategoryIDone = ?`
        
        const [data]= await db.query(query, [Number(id)])
        console.log(data)
        const filterData = data.reduce((acc, curr) => {
            // Check if the product already exists in the accumulator
            if (!acc[curr.ProductID]) {
                acc[curr.ProductID] = {
                    ProductID:Buffer.from(curr.ProductID.toString()).toString('base64') ,
                    ProductName: curr.ProductName,
                    CategoryName:curr.CategoryName,
                    Image: curr.Image,
                    ProductPrice: curr.ProductPrice,
                    CashPrice: curr.CashPrice,
                  
                    CategoryID:Buffer.from(curr.CategoryID.toString()).toString('base64'),
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
        res.status(500).send('no data found')
    }
})

export default detailRoute;
