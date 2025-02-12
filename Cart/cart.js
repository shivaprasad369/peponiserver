
import express, { query } from "express";
import db from "../db/db.js";

const cartRoute=express.Router()


cartRoute.get("/generate-id", (req, res) => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
    const secondsStr = now.getSeconds().toString().padStart(2, '0'); // Get seconds with 2 digits
    const uniqueId = `${dateStr}${timeStr}${secondsStr}`;
    res.json({ id: uniqueId });
  });
  cartRoute.get("/get-cart-by-number", async (req, res) => {
    const { cartNumber, user,email } = req.query;
    if (!cartNumber ) {
      return res.status(400).json({ error: "Invalid or missing CartNumber" });
    }
    if (user && isNaN(Number(user))) {
      return res.status(400).json({ error: "Invalid User ID" });
    }
    try {   
      let query = `
        SELECT 
          p.SellingPrice,
          p.Image,
          tc.*,
          p.Stock,
          p.ProductName,
          p.ProductPrice,
          c.CategoryName
        FROM tbl_products p
        JOIN tbl_tempcart tc ON p.ProductID = tc.ProductID
        JOIN tbl_category c ON c.CategoryID = p.CategoryID
      `;
  
      let queryParams = [];
  
      if (email) {
        query += `WHERE tc.UserEmail = ?`;
        queryParams.push(email);
      } else {
        query += `WHERE tc.CartNumber = ? AND tc.UserID=?`;
        queryParams.push(cartNumber,user);
      }
  
      const [rows] = await db.query(query, queryParams);
  // console.log(rows)
      if (rows.length === 0) {
        return res.status(404).json({ message: "No cart items found" });
      }
  
      return res.status(200).json({
        message: "Cart items retrieved successfully",
        data: rows,
      });
    } catch (error) {
      console.error("Error retrieving cart data:", error);
      return res.status(500).json({ error: "An unexpected error occurred" });
    }
  });
  
  cartRoute.get("/get-updated-cart", async (req, res) => {
    const { cartNumber, email } = req.query;
  
    try {
      if (!cartNumber || !email) {
        return res.status(400).json({ error: "CartNumber and userId are required." });
      }
      const [rows] = await db.query(
        `
          SELECT 
            p.SellingPrice,
            p.Image,
            tc.*,
            p.ProductName,
            p.ProductPrice 
          FROM tbl_products p
          JOIN tbl_tempcart tc ON p.ProductID = tc.ProductID
          WHERE tc.UserEmail = ? OR tc.CartNumber=? 
          GROUP BY tc.ProductAttributeID
        `,
        [email,cartNumber]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: "No cart items found for the given user." });
      }
      const insertData = rows.map((row) => [
        userId, 
        row.ProductID, 
        row.Price, 
        row.Qty, 
        row.ProductPrice,
        row.Price * row.Qty,
        0,
        `SUB${Date.now()}${row.ProductID}`,
        row.Price * row.Qty, 
        1,
        0
      ]);
      const insertQuery = `
        INSERT INTO tbl_finalcart 
        (UserID, ProductID, Price, Qty, ItemTotal, OrderDate, VedorProdStatus, SubOrderNo, ItemTotalVoucherprice, WebsiteType, Voucherprice)
        VALUES ?
      `;
  
      await db.query(insertQuery, [insertData]);
  
      // Return success response
      res.status(200).json({
        message: "Cart updated successfully.",
        insertedItems: insertData.length,
      });
    } catch (error) {
      console.error("Error updating cart data:", error);
      res.status(500).json({ error: "Failed to update cart data." });
    }
  });
  cartRoute.post("/store-cart", async (req, res) => {
    const { cartItems, email } = req.body;
    const { id } = req.query;

    if (!cartItems || !cartItems.CartNumber || !cartItems.ProductAttributeID || !cartItems.ProductID) {
        return res.status(400).json({ error: "CartNumber, ProductAttributeID, and ProductID are required." });
    }

    try {
        
        const decodedProductID = Buffer.from(cartItems.ProductID, "base64").toString("utf-8");
        const [stockResult] = await db.execute(
            "SELECT Stock FROM tbl_products WHERE ProductID = ?",
            [decodedProductID]
        );

        if (stockResult.length === 0) {
            return res.status(404).json({ error: "Product not found." });
        }

        const stockAvailable = stockResult[0].Stock;

        // Build query to check existing items in the cart
        let checkQuery = ``;
        let checkParams = [ ];
          // console.log(email,id)
        if  (email) {
          checkQuery += "SELECT Qty FROM tbl_tempcart WHERE ProductAttributeID = ? AND  UserEmail=?";
          checkParams.push(cartItems.ProductAttributeID,email);
      } else {
        checkQuery += "SELECT Qty FROM tbl_tempcart WHERE CartNumber=? AND ProductAttributeID = ? AND UserID=? ";
            checkParams.push(cartItems.CartNumber,cartItems.ProductAttributeID,1);
        }

        const [existingItems] = await db.execute(checkQuery, checkParams);

        if (existingItems.length > 0) {
            const existingQty = existingItems[0].Qty;
            const newQty = existingQty + cartItems.Qty;

            // Check if stock is sufficient
            if (newQty > stockAvailable) {
                return res.status(400).json({ message: "Insufficient stock", stock: stockAvailable });
            }

            // Update existing cart item quantity
            const itemTotal = newQty * cartItems.Price;
            let updateQuery = `
            UPDATE tbl_tempcart SET Qty = ?, ItemTotal = ?
            WHERE ${email ? "UserEmail = ?" : "CartNumber = ?"} 
            AND ProductAttributeID = ?`;
            let updateParams = [newQty, itemTotal, email || cartItems.CartNumber, cartItems.ProductAttributeID];

          //   if  (email) {
          //     checkQuery += " AND UserEmail = ? AND UserID=? ";
          //     checkParams.push(email,2);
          // } else {
          //       checkQuery += " AND UserID=? ";
          //       checkParams.push(1);
          //   }
    

            const [result]= await db.execute(updateQuery, updateParams);
            if(result.affectedRows>0) {
                return res.status(200).json({ message: "Cart item quantity updated successfully",id: result.insertId });
            } else {
                return res.status(500).json({ error: "Failed to update cart item" });
            }
            
        } else {
            // If item doesn't exist, insert a new cart entry
            if (cartItems.Qty > stockAvailable) {
                return res.status(400).json({ message: "Insufficient stock", stock: stockAvailable });
            }
            const userId=id ||null
            const values = [
                userId,
                email || null,
                cartItems.CartNumber,
                decodedProductID,
                cartItems.ProductAttributeID,
                cartItems.Price || 0,
                cartItems.Qty || 1,
                cartItems.Price * cartItems.Qty || 0,
                cartItems.TranxRef || `TRX-${Date.now()}`,
                new Date(),
                cartItems.Voucherprice || 0,
            ];

            const insertQuery = `
                INSERT INTO tbl_tempcart (UserID, UserEmail, CartNumber, ProductID, ProductAttributeID, 
                    Price, Qty, ItemTotal, TranxRef, CartDate, Voucherprice) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

           const [result]= await db.execute(insertQuery, values);
            if(result.affectedRows>0) {
                return res.status(200).json({ message: "Cart item stored successfully",id: result.insertId });
            } else {
                return res.status(500).json({ error: "Failed to store cart item" });
            }
           
        }
    } catch (error) {
        console.log("Error storing cart item:", error);
        return res.status(500).json({ error: "Failed to store cart item" });
    }
});

      
  cartRoute.put("/update-quantity", async (req, res) => {
    const { id, userId, number, email } = req.body;
  
    if (!id || !userId || !number || !number.qty || !number.action) {
      return res.status(400).json({
        error: "id, userId, number.qty, and number.action are required.",
      });
    }
  
    if (!["increment", "decrement"].includes(number.action)) {
      return res
        .status(400)
        .json({ error: 'Invalid action. Use "increment" or "decrement".' });
    }
    try {
      const operation = number.action === "increment" ? "+" : "-";
      const [updateResult] = await db.execute(
        `UPDATE tbl_tempcart 
         SET Qty = GREATEST(0, Qty ${operation} ?), 
             ItemTotal = Price * GREATEST(0, Qty ${operation} ?) 
         WHERE ProductAttributeID = ? AND TempCartID = ? AND UserEmail=?`,
        [number.qty, number.qty, id, userId, email]
      );
  
      if (updateResult.affectedRows > 0) {
        // Re-fetch the current quantity after update
        const [checkResult] = await db.execute(
          `SELECT Qty FROM tbl_tempcart 
           WHERE ProductAttributeID = ? AND TempCartID = ?`,
          [id, userId]
        );
        if (checkResult.length > 0 && checkResult[0].Qty === 0) {
          // If quantity is 0, delete the item
          await db.execute(
            `DELETE FROM tbl_tempcart 
             WHERE ProductAttributeID = ? AND TempCartID = ? AND UserEmail=?`,
            [id, userId,email]
          );
          return res.status(200).json({ message: "Item deleted as quantity reached 0" });
        }
  
        return res.status(200).json({ message: "Quantity updated successfully" });
      } else {
        return res.status(404).json({ error: "Product not found in cart" });
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      return res.status(500).json({ error: "Failed to update quantity" });
    }
  });
  
  cartRoute.put('/update-cart-user', async (req, res) => {
    const { cartNumber, email, user } = req.body;
    
    if (!cartNumber || !email) {
        return res.status(400).json({ message: "Cart number and email are required." });
    }

    try {
        const [getUserData] = await db.execute(
            `SELECT * FROM tbl_tempcart WHERE CartNumber = ?`, 
            [cartNumber]
        );

        if (getUserData.length === 0) {
            return res.status(404).json({ message: "No items found in the cart." });
        }

        for (const cart of getUserData) {
            const { ProductID, Qty } = cart;
            const [existingCartItem] = await db.execute(
                `SELECT * FROM tbl_tempcart WHERE ProductID = ? AND UserEmail = ?`, 
                [ProductID, email]
            );

            let result; 

            if (existingCartItem.length > 0) {
               
                const newQty = Qty;
                [result] = await db.execute(
                    `UPDATE tbl_tempcart 
                     SET Qty = ? 
                     WHERE UserEmail = ? AND ProductID = ? `,
                    [newQty, email, ProductID]
                );
            } else {
                [result] = await db.execute(
                    `UPDATE tbl_tempcart 
                     SET UserID = ?, UserEmail = ? 
                     WHERE ProductID = ? AND CartNumber = ?`,
                    [2, email, ProductID, cartNumber]
                );
            }
            if (result.affectedRows > 0) {
                await db.execute(
                    `DELETE FROM tbl_tempcart 
                     WHERE ProductID = ? AND CartNumber = ? AND UserID = ?`,
                    [ProductID, cartNumber, 1]
                );
            }
        }

        return res.status(200).json({ message: "Cart updated successfully." });

    } catch (error) {
        console.error("Error updating cart:", error);
        return res.status(500).json({ message: "Error updating cart", error });
    }
});


    cartRoute.delete("/delete-cart-item", async (req, res) => {
      const { id} = req.query; // Use req.query instead of req.params
    
      if (!id) {
        return res
          .status(400)
          .json({ error: "id is required." });
      }
    
      try {
        const [result] = await db.execute(
          `DELETE FROM tbl_tempcart 
           WHERE TempCartID=?`,
          [id]
        );
    
        if (result.affectedRows > 0) {
          return res.status(200).json({ message: "Cart item deleted successfully" });
        } else {
          return res.status(404).json({ error: "Cart item not found" });
        }
      } catch (error) {
        console.error("Error deleting cart item:", error);
        return res.status(500).json({ error: "Failed to delete cart item" });
      }
    });


export default cartRoute