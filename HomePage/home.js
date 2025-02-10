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
                    ProductID:Buffer.from(curr.ProductID.toString()).toString('base64'),
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
        console.log(filterData)
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

  homeRoute.get('/attribute-category', async (req, res) => {
    try {
        // Optimized SQL Query
        const query = `
            SELECT 
                c.CategoryID, c.CategoryName,
                c1.CategoryID AS SubcategoryID, c1.CategoryName AS SubcategoryName,
                a.attribute_name, a.CategoryID AS Acid, a.subcategory AS Ascid,
                av.value, av.id AS AttributeValueID
            FROM tbl_category c
            LEFT JOIN tbl_category c1 ON c1.ParentCategoryID = c.CategoryID
            LEFT JOIN attributes a ON a.subcategory = c1.CategoryID
            LEFT JOIN attribute_values av ON a.id = av.attribute_id
            WHERE c.ParentCategoryID IS NULL;
        `;

        const [result] = await db.query(query);

        if (!result.length) {
            return res.status(200).json({ 
                message: "No attribute categories found", 
                result: [], 
                all: {} 
            });
        }

        // Using Map for efficient structuring
        const filterData = new Map();

        result.forEach(item => {
            // Get or create category
            if (!filterData.has(item.CategoryID)) {
                filterData.set(item.CategoryID, {
                    CategoryID: item.CategoryID,
                    CategoryName: item.CategoryName,
                    Subcategories: new Map()
                });
            }
            const category = filterData.get(item.CategoryID);

            // Get or create subcategory
            if (!category.Subcategories.has(item.SubcategoryID)) {
                category.Subcategories.set(item.SubcategoryID, {
                    SubcategoryID: item.SubcategoryID,
                    SubcategoryName: item.SubcategoryName,
                    Attributes: new Map()
                });
            }
            const subcategory = category.Subcategories.get(item.SubcategoryID);

            // Get or create attribute
            if (!subcategory.Attributes.has(item.attribute_name)) {
                subcategory.Attributes.set(item.attribute_name, {
                    AttributeName: item.attribute_name,
                    Acid: item.Acid,
                    Ascid: item.Ascid,
                    AttributeValues: new Set()
                });
            }
            const attribute = subcategory.Attributes.get(item.attribute_name);

            // Add attribute value
            if (item.value) {
                attribute.AttributeValues.add({
                    Value: item.value.trim(),
                    AttributeValueID: item.AttributeValueID
                });
            }
        });

        // Convert Maps to arrays
        const formattedData = Array.from(filterData.values()).map(category => ({
            ...category,
            Subcategories: Array.from(category.Subcategories.values()).map(subcategory => ({
                ...subcategory,
                Attributes: Array.from(subcategory.Attributes.values()).map(attribute => ({
                    ...attribute,
                    AttributeValues: Array.from(attribute.AttributeValues)
                }))
            }))
        }));

        // Extracting grouped attributes
        const groupedAttributes = {};
        formattedData.forEach(category => {
            category.Subcategories.forEach(subcategory => {
                subcategory.Attributes.forEach(attribute => {
                    if (!groupedAttributes[attribute.AttributeName]) {
                        groupedAttributes[attribute.AttributeName] = [];
                    }
                    attribute.AttributeValues.forEach(value => {
                        if (!groupedAttributes[attribute.AttributeName].includes(value.Value)) {
                            groupedAttributes[attribute.AttributeName].push(value.Value);
                        }
                    });
                });
            });
        });

        res.status(200).json({ 
            message: "Attribute categories fetched successfully", 
            result: formattedData, 
            all: groupedAttributes 
        });

    } catch (error) {
        res.status(500).json({ 
            message: "Internal server error", 
            error: error.message 
        });
    }
});


export default homeRoute;
