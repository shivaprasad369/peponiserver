import express from "express";
import db from "../db/db.js";
 
const productsRoute = express.Router();
productsRoute.get('/collection', async (req, res) => {
    try {
        const { categoryName } = req.query;

        if (!categoryName) {
            return res.status(400).json({ error: "Category name is required" });
        }

        let name = decodeURIComponent(categoryName);

        // Fetch products and attributes
        const [data] = await db.query(`
            SELECT c.CategoryName, p.ProductID, p.CategoryID, p.SubCategoryIDone, p.ProductName,
             p.ProductPrice, p.CashPrice, p.Image, p.ProductUrl FROM tbl_category c JOIN tbl_products
              p ON p.CategoryID =
             c.CategoryID JOIN tbl_productattribute pa ON pa.ProductID = p.ProductID 
             WHERE c.CatURL = ? AND p.Status=1`, [name]);

        const [attribute] = await db.query(`
          SELECT 
                c.CategoryName, c.CategoryID, a.attribute_name,c1.CategoryName as subcategory, c1.CategoryID as SubCategoryIDone,
                av.id as Avid, av.value AS AttributeValue, a.id as Aid 
            FROM tbl_category c
          JOIN tbl_category c1 ON c.CategoryID = c1.ParentCategoryID
          JOIN attributes a ON a.subcategory = c1.CategoryID
          JOIN attribute_values av ON a.id = av.attribute_id
            WHERE c.CatURL = ?`, [name]);

        // Group products
        const filterData = data.reduce((acc, curr) => {
            if (!acc[curr.ProductID]) {
                acc[curr.ProductID] = {
                    ProductID: curr.ProductID,
                    ProductName: curr.ProductName,
                    Image: curr.Image,
                    url:curr.ProductUrl,
                    ProductPrice: curr.ProductPrice,
                    CashPrice: curr.CashPrice,
                    CategoryID: Buffer.from(curr.CategoryID.toString()).toString('base64'),
                    SubCategoryIDone: curr.SubCategoryIDone,
                };
            }
            return acc;
        }, {});
        const filterDatas = attribute.reduce((acc, curr) => {
           
            // Ensure the SubCategoryIDone key exists in the accumulator
            if (!acc[curr.SubCategoryIDone]) {
                acc[curr.SubCategoryIDone] = {
                    SubCategoryIDone: curr.SubCategoryIDone,
                    CategoryID:curr.CategoryID,
                    subName:curr.subcategory,   
                    Attributes: {}  // Initialize empty object for attributes
                };
            }
        
            // Ensure the attribute_name key exists under the Attributes of SubCategoryIDone
            if (!acc[curr.SubCategoryIDone].Attributes[curr.attribute_name]) {
                acc[curr.SubCategoryIDone].Attributes[curr.attribute_name] = [];  // Initialize empty array for the attribute values
            }
        
            // Add the attribute value if it's not already in the list for this attribute_name in the current SubCategoryIDone
            const existingValues = acc[curr.SubCategoryIDone].Attributes[curr.attribute_name];
            if (!existingValues.includes(curr.AttributeValue)) {
                existingValues.push(curr.AttributeValue);  // Add unique value
            }
        
            return acc;  // Return the accumulator
        }, {});
      const categoryId=
      Object.keys(filterData).map(SubCategoryIDone => {
        return  Buffer.from(filterData[SubCategoryIDone].CategoryID, "base64").toString("utf-8")
       
      });
        // console.log(categoryId)
        res.status(200).json({ products: Object.values(filterData), attribute: filterDatas,CategoryID:categoryId});
    } catch (error) {
        console.error("Error fetching collection:", error);
        res.status(500).json({ error: error.message });
    }       
});

