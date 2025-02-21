import express from "express";
import db from "../db/db.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import upload from "../uploads.js";
import slugify from "slugify";
const productRoute = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateUniqueSlug(title) {
    let slug = slugify(title, { lower: true, strict: true });
  
    let [existing] = await db.query("SELECT COUNT(*) AS count FROM tbl_products WHERE slug = ?", [slug]);
  
    let count = existing[0].count;
    while (count > 0) {
      slug = `${slug}-${count}`;
      [existing] = await db.query("SELECT COUNT(*) AS count FROM tbl_products WHERE slug = ?", [slug]);
      count = existing[0].count;
    }
  
    return slug;
  }
productRoute.post('/', upload.fields([{ name: 'productImage' }, { name: 'ProductImages' }]), async (req, res) => {
    try {
        const {
            productName,
            metaTitle,
            metaDescription,
            metaKeyword,
            productPrice,
            discountPercentage,
            discountPrice,
            sellingPrice,
            Stock :Stock  ,
            cashPrice,
            categoryId,
            subCategoryId:subCategoryId ,
            subCategoryLv2Id,
            productDescription,
            attributeValue
        } = req.body;
        const productImage = req.files.productImage ? req.files.productImage[0] : null;
        const productImagePath = productImage ? path.join('uploads', productImage.filename) : null;
        const productImages = req.files.ProductImages || [];
        const insertProductQuery = `
            INSERT INTO tbl_products(ProductName, MetaTitle, metaDescription, MetaKeyWords, ProductPrice, DiscountPercentage, 
                                     DiscountPrice, SellingPrice, CashPrice, CategoryID, SubCategoryIDone, SubCategoryIDtwo, Description, Image,Stock,ProductUrl) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)`;
            const slug = await generateUniqueSlug(productName);
       const [result] = await db.query(insertProductQuery, [
            productName, metaTitle, metaDescription, metaKeyword, productPrice, discountPercentage, 
            discountPrice, sellingPrice, cashPrice, categoryId, subCategoryId || 0, subCategoryLv2Id, productDescription, productImagePath,Stock,slug
        ]);
            if (result.affectedRows === 0) {
                return res.status(500).json({ message: 'Error inserting product', error: err });
            }
            if(result.insertId){
                const attributeValues = JSON.parse(attributeValue || "{}");
           
                for (const [_, value] of Object.entries(attributeValues)) {
                  await db.query(
                    "INSERT INTO tbl_productattribute (ProductID, AttributeValueID) VALUES (?, ?)",
                    [result.insertId, value]
                  );
                }
            const productId = result.insertId; 
         
            if (productImages.length > 0) {
                const insertImagesQuery = `
                    INSERT INTO tbl_productimages (ProductID, ProductImages) 
                    VALUES ?`;
                const imageValues = productImages.map(file => [
                    productId, path.join('uploads', file.filename)
                ]);
                const [result] = await db.query(insertImagesQuery, [imageValues]);
                if (result.affectedRows === 0) {
                    return res.status(500).json({ message: 'Error inserting product images', error: err });
                }
                res.status(200).json({ message: 'Product and images added successfully' });
            } else {
                res.status(200).json({ message: 'Product added successfully, no additional images provided' });
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error', error: err });
    }
});
productRoute.get("/attributes", async (req, res) => {
    const [result] = await db.query(`
        SELECT a.attribute_name, a.id, av.value ,av.id as valueId
        FROM attributes a
        LEFT JOIN attribute_values av ON a.id = av.attribute_id
    `);
    const groupedData = result.reduce((acc, item) => {
        let group = acc.find(group => group.attribute_name === item.attribute_name);
    
        if (!group) {
            group = {
                attribute_name: item.attribute_name,
                id: item.id,
                value: []
            };
            acc.push(group);
        }
        group.value.push({
            value: item.value,
            valueId: item.valueId
        });
    
        return acc;
    }, []);
    console.log(result)
    res.status(200).json(groupedData);
    
});

productRoute.get("/", async (req, res) => {
  try{
    const query = `SELECT p.ProductName,p.ProductID,a.attribute_name, st.ProductImages,st.ProductImagesID, p.MetaTitle,c.CategoryName , p.metaDescription, p.MetaKeyWords, p.ProductPrice, p.DiscountPercentage, 
                   p.DiscountPrice, p.SellingPrice, p.CashPrice, p.CategoryID, p.SubCategoryIDone, p.SubCategoryIDtwo, p.Description, p.Image, 
                   pa.AttributeValueID, av.value FROM tbl_products p 
                   LEFT JOIN tbl_productattribute pa ON p.ProductID = pa.ProductID 
                   LEFT JOIN attribute_values av ON pa.AttributeValueID = av.id
                   LEFT JOIN attributes a ON av.attribute_id = a.id
                   LEFT JOIN tbl_category c ON p.CategoryID = c.CategoryID
                   LEFT JOIN tbl_productimages st ON st.ProductID = p.ProductID
                   ORDER BY p.ProductID DESC
           
                   `
                   ;
    const [result] = await db.query(query);
    const groupedData = result.reduce((acc, item) => {
        let product = acc.find(prod => 
            prod.ProductID === item.ProductID
        );
    
        if (!product) {
            product = {
                ProductID: item.ProductID,
                ProductName: item.ProductName,
                MetaTitle: item.MetaTitle,
                CategoryName: item.CategoryName,
                metaDescription: item.metaDescription,
                MetaKeyWords: item.MetaKeyWords,
                ProductPrice: item.ProductPrice,
                DiscountPercentage: item.DiscountPercentage,
                DiscountPrice: item.DiscountPrice,
                SellingPrice: item.SellingPrice,
                CashPrice: item.CashPrice,
                CategoryID: item.CategoryID,
                ProductImages:[],
                SubCategoryIDone: item.SubCategoryIDone,
                SubCategoryIDtwo: item.SubCategoryIDtwo,
                Description: item.Description,
                Image: item.Image,
                values: []
            };
            acc.push(product);
        }
        if(item.ProductImages){
            product.ProductImages.push({ProductImages:item.ProductImages,ProductImagesID:item.ProductImagesID});
        }

        product.values.push({
            AttributeValueID: item.AttributeValueID,
            value: item.value,
            attribute_name: item.attribute_name
        });
    
        return acc;
    }, []);
    
    
    res.status(200).json(groupedData);
}catch(err){
    console.error(err);
    res.status(500).json({ message: "Internal server error", error: err });
}
});

productRoute.put("/:id", upload.fields([{ name: 'newImage' }, { name: 'ProductImages' }]), async (req, res) => {
   
    const { id } = req.params;
    const { 
        productName, metaTitle, metaDescription, metaKeyword, productPrice, discountPercentage, 
        discountPrice, sellingPrice, cashPrice, categoryId, subCategoryId, subCategoryLv2Id, 
        productDescription, attributeValue, productImage,stock
    } = req.body;
    const slug = await generateUniqueSlug(productName);
    const newImage = req.files.newImage ? req.files.newImage[0] : null; 
    let updatedImagePath = productImage; 
console.log(newImage)
    if (!id || isNaN(id)) {
        return res.status(400).json({ message: "Product ID is not valid" });
    }

    try {
        if (attributeValue.length > 0) {
            const [preData] = await db.query('SELECT * FROM tbl_productattribute WHERE ProductID = ?', [id]);
            if (preData.length > 0) {
                const deleteAttributesQuery = 'DELETE FROM tbl_productattribute WHERE ProductID = ?';
                const [deleteResult] = await db.query(deleteAttributesQuery, [id]);

                if (deleteResult.affectedRows === 0) {
                    return res.status(400).json({ message: "Product attributes not found for the given Product ID" });
                }
            }
        }
        if (newImage) {
            const [productImageResult] = await db.query('SELECT * FROM tbl_products WHERE ProductID = ?', [id]);

            if (productImageResult.length > 0 && productImageResult[0].Image) {
                const oldImagePath = path.join(__dirname, '..', productImageResult[0].Image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                    console.log("Old image deleted successfully");
                } else {
                    console.log("Old image not found, skipping deletion");
                }
            }
            updatedImagePath = path.join("uploads", newImage.filename);
            const [result] = await db.query('UPDATE tbl_products SET Image = ? WHERE ProductID = ?', [updatedImagePath, id]);
            if (result.affectedRows === 0) {
                return res.status(400).json({ message: "Product image update failed" });
            }
        }
        const updateProductQuery = `
            UPDATE tbl_products 
            SET 
                ProductName = ?, 
                MetaTitle = ?, 
                metaDescription = ?, 
                MetaKeyWords = ?, 
                ProductPrice = ?, 
                DiscountPercentage = ?, 
                DiscountPrice = ?, 
                SellingPrice = ?, 
                CashPrice = ?, 
                CategoryID = ?, 
                stock=?,
                SubCategoryIDone = ?, 
                SubCategoryIDtwo = ?, 
                Description = ?,
                ProductUrl=?
            WHERE ProductID = ?
        `;

        const [updateProductResult] = await db.query(updateProductQuery, [
            productName, metaTitle, metaDescription, metaKeyword, productPrice, discountPercentage,
            discountPrice, sellingPrice, cashPrice, categoryId,stock, subCategoryId, subCategoryLv2Id,
            productDescription,slug, id
        ]);

        if (updateProductResult.affectedRows === 0) {
            return res.status(400).json({ message: "Product update failed or Product ID not found" });
        }
        const productImages = req.files.ProductImages || [];
        if (productImages.length > 0) {
            const insertImagesQuery = `
                INSERT INTO tbl_productimages (ProductID, ProductImages) 
                VALUES ?`;
            const imageValues = productImages.map(file => [
                id, path.join('uploads', file.filename)
            ]);
            const [result] = await db.query(insertImagesQuery, [imageValues]);
            if (result.affectedRows === 0) {
                return res.status(400).json({ message: "Product images update failed" });
            }
        }
        if (attributeValue) {
            const attributeValues = JSON.parse(attributeValue);
            for (const value of Object.entries(attributeValues)) {
                await db.query(
                    "INSERT INTO tbl_productattribute (ProductID, AttributeValueID) VALUES (?, ?)",
                    [id, value[1]]
                );
            }
        }
        res.status(200).json({ message: "Product updated successfully", data: updateProductResult });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", error: err });
    }
});

productRoute.delete("/:id", async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(id)) {
        return res.status(400).json({ message: "Product ID is not valid" });
    }
    try {
        const [productImageResult] = await db.query('SELECT * FROM tbl_products WHERE ProductID = ?', [id]);
        if (productImageResult.length > 0 && productImageResult[0].Image) {
            const productImagePath = productImageResult[0].Image;
            console.log("Main image path:", productImagePath);
            if (productImagePath) {
                const oldImagePath = path.join(__dirname, '..', productImagePath);
                console.log("Full path of old image:", oldImagePath);
                if (fs.existsSync(oldImagePath)) {
                    try {
                        fs.unlinkSync(oldImagePath);
                        console.log("Old image deleted successfully");
                    } catch (err) {
                        console.error("Error deleting old image:", err);
                    }
                } else {
                    console.log("Main image does not exist:", oldImagePath);
                }
            } else {
                console.log("No main image for this product.");
            }
        } else {
            console.log("No product found or image is missing");
        }
        const [productimages] = await db.query('SELECT * FROM tbl_productimages WHERE ProductID = ?', [id]);
        console.log("Product images to delete:", productimages);  

        if (productimages.length > 0) {
            for (const image of productimages) {
                const productImagePath = image.ProductImages;
                console.log("Product image path:", productImagePath);
                if (productImagePath) {
                    const imagePath = path.join(__dirname, '..', productImagePath);
                    console.log("Full path of product image:", imagePath);
                    if (fs.existsSync(imagePath)) {
                        try {
                            fs.unlinkSync(imagePath);
                            console.log("Product image deleted successfully:", productImagePath);
                        } catch (err) {
                            console.error("Error deleting product image:", err);
                        }
                    } else {
                        console.log("Product image does not exist:", imagePath);
                    }
                } else {
                    console.log("Product image path is undefined.");
                }
            }
            await db.query('DELETE FROM tbl_productimages WHERE ProductID = ?', [id]);
            console.log("Product images deleted from database");
        } else {
            console.log("No product images found to delete.");
        }
        const [result] = await db.query('DELETE FROM tbl_products WHERE ProductID = ?', [id]);
        if (result.affectedRows > 0) {
            res.status(200).json({ message: "Product and associated images deleted successfully" });
        } else {
            res.status(404).json({ message: "Product not found" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error", error: err });
    }
});


export default productRoute;
