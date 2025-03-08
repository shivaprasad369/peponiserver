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

        const query = `
            SELECT 
                p.ProductName, f.name, p.ProductID, p.ProductUrl, p.ProductPrice, 
                p.CashPrice, p.CategoryID, c.CategoryName, p.Image, p.SubCategoryIDone, 
                f.position,
                COALESCE(
                    GROUP_CONCAT(
                        JSON_OBJECT(
                            'AttributeName', a.attribute_name,
                            'attributeValue', av.value,
                            'aid', a.id,
                            'attributeValuesId', av.id
                        )
                    ), 
                    '[]'
                ) AS attributeValues
            FROM tbl_featureproducts f
            JOIN tbl_products p ON f.ProductID = p.ProductID
            JOIN tbl_category c ON p.CategoryID = c.CategoryID
            LEFT JOIN tbl_productattribute pa ON pa.ProductID = p.ProductID
            LEFT JOIN attribute_values av ON av.id = pa.AttributeValueID
            LEFT JOIN attributes a ON av.attribute_id = a.id
            WHERE f.name = ? AND p.Status = 1
            GROUP BY p.ProductID, f.position
            ORDER BY f.position ASC;
        `;

        const [data] = await db.query(query, [collection.toString()]);

        // console.log("Fetched Data:", data);

        // ✅ Fixing JSON parsing issue caused by GROUP_CONCAT
        const filterData = data.map((item) => ({
            ProductID: Buffer.from(String(item.ProductID)).toString('base64'),
            ProductName: item.ProductName,
            url: item.ProductUrl,
            position: item.position,
            CategoryName: item.CategoryName,
            Image: item.Image,
            ProductPrice: item.ProductPrice,
            CashPrice: item.CashPrice,
            CategoryID: Buffer.from(String(item.CategoryID)).toString('base64'),
            SubCategoryIDone: item.SubCategoryIDone,
            attributeValues: JSON.parse(`[${item.attributeValues}]`) // ✅ Convert string to JSON array safely
        }));

        res.status(200).json(filterData);
    } catch (error) {
        console.error("❌ Error fetching collection:", error);
        res.status(500).json({ error: "Internal Server Error" });
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

        const filterData = new Map();

        result.forEach(item => {
            if (!filterData.has(item.CategoryID)) {
                filterData.set(item.CategoryID, {
                    CategoryID: item.CategoryID,
                    CategoryName: item.CategoryName,
                    Subcategories: new Map()
                });
            }
            const category = filterData.get(item.CategoryID);

            // **Check if SubcategoryID and SubcategoryName are valid before adding**
            if (item.SubcategoryID !== null && item.SubcategoryName !== null) {
                if (!category.Subcategories.has(item.SubcategoryID)) {
                    category.Subcategories.set(item.SubcategoryID, {
                        SubcategoryID: item.SubcategoryID,
                        SubcategoryName: item.SubcategoryName,
                        Attributes: new Map()
                    });
                }
                const subcategory = category.Subcategories.get(item.SubcategoryID);

                if (!subcategory.Attributes.has(item.attribute_name)) {
                    subcategory.Attributes.set(item.attribute_name, {
                        AttributeName: item.attribute_name,
                        Acid: item.Acid,
                        Ascid: item.Ascid,
                        AttributeValues: new Set()
                    });
                }
                const attribute = subcategory.Attributes.get(item.attribute_name);

                if (item.value) {
                    attribute.AttributeValues.add({
                        Value: item.value.trim(),
                        AttributeValueID: item.AttributeValueID
                    });
                }
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

homeRoute.get("/attri/attributess", async (req, res) => {
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
               
                value: []
            };
            acc.push(group);
        }
        group.value.push({
            value: item.value,
         
        });
    
        return acc;
    }, []);
    console.log(result)
    res.status(200).json(groupedData);
    
});
homeRoute.get("/search", async (req, res) => {
    const { query, limit = 6 } = req.query; // Get search query & limit from URL params
  
    if (!query) {
        return res.status(400).json({ error: "Search query is required" });
    }

    try {
        const searchTerm = `%${query}%`; // Wildcards for partial matching
        const limitValue = parseInt(limit);

        // Search in Products
        const sqlProducts = `SELECT * FROM tbl_products 
                            WHERE ProductName LIKE ? OR Description LIKE ? 
                            OR MetaDescription LIKE ? OR MetaKeyWords LIKE ?
                            ORDER BY ProductName LIMIT ?`;
        const [products] = await db.query(sqlProducts, 
                                            [searchTerm, searchTerm, searchTerm, searchTerm, limitValue]);

        // Search in Categories
        const sqlCategories = `SELECT * FROM tbl_category
                               WHERE CategoryName LIKE ? OR KeyWord LIKE ? 
                               OR Description LIKE ? OR Title LIKE ?
                               ORDER BY CategoryName LIMIT ?`;
        const [categories] = await db.query(sqlCategories, 
                                              [searchTerm, searchTerm, searchTerm, searchTerm, limitValue]);

        // Constructing Response
        res.json({
            products: { results: products, link: "/detail" },
            categories: { results: categories, link: "/product" }
        });
        
    } catch (error) {
        console.error("Error fetching search results:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



  homeRoute.get('/quantity',async(req,res)=>{
    try{
        const {cartNumber,email}=req.query;
        let checkQuery=``
        let checkParams=[]

        if(email){
            checkQuery+='SELECT COUNT(*) as total FROM tbl_finalcart WHERE UserEmail=?'
            checkParams.push(email)
        }
        else{
            checkQuery+='SELECT COUNT(*) as total FROM tbl_tempcart WHERE CartNumber=?'
            checkParams.push(cartNumber)
        }
      const [result] = await db.query(checkQuery,checkParams);
      res.status(200).json({message:'Quantity fetched successfully',result:result});
    }catch(error){
      console.error('Error fetching quantity:',error);
      res.status(500).json({error:error.message});
    }
  })

  homeRoute.get('/dashboard', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        const [results] = await db.query(
            `SELECT o.OrderNumber, 
                    o.OrderDate, 
                    fm.OrderStatus, 
                    p.ProductID, 
                    p.ProductName, 
                    p.Image AS ProductImages,
                    o.Qty AS Quantities, 
                    o.Price, 
                    o.ItemTotal
             FROM tbl_order o 
             JOIN tbl_finalmaster fm ON o.OrderNumber COLLATE utf8mb4_unicode_ci = fm.OrderNumber 
             LEFT JOIN tbl_products p ON p.ProductID = o.ProductID
             
             WHERE o.UserEmail = ?`,
            [email]
        );
        console.log(results)
        if (results.length === 0) {
            return res.status(404).json({ message: "No orders found for this user" });
        }

        // Group orders by OrderNumber and format products, while calculating the total
        const formattedResults = results.reduce((acc, order) => {
            const existingOrder = acc.find(o => o.OrderNumber === order.OrderNumber);

            if (existingOrder) {
                existingOrder.Products.push({
                    ProductImages:  order.ProductImages,  // Add prefix for image path
                    ProductID: order.ProductID,
                    Quantities: order.Quantities,
                    Price: order.Price,
                    ItemTotal: Number(order.ItemTotal)
                });

                // Add the ItemTotal to the order's Total
                existingOrder.Total += Number(order.ItemTotal);
            } else {
                acc.push({
                    OrderNumber: order.OrderNumber,
                    OrderDate: new Date(order.OrderDate).toLocaleDateString(),  // Format OrderDate
                    OrderStatus: order.OrderStatus,
                    Total: Number(order.ItemTotal),  // Initialize Total with the first item's total
                    Products: [{
                        ProductImages:  order.ProductImages,  // Add prefix for image path
                        ProductID: order.ProductID,
                        Quantities: order.Quantities,
                        Price: order.Price,
                        ItemTotal: order.ItemTotal
                    }],
                   
                });
            }

            return acc;
        }, []);

        res.status(200).json({ message: 'Dashboard fetched successfully', result: formattedResults });
    } catch (error) {
        console.log('Error fetching dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});
homeRoute.get('/dashboard/product', async (req, res) => {
    const { email, id } = req.query;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        // Fetch order details from the database
        const [results] = await db.query(
            `SELECT o.OrderNumber, 
                    o.OrderDate, 
                    fm.*, 
                    p.ProductID, 
                    p.ProductName, 
                    p.Image AS ProductImages,
                    o.Qty AS Quantities, 
                    o.Price, 
                    o.ItemTotal
             FROM tbl_order o 
             JOIN tbl_finalmaster fm ON o.OrderNumber COLLATE utf8mb4_unicode_ci = fm.OrderNumber 
             LEFT JOIN tbl_products p ON p.ProductID = o.ProductID
             WHERE o.UserEmail = ? AND fm.OrderNumber = ?`,
            [email, id]
        );

        // Check if results are empty
        if (results.length === 0) {
            return res.status(404).json({ message: "No orders found for this user" });
        }

        // Format and group the orders by OrderNumber
        const formattedResults = results.reduce((acc, order) => {
            const existingOrder = acc.find(o => o.OrderNumber === order.OrderNumber);

            if (existingOrder) {
                existingOrder.Products.push({
                    ProductImages: order.ProductImages,  // Add prefix for image path
                    ProductID: order.ProductID,
                    Quantities: order.Quantities,
                    Price: order.Price,
                    ItemTotal: order.ItemTotal,
                    ProductName: order.ProductName
                     // Include other fields like stripeid, etc.
                });

                // Add the ItemTotal to the order's Total
                existingOrder.Total += order.ItemTotal;
            } else {
                // If the order is not found, create a new entry in the accumulator
                acc.push({
                    OrderNumber: order.OrderNumber,
                    OrderDate: new Date(order.OrderDate).toLocaleDateString(), // Format the date
                    OrderStatus: order.OrderStatus,
                    Total: order.ItemTotal,  
                    stripeid: order.stripeid,
                    ...order,
                    // Include other fields like info from tbl_finalmaster
                    Products: [{
                        ProductImages: order.ProductImages , // Add prefix for image path
                        ProductID: order.ProductID,
                        Quantities: order.Quantities,
                    ProductName: order.ProductName,

                        Price: order.Price,
                        ItemTotal: order.ItemTotal
                    }]
                });
            }

            return acc;
        }, []);

        // Send the formatted response
        res.status(200).json({ message: 'Dashboard fetched successfully', result: formattedResults });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});
homeRoute.get('/dashboard/products/:id', async (req, res) => {
    const { id } = req.params;

    

    try {
        // Fetch order details from the database
        const [results] = await db.query(
            `SELECT 
        o.OrderNumber, 
        o.OrderDate, 
        fm.OrderStatus as Status,
        fm.*, 
        p.ProductID, 
        p.ProductName, 
        p.Image AS ProductImages,
        o.Qty AS Quantities, 
        o.Price, 
        o.ItemTotal,
        h.*
    FROM tbl_order o 
    JOIN tbl_finalmaster fm 
        ON CONVERT(o.OrderNumber USING utf8mb4) = CONVERT(fm.OrderNumber USING utf8mb4)  
    LEFT JOIN tbl_products p 
        ON CONVERT(p.ProductID USING utf8mb4) = CONVERT(o.ProductID USING utf8mb4) 
    LEFT JOIN tbl_OrderStatusHistory h 
        ON CONVERT(h.OrderNo USING utf8mb4) = CONVERT(fm.OrderNumber USING utf8mb4)  
    WHERE CONVERT(fm.OrderNumber USING utf8mb4) = ?
             `,
            [id]
        );

        // Check if results are empty
        if (results.length === 0) {
            return res.status(404).json({ message: "No orders found for this user" });
        }
       

// console.log(results)
        // Format and group the orders by OrderNumber
        const formattedResults = results.reduce((acc, order) => {
            let existingOrder = acc.find(o => o.OrderNumber === order.OrderNumber);

            if (!existingOrder) {
                // Create a new order entry
                existingOrder = {
                    OrderNumber: order.OrderNumber,
                    OrderDate: new Date(order.OrderDate).toLocaleDateString(),
                    Status: order.Status,
                    Total: 0,
                    stripeid: order.stripeid,
                    Products: [],
                    History: [],
                    // Keep all other columns from tbl_finalmaster
                    ...order
                };
                acc.push(existingOrder);
            }

            // ✅ Ensure unique products in the order
            if (!existingOrder.Products.some(p => p.ProductID === order.ProductID)) {
                existingOrder.Products.push({
                    ProductImages: order.ProductImages,
                    ProductID: order.ProductID,
                    Quantities: order.Quantities,
                    ProductName: order.ProductName,
                    Price: order.Price,
                    ItemTotal: parseFloat(order.ItemTotal)
                });

                // ✅ Add ItemTotal to Total
                existingOrder.Total += parseFloat(order.ItemTotal);
            }

            // ✅ Ensure unique history records
            if (!existingOrder.History.some(h => h.OrderStatus === order.OrderStatus && h.date === order.OrderStatusDate)) {
                existingOrder.History.push({
                    OrderStatus: order.OrderStatus,
                    date: order.OrderStatusDate,
                    remark: order.OrderRemark
                });
            }

            return acc;
        }, []);


        // Send the formatted response
        res.status(200).json({ message: 'Dashboard fetched successfully', result: formattedResults });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});




homeRoute.get('/CatID',async(req,res)=>{
    try {
        const CatID = req.query.name;
        const [results] = await db.query('SELECT CategoryID FROM tbl_category WHERE CatURL=? AND SubCategoryLevel=1',[CatID]);
        res.status(200).json({message:'Category fetched successfully',result:results});
        
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: error.message });
        }
})

homeRoute.get("/check", async (req, res) => {
    try {
      const { name,id } = req.query;
      if (!name) return res.status(400).json({ error: "Category name is required" });
        if(id){
            const [result] = await db.query("SELECT * FROM tbl_category WHERE CategoryName = ? AND CategoryId!=?", [name,id]);
            return res.json({ exists: result.length > 0 });  
        }
      // Use 'await' to get the result
      const [result] = await db.query("SELECT * FROM tbl_category WHERE CategoryName = ?", [name]);
  
      return res.json({ exists: result.length > 0 });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
      


export default homeRoute;