productsRoute.get('/all-collection', async (req, res) => {  
    try {
        const { categoryName } = req.query;
        if (!categoryName) {
            return res.status(400).json({ error: "Category name is required" });
        }
        let name = decodeURIComponent(categoryName);
        
        // Fetch products with min & max CashPrice per product
        const [products] = await db.query(`
            SELECT 
                c.CategoryName, 
                p.ProductID, 
                p.CategoryID, 
                p.SubCategoryIDone, 
                p.ProductName, 
                p.ProductPrice,
                p.ProductUrl, 
                p.Image, 
                p.CashPrice,  -- ✅ Keep actual CashPrice for reference
                a.id AS aid,  
                av.id AS attributeValuesId, 
                av.value AS attributeValue, 
                a.attribute_name AS AttributeName 
            FROM tbl_category c
            JOIN tbl_products p ON p.CategoryID = c.CategoryID
            JOIN tbl_productattribute pa ON pa.ProductID = p.ProductID
            JOIN attribute_values av ON av.id = pa.AttributeValueID
            JOIN attributes a ON a.id = av.attribute_id
        `);

        // Fetch overall min and max CashPrice from all products
        const [overallStats] = await db.query(`
            SELECT 
                MIN(CashPrice) AS OverallMinCashPrice, 
                MAX(CashPrice) AS OverallMaxCashPrice
            FROM tbl_products
        `);

        // Transform product data into correct format
        const filterData = products.reduce((acc, curr) => {
            if (!acc[curr.ProductID]) {
                acc[curr.ProductID] = {
                    ProductID: curr.ProductID,
                    ProductName: curr.ProductName,
                    url:curr.ProductUrl,
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
      
        // Convert object to an array and add overall min/max CashPrice to response
        res.status(200).json({
            products: Object.values(filterData),
            overallMinCashPrice: overallStats[0].OverallMinCashPrice,
            overallMaxCashPrice: overallStats[0].OverallMaxCashPrice
        });

    } catch (error) {
        console.error("Error fetching collection:", error);
        res.status(500).json({ error: error.message });
    }
});
productsRoute.post('/search', async (req, res) => {
    try {
        const { categories, subcategories, attributes, priceRange, sortField, sortOrder, page = 1, limit = 10 } = req.body;

        console.log("Categories received:", categories);
        console.log("Subcategories received:", subcategories);
        console.log("Attributes received:", attributes);
        console.log("Price Range received:", priceRange);
        console.log("Sorting received:", sortField, sortOrder);
        console.log("Page:", page, "Limit:", limit);

        // Ensure categories and subcategories are arrays
        const categoryFilter = Array.isArray(categories) ? categories : [];
        const subCategoryFilter = subcategories ? Object.values(subcategories).flat().map(Number) : [];

        // Define sorting fields
        const allowedSortFields = ["ProductName", "ProductPrice", "CashPrice"];
        const sortColumn = allowedSortFields.includes(sortField) ? sortField : "ProductID";
        const order = sortOrder === "asc" ? "ASC" : "DESC";

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Construct base SQL query
        let query = `
            SELECT DISTINCT p.ProductID, p.ProductName, p.Image, p.ProductPrice, 
                            p.CashPrice, p.CategoryID, p.SubCategoryIDone, p.ProductUrl
        `;

        let conditions = ["p.Status = 1"];
        let params = [];

        // Filter by categories
        if (categoryFilter.length > 0) {
            conditions.push(`p.CategoryID IN (${categoryFilter.map(() => '?').join(',')})`);
            params.push(...categoryFilter);
        }

        // Filter by subcategories
        if (subCategoryFilter.length > 0) {
            conditions.push(`p.SubCategoryIDone IN (${subCategoryFilter.map(() => '?').join(',')})`);
            params.push(...subCategoryFilter);
        }

        // Handle price range
        if (priceRange?.length === 2) {
            conditions.push(`(p.CashPrice BETWEEN ? AND ?)`);
            params.push(priceRange[0], priceRange[1]);
        }

        // Handle attributes filtering
        let joinClauses = "";
        if (attributes && typeof attributes === 'object') {
            Object.keys(attributes).forEach((attrName, index) => {
                const values = attributes[attrName];
                if (Array.isArray(values) && values.length > 0) {
                    joinClauses += `
                       LEFT JOIN tbl_productattribute pa${index} ON pa${index}.ProductID = p.ProductID
                       LEFT JOIN attribute_values av${index} ON av${index}.id = pa${index}.AttributeValueID
                       LEFT JOIN attributes a${index} ON a${index}.id = av${index}.attribute_id
                    `;
                    query += `, a${index}.attribute_name AS AttributeName, av${index}.value AS AttributeValue`;
                    conditions.push(`(a${index}.attribute_name = ? AND av${index}.value IN (${values.map(() => '?').join(',')}))`);
                    params.push(attrName, ...values);
                }
            });
        }

        // Construct full query
        query += ` FROM tbl_products p JOIN tbl_category c ON p.CategoryID = c.CategoryID ${joinClauses} `;

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(" AND ");
        }

        // Get total count for pagination
        let countQuery = `SELECT COUNT(DISTINCT p.ProductID) AS total FROM tbl_products p JOIN tbl_category c ON p.CategoryID = c.CategoryID ${joinClauses}`;
        if (conditions.length > 0) {
            countQuery += ` WHERE ` + conditions.join(" AND ");
        }
        
        const [totalCountResult] = await db.query(countQuery, params);
        const totalCount = totalCountResult[0]?.total || 0;

        // Add sorting & pagination
        query += ` ORDER BY p.${sortColumn} ${order} LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        console.log("Final Query:", query);
        console.log("Query Parameters:", params);

        const [data] = await db.query(query, params);

        // Transform data into structured format
        const filterData = data.reduce((acc, product) => {
            let existingProduct = acc.find(p => p.ProductID === product.ProductID);

            if (!existingProduct) {
                existingProduct = {
                    ProductID: Buffer.from(product.ProductID.toString()).toString('base64'),
                    ProductName: product.ProductName,
                    Image: product.Image,
                    url: product.ProductUrl,
                    ProductPrice: product.ProductPrice,
                    CashPrice: product.CashPrice,
                    CategoryID: Buffer.from(product.CategoryID.toString()).toString('base64'),
                    SubCategoryIDone: product.SubCategoryIDone,
                    attributes: []
                };
                acc.push(existingProduct);
            }

            // Add attribute details if available
            if (product.AttributeName && product.AttributeValue) {
                existingProduct.attributes.push({
                    AttributeName: product.AttributeName,
                    AttributeValue: product.AttributeValue
                });
            }

            return acc;
        }, []);

        res.status(200).json({
            data: filterData,
            pagination: {
                total: totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("Error fetching products by category, subcategory & attributes:", error);
        res.status(500).json({ error: error.message });
    }
});



// productsRoute.post('/search', async (req, res) => {
//     try {
//         const { categories, subcategories, attributes, priceRange, sortField, sortOrder,name } = req.body;  
//         const page=1,limit=10;
//         console.log("Categories received:", categories);
//         console.log("Subcategories received:", subcategories);
//         console.log("Attributes received:", attributes);
//         console.log("Price Range received:", priceRange);
//         console.log("Sorting received:", sortField, sortOrder);

//         // Ensure categories is an array
//         const categoryFilter = Array.isArray(categories) ? categories : [];

//         // Extract subcategory IDs from the subcategories object
//         const subCategoryFilter = subcategories 
//             ? Object.values(subcategories).flat().map(Number) 
//             : [];

//         // Define allowed sorting fields
//         const allowedSortFields = ["ProductName", "ProductPrice", "CashPrice"];
//         const sortColumn = allowedSortFields.includes(sortField) ? sortField : "ProductID";
//         const order = sortOrder === "asc" ? "ASC" : "DESC";

//         // Construct base SQL query
//         let query = `
//             SELECT DISTINCT p.ProductID, p.ProductName, p.Image, p.ProductPrice, 
//                             p.CashPrice, p.CategoryID, p.SubCategoryIDone,p.ProductUrl
//         `;

//         let conditions = ["p.Status = 1"];
//         let params = [];

//         // Filter by categories
//         if (categoryFilter.length > 0) {
//             conditions.push(`p.CategoryID IN (${categoryFilter.map(() => '?').join(',')})`);
//             params.push(...categoryFilter);
//         }

//         // Filter by subcategories
//         if (subCategoryFilter.length > 0) {
//             conditions.push(`p.SubCategoryIDone IN (${subCategoryFilter.map(() => '?').join(',')})`);
//             params.push(...subCategoryFilter);
//         }

//         // Handle price range
//         if (priceRange?.length === 2) {
//             conditions.push(`(p.CashPrice BETWEEN ? AND ?)`);
//             params.push(priceRange[0], priceRange[1]);
//         }

//         // Handle attributes filtering
//         let joinClauses = "";
//         if (attributes && typeof attributes === 'object') {
//             Object.keys(attributes).forEach((attrName, index) => {
//                 const values = attributes[attrName];
//                 if (Array.isArray(values) && values.length > 0) {
//                     joinClauses += `
//                        LEFT JOIN tbl_productattribute pa${index} ON pa${index}.ProductID = p.ProductID
//                        LEFT JOIN attribute_values av${index} ON av${index}.id = pa${index}.AttributeValueID
//                        LEFT JOIN attributes a${index} ON a${index}.id = av${index}.attribute_id
//                     `;
//                     query += `, a${index}.attribute_name AS AttributeName, av${index}.value AS AttributeValue`;
//                     conditions.push(`(a${index}.attribute_name = ? AND av${index}.value IN (${values.map(() => '?').join(',')}))`);
//                     params.push(attrName, ...values);
//                 }
//             });
//         }

//         // Construct full query
//         query += ` FROM tbl_products p JOIN tbl_category c ON p.CategoryID = c.CategoryID ${joinClauses} `;

//         if (conditions.length > 0) {
//             query += ` WHERE ` + conditions.join(" AND ");
//         }

//         // Add sorting
//         query += ` ORDER BY p.${sortColumn} ${order}`;

//         console.log("Final Query:", query);
//         console.log("Query Parameters:", params);

//         const [data] = await db.query(query, params);

//         // Transform data into structured format
//         const filterData = data.reduce((acc, product) => {
//             let existingProduct = acc.find(p => p.ProductID === product.ProductID);

//             if (!existingProduct) {
//                 existingProduct = {
//                     ProductID:Buffer.from( product.ProductID.toString()).toString('base64'),
//                     ProductName: product.ProductName,
//                     Image: product.Image,
//                     url:product.ProductUrl,
//                     ProductPrice: product.ProductPrice,
//                     CashPrice: product.CashPrice,
//                     CategoryID: Buffer.from(product.CategoryID.toString()).toString('base64'),
//                     SubCategoryIDone: product.SubCategoryIDone,
//                     attributes: []
//                 };
//                 acc.push(existingProduct);
//             }

//             // Add attribute details if available
//             if (product.AttributeName && product.AttributeValue) {
//                 existingProduct.attributes.push({
//                     AttributeName: product.AttributeName,
//                     AttributeValue: product.AttributeValue
//                 });
//             }

//             return acc;
//         }, []);

//         res.status(200).json(filterData);

//     } catch (error) {
//         console.error("Error fetching products by category, subcategory & attributes:", error);
//         res.status(500).json({ error: error.message });
//     }
// });
// productsRoute.post('/sub-search', async (req, res) => {
//     try {
//         const { categories, subcategories, attributes, priceRange, sortField, sortOrder, name } = req.body;  

//         console.log("Categories received:", categories);
//         console.log("Subcategories received:", subcategories);
//         console.log("Attributes received:", attributes);
//         console.log("Price Range received:", priceRange);
//         console.log("Sorting received:", sortField, sortOrder);

//         let categoryFilter = Array.isArray(categories) ? categories : [];
//         if(name === ''){
//             return res.status(500).send('name is require')
//         }
//         // If categories is empty, fetch CategoryID
//         if (name!=='') {
//             const [results] = await db.query(
//                 'SELECT CategoryID FROM tbl_category WHERE CategoryName=? AND SubCategoryLevel=1', 
//                 [name]
//             );

//             if (results.length > 0) {
//                 categoryFilter = [results[0].CategoryID];
//             }
//             else {
//                 throw new Error(`No category found for the name "${name}"`);
//             }
//         }

//         // Extract subcategory IDs
//         const subCategoryFilter = subcategories 
//             ? Object.values(subcategories).flat().map(Number) 
//             : [];

//         // Allowed sorting fields
//         const allowedSortFields = ["ProductName", "ProductPrice", "CashPrice"];
//         const sortColumn = allowedSortFields.includes(sortField) ? sortField : "ProductID";
//         const order = sortOrder === "asc" ? "ASC" : "DESC";

//         // Construct base SQL query
//         let query = `
//             SELECT DISTINCT p.ProductID, p.ProductName, p.Image, p.ProductPrice, 
//                             p.CashPrice, p.CategoryID, p.SubCategoryIDone, p.ProductUrl
//         `;

//         let conditions = ["p.Status = 1"];
//         let params = [];

//         // Filter by categories
//         if (categoryFilter.length > 0) {
//             conditions.push(`p.CategoryID IN (${categoryFilter.map(() => '?').join(',')})`);
//             params.push(...categoryFilter);
//         }

//         // Filter by subcategories
//         if (subCategoryFilter.length > 0) {
//             conditions.push(`p.SubCategoryIDone IN (${subCategoryFilter.map(() => '?').join(',')})`);
//             params.push(...subCategoryFilter);
//         }

//         // Handle price range
//         if (priceRange?.length === 2) {
//             conditions.push(`(p.CashPrice BETWEEN ? AND ? )`);
//             params.push(priceRange[0], priceRange[1]);
//         }

//         // Handle attributes filtering
//         let joinClauses = "";
//         if (attributes && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
//             Object.keys(attributes).forEach((attrName, index) => {
//                 const values = attributes[attrName];
//                 if (Array.isArray(values) && values.length > 0) {
//                     joinClauses += `
//                        LEFT JOIN tbl_productattribute pa${index} ON pa${index}.ProductID = p.ProductID
//                        LEFT JOIN attribute_values av${index} ON av${index}.id = pa${index}.AttributeValueID
//                        LEFT JOIN attributes a${index} ON a${index}.id = av${index}.attribute_id
//                     `;
//                     query += `, a${index}.attribute_name AS AttributeName, av${index}.value AS AttributeValue`;
//                     conditions.push(`(a${index}.attribute_name = ? AND av${index}.value IN (${values.map(() => '?').join(',')}))`);
//                     params.push(attrName, ...values);
//                 }
//             });
//         }

//         // Construct final query
//         query += ` FROM tbl_products p JOIN tbl_category c ON p.CategoryID = c.CategoryID ${joinClauses} `;

//         if (conditions.length > 0) {
//             query += ` WHERE ` + conditions.join(" AND ");
//         }

//         // Add sorting
//         query += ` ORDER BY p.${sortColumn} ${order}`;

//         console.log("Final Query:", query);
//         console.log("Query Parameters:", params);

//         // Execute query
//         const [data] = await db.query(query, params);

//         // Transform data into structured format
//         const filterData = data.reduce((acc, product) => {
//             let existingProduct = acc.find(p => p.ProductID === product.ProductID);

//             if (!existingProduct) {
//                 existingProduct = {
//                     ProductID: Buffer.from(product.ProductID.toString()).toString('base64'),
//                     ProductName: product.ProductName,
//                     Image: product.Image,
//                     url: product.ProductUrl,
//                     ProductPrice: product.ProductPrice,
//                     CashPrice: product.CashPrice,
//                     CategoryID: Buffer.from(product.CategoryID.toString()).toString('base64'),
//                     SubCategoryIDone: product.SubCategoryIDone,
//                     attributes: []
//                 };
//                 acc.push(existingProduct);
//             }

//             // Add attribute details if available
//             if (product.AttributeName && product.AttributeValue) {
//                 existingProduct.attributes.push({
//                     AttributeName: product.AttributeName,
//                     AttributeValue: product.AttributeValue
//                 });
//             }

//             return acc;
//         }, []);

//         res.status(200).json(filterData);

//     } catch (error) {
//         console.error("Error fetching products by category, subcategory & attributes:", error);
//         res.status(500).json({ error: error.message });
//     }
// });


// productsRoute.post('/sub-search', async (req, res, next) => {
//     try {
//         const { categories, subcategories, attributes, priceRange, sortField, sortOrder, name,page = 1, limit = 10 } = req.body;
//         console.log("Page:", page, "Limit:", limit);

//         console.log("Received Data:", req.body);

//         if (!name || name === "undefined") {
//             return res.status(400).json({ error: "Name is required" });
//         }
//         const offset = (parseInt(page) - 1) * parseInt(limit);
//         let params = [];
//         let conditions = ["p.Status = 1"];
//         let joinClauses = "";
//         let categoryFilter = categories && Array.isArray(categories) ? categories : [];

//         // if (name !== 'all'&& categoryFilter.length===0) {
//         //     categoryFilter.push(`SELECT CategoryID FROM tbl_category WHERE CatURL = ? AND SubCategoryLevel = 1`);
//         //     params.push(name);
//         // }
//         if (name !== 'all' && categoryFilter.length === 0) {
//             const [categoryResult] = await db.query(
//                 `SELECT CategoryID FROM tbl_category WHERE CatURL = ? AND SubCategoryLevel = 1`, 
//                 [name]
//             );
        
//             if (categoryResult.length > 0) {
//                 categoryFilter.push(...categoryResult.map(row => row.CategoryID));
//             }
//         }
        

//         // Convert category filter into SQL condition
//         if (categoryFilter.length!==0) {
//             conditions.push(`p.CategoryID IN (${categoryFilter.join(',')})`);
//         }

//         // Subcategory Filtering
//         if (subcategories && Object.values(subcategories).flat().length) {
//             const subCategoryFilter = Object.values(subcategories).flat().map(Number);
//             conditions.push(`p.SubCategoryIDone IN (${subCategoryFilter.map(() => '?').join(',')})`);
//             params.push(...subCategoryFilter);
//         }

//         // Price Range Filtering
//         if (Array.isArray(priceRange) && priceRange.length === 2) {
//             conditions.push(`p.CashPrice BETWEEN ? AND ?`);
//             params.push(priceRange[0], priceRange[1]);
//         }

//         // Attribute Filtering (Using EXISTS for efficiency)
//         if (attributes && typeof attributes === 'object' && Object.keys(attributes).length) {
//             Object.entries(attributes).forEach(([attrName, values]) => {
//                 if (Array.isArray(values) && values.length) {
//                     conditions.push(`
//                         EXISTS (
//                             SELECT 1 FROM tbl_productattribute pa
//                             JOIN attribute_values av ON av.id = pa.AttributeValueID
//                             JOIN attributes a ON a.id = av.attribute_id
//                             WHERE pa.ProductID = p.ProductID 
//                             AND a.attribute_name = ? 
//                             AND av.value IN (${values.map(() => '?').join(',')})
//                         )
//                     `);
//                     params.push(attrName, ...values);
//                 }
//             });
//         }

//         // Allowed sorting fields
//         const allowedSortFields = ["ProductName", "ProductPrice", "CashPrice"];
//         const sortColumn = allowedSortFields.includes(sortField) ? sortField : "ProductID";
//         const order = sortOrder === "asc" ? "ASC" : "DESC";

//         // Construct final SQL Query
//         let query = `
//             SELECT 
//                 p.ProductID, p.ProductName, p.Image, p.ProductPrice, 
//                 p.CashPrice, p.CategoryID, p.SubCategoryIDone, p.ProductUrl
//             FROM tbl_products p
//             JOIN tbl_category c ON p.CategoryID = c.CategoryID
//             ${joinClauses}
//             WHERE ${conditions.join(" AND ")}
//             ORDER BY p.${sortColumn} ${order} LIMIT ? OFFSET ?
//         `;  
          
//         params.push(parseInt(limit), offset);

//         console.log("Final Query:", query);
//         console.log("Query Parameters:", params);

//         const [data] = await db.query(query, params);

//         // Transform Data into Structured Format
//         const filterData = data.map(product => ({
//             ProductID: Buffer.from((product.ProductID ?? "").toString()).toString('base64'),
//             ProductName: product.ProductName ?? "",
//             Image: product.Image ?? "",
//             url: product.ProductUrl ?? "",
//             ProductPrice: product.ProductPrice ?? 0,
//             CashPrice: product.CashPrice ?? 0,
//             CategoryID: Buffer.from((product.CategoryID ?? "").toString()).toString('base64'),
//             SubCategoryIDone: product.SubCategoryIDone ?? null
//         }));

//         return res.status(200).json(filterData);

//     } catch (error) {
//         console.error("Error fetching products:", error);
//         return res.status(500).json({ error: "Internal Server Error", details: error.message });
//     }
// });

productsRoute.post('/sub-search', async (req, res, next) => {
    try {
        const { categories, subcategories, attributes, priceRange, sortField, sortOrder, name, page = 1, limit = 10 } = req.body;
        console.log("Page:", page, "Limit:", limit);

        if (!name || name === "undefined") {
            return res.status(400).json({ error: "Name is required" });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let params = [];
        let conditions = ["p.Status = 1"];
        let categoryFilter = categories && Array.isArray(categories) ? categories : [];

        if (name !== 'all' ) {
            const [categoryResult] = await db.query(
                `SELECT CategoryID FROM tbl_category WHERE CatURL = ? AND SubCategoryLevel = 1`, 
                [name]
            );

            if (categoryResult.length > 0) {
                categoryFilter.push(...categoryResult.map(row => row.CategoryID));
            }
        }

        // Convert category filter into SQL condition
        if (categoryFilter.length !== 0) {
            conditions.push(`p.CategoryID IN (${categoryFilter.join(',')})`);
        }

        // Subcategory Filtering
        if (subcategories && Object.values(subcategories).flat().length) {
            const subCategoryFilter = Object.values(subcategories).flat().map(Number);
            conditions.push(`p.SubCategoryIDone IN (${subCategoryFilter.map(() => '?').join(',')})`);
            params.push(...subCategoryFilter);
        }

        // Price Range Filtering
        if (Array.isArray(priceRange) && priceRange.length === 2) {
            conditions.push(`p.CashPrice BETWEEN ? AND ?`);
            params.push(priceRange[0], priceRange[1]);
        }

        // Attribute Filtering (Using EXISTS for efficiency)
        if (attributes && typeof attributes === 'object' && Object.keys(attributes).length) {
            Object.entries(attributes).forEach(([attrName, values]) => {
                if (Array.isArray(values) && values.length) {
                    conditions.push(`
                        EXISTS (
                            SELECT 1 FROM tbl_productattribute pa
                            JOIN attribute_values av ON av.id = pa.AttributeValueID
                            JOIN attributes a ON a.id = av.attribute_id
                            WHERE pa.ProductID = p.ProductID 
                            AND a.attribute_name = ? 
                            AND av.value IN (${values.map(() => '?').join(',')})
                        )
                    `);
                    params.push(attrName, ...values);
                }
            });
        }

        // Allowed sorting fields
        const allowedSortFields = ["ProductName", "ProductPrice", "CashPrice"];
        const sortColumn = allowedSortFields.includes(sortField) ? sortField : "ProductID";
        const order = sortOrder === "asc" ? "ASC" : "DESC";

        // Query to get total count of filtered products
        let countQuery = `
            SELECT COUNT(*) as total
            FROM tbl_products p
            JOIN tbl_category c ON p.CategoryID = c.CategoryID
            WHERE ${conditions.join(" AND ")}
        `;

        const [[{ total }]] = await db.query(countQuery, params);

        // Compute total pages
        const totalPages = Math.ceil(total / limit);

        // Construct final SQL Query with pagination
        let query = `
            SELECT 
                p.ProductID, p.ProductName, p.Image, p.ProductPrice, 
                p.CashPrice, p.CategoryID, p.SubCategoryIDone, p.ProductUrl
            FROM tbl_products p
            JOIN tbl_category c ON p.CategoryID = c.CategoryID
            WHERE ${conditions.join(" AND ")}
            ORDER BY p.${sortColumn} ${order} LIMIT ? OFFSET ?
        `;  

        params.push(parseInt(limit), offset);

        console.log("Final Query:", query);
        console.log("Query Parameters:", params);

        const [data] = await db.query(query, params);

        // Transform Data into Structured Format
        const filterData = data.map(product => ({
            ProductID: Buffer.from((product.ProductID ?? "").toString()).toString('base64'),
            ProductName: product.ProductName ?? "",
            Image: product.Image ?? "",
            url: product.ProductUrl ?? "",
            ProductPrice: product.ProductPrice ?? 0,
            CashPrice: product.CashPrice ?? 0,
            CategoryID: Buffer.from((product.CategoryID ?? "").toString()).toString('base64'),
            SubCategoryIDone: product.SubCategoryIDone ?? null
        }));

        return res.status(200).json({
            products: filterData,
            pagination: {
                total,
                currentPage: parseInt(page),
                totalPages
            }
        });

    } catch (error) {
        console.error("Error fetching products:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});


productsRoute.get('/price',async(req,res)=>{
    try{
        const [data]=await db.query(`SELECT MAX(cashPrice) AS maxPrice, MIN(cashPrice) AS minPrice FROM tbl_products `)
        res.status(200).json(data)
    }catch(error){
        console.error("Error fetching products by price range:",error)
        res.status(500).json({error:error.message})
    }
})




export default productsRoute