import express from "express";
import db from "../db/db.js";
const paginateRoute = express.Router();

paginateRoute.get("/", async (req, res) => {
    try {
      // Extract pagination parameters from the request query
      const page = parseInt(req.query.page, 10) || 1; // Default to page 1
      const pageSize = parseInt(req.query.pageSize, 10) || 10; // Default to 10 items per page
  
      // Calculate the OFFSET and LIMIT for pagination
      const offset = (page - 1) * pageSize;
  
      // Query to fetch paginated products
      const query = `
        SELECT DISTINCT
          p.ProductID,
          p.ProductName,
          p.MetaTitle,
          c.CategoryName,
          p.metaDescription,
          p.MetaKeyWords,
          p.ProductPrice,
          p.DiscountPercentage,
          p.DiscountPrice,
          p.SellingPrice,
          p.CashPrice,
          p.CategoryID,
          p.SubCategoryIDone,
          p.SubCategoryIDtwo,
          p.Description,
          p.Image,
          p.Status,
          p.Stock
        FROM 
          tbl_products p
        LEFT JOIN 
          tbl_category c ON p.CategoryID = c.CategoryID
        ORDER BY p.ProductID
        LIMIT ? OFFSET ?;
      `;

      // Query to get total product count
      
      // Execute main product query
      const [products] = await db.query(query, [pageSize, offset]);
      const countQuery = `SELECT COUNT(DISTINCT ProductID) as total FROM tbl_products`;
      const [countResult] = await db.query(countQuery);

      // For each product, fetch its images and attributes separately
      const groupedData = await Promise.all(products.map(async (product) => {
        // Get product images
        const [images] = await db.query(`
          SELECT ProductImages, ProductImagesID 
          FROM tbl_productimages 
          WHERE ProductID = ?
        `, [product.ProductID]);

        // Get product attributes
        const [attributes] = await db.query(`
          SELECT pa.AttributeValueID, av.value, a.attribute_name
          FROM tbl_productattribute pa
          LEFT JOIN attribute_values av ON pa.AttributeValueID = av.id
          LEFT JOIN attributes a ON av.attribute_id = a.id
          WHERE pa.ProductID = ?
        `, [product.ProductID]);

        return {
          ...product,
          ProductImages: images.map(img => ({
            ProductImages: img.ProductImages,
            ProductImagesID: img.ProductImagesID
          })),
          AttributeValues: attributes.map(attr => ({
            AttributeValueID: attr.AttributeValueID,
            Value: attr.value,
            AttributeName: attr.attribute_name
          }))
        };
      }));

      const totalProducts = countResult[0].total;
      const totalPages = Math.ceil(totalProducts / pageSize);
  
      // Respond with paginated products and pagination info
      res.status(200).json({
        products: groupedData,
        totalProducts,
        totalPages,
        currentPage: page,
        pageSize,
      });
    } catch (err) {
      console.error("Error fetching products with pagination:", err);
      res.status(500).json({
        message: "Internal server error",
        error: err.message || err,
      });
    }
});
paginateRoute.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { Status } = req.body;

  // Validate the ID and Status
  if (!id || isNaN(id)) {
    return res.status(400).send({ message: 'Invalid ID' });
  }
  
  // if (!Status) {
  //   return res.status(400).send({ message: 'Status is required' });
  // }

  try {
    // Update the product status in the database
    const [result] = await db.query(
      'UPDATE tbl_products SET Status = ? WHERE ProductID = ?',
      [Status, id]
    );

    if (result.affectedRows > 0) {
      return res.status(200).send({ message: 'Modified successfully' });
    }

    return res.status(404).send({ message: 'Product not found' });
  } catch (error) {
    console.error('Error updating product status:', error);
    return res.status(500).send({ message: 'Internal server error' });
  }
});

export default paginateRoute;