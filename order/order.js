import express from "express";
import db from "../db/db.js";
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const orderRoute=express.Router();

orderRoute.get('/', async (req, res) => {
    try {
        // Fetch top 10 most recent orders
        const [results] = await db.query(
            `SELECT 
                o.OrderNumber, 
                MAX(o.OrderDate) AS OrderDate, 
                fm.UserEmail,
                fm.BillingFirstname,
                fm.BillingLastname,
                fm.OrderStatus,
                SUM(o.Qty) AS TotalQuantities,
                SUM(o.Price) AS TotalPrice,   
                SUM(o.ItemTotal) AS TotalItemTotal
            FROM tbl_order o 
            JOIN tbl_finalmaster fm 
                ON o.OrderNumber COLLATE utf8mb4_unicode_ci = fm.OrderNumber
            GROUP BY 
                o.OrderNumber, 
                fm.UserEmail, 
                fm.BillingFirstname, 
                fm.BillingLastname, 
                fm.OrderStatus
            ORDER BY MAX(o.OrderDate) DESC  -- Sorting by recent orders
            LIMIT 10` // Fetch only 10 orders
        );

        // Check if no results found
        if (results.length === 0) {
            return res.status(404).json({ message: "No recent orders found" });
        }

        // Send response
        res.status(200).json({
            message: 'Top 10 recent orders fetched successfully',
            result: results
        });
    } catch (error) {
        console.error('Error fetching recent orders:', error);
        res.status(500).json({ error: error.message });
    }
});


orderRoute.get('/sale',async(req,res)=>{
    try {
        // Fetch total sales
        const [sales] = await db.query(
            `SELECT 
    c.CategoryID, 
    c.CategoryName, 
    COUNT(o.OrderNumber) AS TotalOrders,
    COALESCE(SUM(o.Qty), 0) AS TotalQuantity, 
    COALESCE(SUM(o.ItemTotal), 0) AS TotalSales
FROM tbl_category c
LEFT JOIN tbl_products p ON c.CategoryID = p.CategoryID
LEFT JOIN tbl_order o ON p.ProductID = o.ProductID
WHERE c.SubCategoryLevel=1
GROUP BY c.CategoryID, c.CategoryName
ORDER BY TotalSales DESC`
        );
        
        // Check if no results found
        if (sales.length === 0) {
            return res.status(404).json({ message: "No sales data found" });
        }
        
        // Send response
        res.status(200).json({
            message: 'Sales data fetched successfully',
            result: sales
        });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).json({ error: error.message });
   


}
})

