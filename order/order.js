import express from "express";
import db from "../db/db.js";


const orderRoute=express.Router();
orderRoute.get('/:id', async (req, res) => {
    const { id } = req.params;
    let { page = 1, limit = 10, search = "" } = req.query; // Default: Page 1, 10 items per page

    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    try {
        // Fetch order details with pagination and search
        const [results] = await db.query(
            `SELECT o.OrderNumber, 
                    o.OrderDate, 
                    fm.UserEmail,
                    fm.BillingFirstname,
                    fm.BillingLastname,
                    fm.OrderStatus,
                    o.Qty AS Quantities, 
                    o.Price, 
                    o.ItemTotal
             FROM tbl_order o 
             JOIN tbl_finalmaster fm ON o.OrderNumber COLLATE utf8mb4_unicode_ci = fm.OrderNumber
             WHERE fm.OrderStatus = ? 
               AND (fm.UserEmail LIKE ? 
                    OR fm.BillingFirstname LIKE ? 
                    OR fm.BillingLastname LIKE ? 
                    OR o.OrderNumber LIKE ?)
             GROUP BY o.OrderNumber 
             LIMIT ? OFFSET ?`, 
            [id, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, limit, offset]
        );

        // Get total count for pagination
        const [[{ totalCount }]] = await db.query(
            `SELECT COUNT(DISTINCT o.OrderNumber) AS totalCount 
             FROM tbl_order o 
             JOIN tbl_finalmaster fm ON o.OrderNumber COLLATE utf8mb4_unicode_ci = fm.OrderNumber
             WHERE fm.OrderStatus = ? 
               AND (fm.UserEmail LIKE ? 
                    OR fm.BillingFirstname LIKE ? 
                    OR fm.BillingLastname LIKE ? 
                    OR o.OrderNumber LIKE ?)`,
            [id, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: "No orders found" });
        }

        res.status(200).json({
            message: 'Orders fetched successfully',
            result: results,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalRecords: totalCount
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: error.message });
    }
});

orderRoute.get('/detail/:id', async (req, res) => {
    const { id } = req.params;
    if(!id){
        return res.status(400).json({ message: "Order ID is required" });
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
             WHERE fm.OrderNumber = ?`,
            [id]
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
export default orderRoute