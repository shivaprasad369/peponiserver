import express from "express";
import db from "../db/db.js";
 
const homeRoute = express.Router();

homeRoute.get("/", async (req, res) => {
    try {
        const {head}=req.query;   
        if (!head) {
            return res.status(400).json({ error: "Header is required" });
        }
        const data = await db.query("SELECT content FROM cms where header=?",[head]);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
homeRoute.get('/collection', async (req, res) => {
    try {
        const { collection } = req.query;
        if (!collection) {
            return res.status(400).json({ error: "Collection is required" });
        }

        const [data] = await db.query(`
           SELECT p.ProductName,f.name, p.ProductID,p.ProductPrice,p.CashPrice, p.CategoryID,c.CategoryName, p.Image, p.SubCategoryIDone, 
                   av.value AS attributeValue, a.attribute_name AS AttributeName, 
                   a.id AS aid, av.id AS attributeValuesId
            FROM tbl_featureproducts f
            JOIN tbl_products p ON f.ProductID = p.ProductID
            JOIN tbl_productattribute pa ON pa.ProductID = f.ProductID
            JOIN tbl_category c ON p.CategoryID=c.CategoryID
            JOIN attribute_values av ON av.id = pa.AttributeValueID
            JOIN attributes a ON av.attribute_id = a.id
            WHERE f.name = ?`, [collection]);

        // Transform data into the correct format
        const filterData = data.reduce((acc, curr) => {
            // Check if the product already exists in the accumulator
            if (!acc[curr.ProductID]) {
                acc[curr.ProductID] = {
                    ProductID: curr.ProductID,
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
        console.error("Error fetching collection:", error);
        res.status(500).json({ error: error.message });
    }
});
homeRoute.get("/blogs", async (req, res) => {
    try {
        const [result] = await db.query("SELECT id,title,shortdesc,description,image,author,created_at,Status FROM blogs ORDER BY id DESC LIMIT 4");
        if(result.length === 0){
            return res.status(404).json({ message: "No blogs found" });
        }
        res.status(200).json({ message: "Blog fetched successfully", result: result });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error });
    }
});
homeRoute.get('/faq', async (req, res) => {
    try {
        const [result] = await db.query('SELECT id, question, answer FROM faqs ORDER BY id DESC');
        if(result.length === 0){
            return res.status(400).json({message:"FAQ failed"});
        }
        res.status(200).json({message:"FAQ success",result:result});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
  });
homeRoute.post("/newletter", async (req, res) => {
    const { email } = req.body;
    if(!email){
      return res.status(400).json({ message: "Email is required" });
    }
    try {
      const [result] = await db.query("SELECT * FROM subscribers WHERE email = ?", [email]);
      if(result.length > 0){
        return res.status(400).json({ message: "Email already exists" });
      }
      const [result1] = await db.query("INSERT INTO subscribers (email) VALUES (?)", [email]);
      res.status(200).json({ message: "Newsletter subscribed successfully",result:result1 });
    } catch (error) {
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });

export default homeRoute;