orderRoute.get('/:id', async (req, res) => {
    const { id } = req.params;
    let { page = 1, limit = 10, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    try {
        // Fetch orders without GROUP BY
        const [results] = await db.query(
            `SELECT 
    o.OrderNumber, 
    MAX(o.OrderDate) AS OrderDate, 
    fm.UserEmail,
    fm.BillingFirstname,
    fm.BillingLastname,
    fm.OrderStatus,
    SUM(o.Qty) AS TotalQuantities,
    SUM(o.Price) AS TotalPrice,   
    SUM(o.ItemTotal) AS TotalItemTotal
FROM tbl_order o 
JOIN tbl_finalmaster fm 
  ON o.OrderNumber COLLATE utf8mb4_unicode_ci = fm.OrderNumber
WHERE fm.OrderStatus = ? 
  AND (
      fm.UserEmail LIKE ? 
      OR fm.BillingFirstname LIKE ? 
      OR fm.BillingLastname LIKE ? 
      OR o.OrderNumber LIKE ?
  )
GROUP BY 
    o.OrderNumber, 
    fm.UserEmail, 
    fm.BillingFirstname, 
    fm.BillingLastname, 
    fm.OrderStatus
ORDER BY MAX(o.OrderDate) DESC 
LIMIT ? OFFSET ?

`, 
            [id, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, limit, offset]
        );

        // Manually group orders in JavaScript
        const groupedOrders = results.reduce((acc, order) => {
            if (!acc[order.OrderNumber]) {
                acc[order.OrderNumber] = {
                    OrderNumber: order.OrderNumber,
                    OrderDate: order.OrderDate,
                    UserEmail: order.UserEmail,
                    BillingFirstname: order.BillingFirstname,
                    BillingLastname: order.BillingLastname,
                    OrderStatus: order.OrderStatus,
                    Products: []
                };
            }
            acc[order.OrderNumber].Products.push({
                Quantities: order.TotalQuantities   ,
                Price: order.TotalPrice,
                ItemTotal: order.TotalItemTotal
            });
            return acc;
        }, {});

        // Convert object to array
        const groupedOrdersArray = Object.values(groupedOrders);

        // Get total count for pagination
        const [[{ totalCount }]] = await db.query(
            `SELECT COUNT(DISTINCT o.OrderNumber) AS totalCount 
             FROM tbl_order o 
             JOIN tbl_finalmaster fm 
               ON o.OrderNumber COLLATE utf8mb4_unicode_ci = fm.OrderNumber
             WHERE fm.OrderStatus = ? 
               AND (fm.UserEmail LIKE ? 
                    OR fm.BillingFirstname LIKE ? 
                    OR fm.BillingLastname LIKE ? 
                    OR o.OrderNumber LIKE ?)`,
            [id, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
        );

        if (groupedOrdersArray.length === 0) {
            return res.status(404).json({ message: "No orders found" });
        }

        res.status(200).json({
            message: 'Orders fetched successfully',
            result: groupedOrdersArray,
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

// orderRoute.put('/', async (req, res) => {
//     const connection = await db.getConnection(); // Get DB connection
//     try {
//         const { OrderNumber, Remark, UserEmail, OrderStatus } = req.body;
//         if (!OrderNumber || !Remark || !OrderStatus || !UserEmail) {
//             return res.status(400).json({ message: "All fields are required" });
//         }

//         await connection.beginTransaction(); // Start transaction

//         // Lock the order row to prevent race conditions
//         const [orderCheck] = await connection.query(
//             `SELECT OrderNumber FROM tbl_finalmaster WHERE OrderNumber = ? FOR UPDATE`, 
//             [OrderNumber]
//         );

//         if (orderCheck.length === 0) {
//             await connection.rollback();
//             return res.status(404).json({ message: "Order not found" });
//         }

//         // Update order status
//         const [updateResult] = await connection.query(
//             `UPDATE tbl_finalmaster SET OrderStatus = ?, OrderComments = ? WHERE OrderNumber = ?`, 
//             [OrderStatus, Remark, OrderNumber]
//         );

//         if (updateResult.affectedRows === 0) {
//             await connection.rollback();
//             return res.status(500).json({ message: "Failed to update order" });
//         }
//         const [getId]=await connection.query(`
//             SELECT FinalMasterId FROM tbl_finalmaster WHERE OrderNumber =?`,
//             [OrderNumber]
            
//             )
//             if(getId.length===0){
//                 await connection.rollback();
//                 return res.status(404).json({ message: "Failed to get FinalMasterId" });
//             }
//         // Insert order status history
//         const [historyResult] = await connection.query(
//             `INSERT INTO tbl_OrderStatusHistory (OrderNo,FinalMasterId, OrderStatus, OrderRemark, OrderStatusDate)
//              VALUES (?,?, ?, ?, NOW())`,
//              [OrderNumber, getId[0].FinalMasterId, OrderStatus, Remark]
       
//         );

//         if (historyResult.affectedRows === 0) {
//             await connection.rollback();
//             return res.status(500).json({ message: "Failed to add status history" });
//         }

//         await connection.commit(); // Commit transaction
//         const mailOptions = {
//             from: process.env.EMAIL_USER,
//             to: UserEmail,
//             subject: 'Order Status Changed',
//             text: `order number: ${OrderNumber} ${OrderStatus}`,
//           };
      
//           await transporter.sendMail(mailOptions);
//         res.status(200).json({ message: "Order status updated successfully" });

//     } catch (error) {
//         await connection.rollback(); // Rollback if an error occurs
//         console.error('Error updating order status:', error);
//         res.status(500).json({ error: error.message });
//     } finally {
//         connection.release(); // Release connection back to the pool
//     }
// });
orderRoute.put('/', async (req, res) => {
    const connection = await db.getConnection(); // Get DB connection
    try {
        const { OrderNumber, Remark, UserEmail, OrderStatus } = req.body;

        if (!OrderNumber || !Remark || OrderStatus === undefined || !UserEmail) {
            return res.status(400).json({ message: "All fields are required" });
        }

        await connection.beginTransaction(); // Start transaction

        // Lock the order row to prevent race conditions
        const [orderCheck] = await connection.query(
            `SELECT OrderNumber, FinalMasterId FROM tbl_finalmaster WHERE OrderNumber = ? FOR UPDATE`, 
            [OrderNumber]
        );

        if (orderCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Order not found" });
        }

        const FinalMasterId = orderCheck[0].FinalMasterId;

        // Update order status
        const [updateResult] = await connection.query(
            `UPDATE tbl_finalmaster SET OrderStatus = ?, OrderComments = ? WHERE OrderNumber = ?`, 
            [OrderStatus, Remark, OrderNumber]
        );

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(500).json({ message: "Failed to update order" });
        }

        // Insert order status history
        const [historyResult] = await connection.query(
            `INSERT INTO tbl_OrderStatusHistory (OrderNo, FinalMasterId, OrderStatus, OrderRemark, OrderStatusDate)
             VALUES (?, ?, ?, ?, NOW())`,
            [OrderNumber, FinalMasterId, OrderStatus, Remark]
        );

        if (historyResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(500).json({ message: "Failed to add status history" });
        }

        await connection.commit(); // Commit transaction

        // Order Status Mapping
        const getOrderStatusText = (status) => {
            switch (status) {
                case 0: return "Order Placed";
                case 1: return "Order Accepted";
                case 2: return "Order Shipped";
                case 3: return "Order Delivered";
                default: return "Order Updated";
            }
        };

        const orderStatusText = getOrderStatusText(OrderStatus);

        // HTML Email Template
        const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; text-align: center; }
                .container { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); }
                .status { font-weight: bold; color: #007bff; }
                .footer { font-size: 12px; color: #777; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h3>Order Status Update</h3>
                <p>Your order <strong>#${OrderNumber}</strong> is now: <span class="status">${orderStatusText}</span></p>
                <p>Remark: ${Remark}</p>
                <p>Thank you for choosing us!</p>
                <div class="footer">&copy; Team pepony gallery</div>
            </div>
        </body>
        </html>
        `;

        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: UserEmail,
            subject: `Order #${OrderNumber} Status Updated`,
            html: htmlTemplate
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Order status updated successfully" });

    } catch (error) {
        await connection.rollback(); // Rollback if an error occurs
        console.error('Error updating order status:', error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    } finally {
        connection.release(); // Release connection back to the pool
    }
});

export default orderRoute