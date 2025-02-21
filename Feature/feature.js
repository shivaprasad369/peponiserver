import express from "express";
import db from "../db/db.js";
const featureRoute = express.Router();

featureRoute.get('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ID parameter
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Valid Featured ID is required' });
    }

    try {
        // Query to fetch products not associated with the given FeaturedID
        const products = await db.query(` SELECT product.ProductID, product.ProductName, product.Image,features.FeaturedID 
            FROM tbl_products product
            LEFT JOIN tbl_featureproducts features 
                ON product.ProductID = features.ProductID AND features.FeaturedID = ?
            WHERE features.ProductID IS NULL
          
        `, [id]);

        res.json({ data: products });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

featureRoute.get('/features/:id', async (req, res) => {
    try {
        const features = await db.query(`SELECT p.ProductID,fp.FeaturedID, p.ProductName, p.Image FROM tbl_products p
            LEFT JOIN tbl_featureproducts fp ON p.ProductID = fp.ProductID
            WHERE fp.Name = ?
            ORDER BY fp.position ASC
            `, [req.params.id]);
        res.json({data:features});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
featureRoute.post('/', async (req, res) => {
    try {
        const { ProductID, FeatureName } = req.body;
        if (!ProductID || !FeatureName) {
            return res.status(400).json({
                message: 'Product ID and Feature Name are required',
            });
        }
        const existingFeatureGroup = await db.query(
            `SELECT * FROM tbl_featureproducts WHERE Name = ? AND ProductID = ?`,
            [FeatureName, ProductID]
        );
        console.log(existingFeatureGroup[0]);
        if(existingFeatureGroup[0].length > 0){
            return res.status(400).json({
                message: 'This feature is already associated with the product',
            });
        }
        else{   
            const result = await db.query(
                `INSERT INTO tbl_featureproducts (ProductID, Name) VALUES (?, ?)`,
                [ProductID, FeatureName]
            );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'Failed to add feature' });
            }

            res.json({ message: 'Feature added successfully' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

featureRoute.delete('/:id', async (req, res) => {
    if (!req.params.id || isNaN(req.params.id)) {
        return res.status(400).json({ error: 'Product ID is required' });
    }
    try {
        const features = await db.query(`DELETE FROM tbl_featureproducts WHERE FeaturedID = ?`, [req.params.id]);
        if (features.affectedRows === 0) {
            return res.status(400).json({ message: 'Failed to delete feature' });
        }
        res.json({ message: 'Features deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

featureRoute.get('/', async (req, res) => {
    try {
        const features = await db.query(`SELECT ProductID, ProductName,Image FROM tbl_products WHERE Status=1   `);
        res.json({data:features});
    } catch (error) {
        res.status(500).json({ error: res.message });
    }
});

featureRoute.post('/reoder', async(req,res)=>{
    const {id,position}=req.body;
     try {
    await db.query("UPDATE tbl_featureproducts SET position = ? WHERE ProductID = ?", [position, id])
    res.json({ success: true, message: "Product order updated" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: "Error updating product order" })
  }
})


export default featureRoute;
