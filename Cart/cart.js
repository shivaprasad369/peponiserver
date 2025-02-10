
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
    const { cartNumber, user } = req.query;
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
  
      if (user) {
        query += `WHERE tc.UserID = ?`;
        queryParams.push(user);
      } else {
        query += `WHERE tc.CartNumber = ? AND tc.UserID=?`;
        queryParams.push(cartNumber,1);
      }
  
      const [rows] = await db.query(query, queryParams);
  console.log(rows)
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
    const { cartNumber, userId } = req.query;
  
    try {
      if (!cartNumber || !userId) {
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
          WHERE tc.UserID = ?
          GROUP BY tc.ProductAttributeID
        `,
        [userId]
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
    const { cartItems } = req.body;
    const { id } = req.query;
  
    if (!cartItems || !cartItems.CartNumber || !cartItems.ProductAttributeID || !cartItems.ProductID) {
      return res.status(400).json({ error: "CartNumber, ProductAttributeID, and ProductID are required." });
    }
  
    try {
      // Decode ProductID from base64
      const decodedProductID = Buffer.from(cartItems.ProductID, "base64").toString("utf-8");
  
      // Check stock availability
      const [stockResult] = await db.execute(
        "SELECT Stock FROM tbl_products WHERE ProductID = ?",
        [decodedProductID]
      );
  
      if (stockResult.length === 0) {
        return res.status(404).json({ error: "Product not found." });
      }
  
      const stockAvailable = stockResult[0].Stock;
  
      // Check if the product already exists in the cart
      const [existingItems] = await db.execute(
        `SELECT Qty FROM tbl_tempcart 
         WHERE CartNumber = ? AND ProductAttributeID = ? AND UserID = ?`,
        [cartItems.CartNumber, cartItems.ProductAttributeID, id]
      );
  
      if (existingItems.length > 0) {
        const existingQty = existingItems[0].Qty;
        const newQty = existingQty + cartItems.Qty;
  
        // Check if stock is sufficient
        if (newQty > stockAvailable) {
          return res.status(400).json({
            message: "Insufficient stock",
            stock: stockAvailable,
          });
        }
  
        // Update existing cart item quantity
        const itemTotal = newQty * cartItems.Price;
        await db.execute(
          `UPDATE tbl_tempcart 
           SET Qty = ?, ItemTotal = ? 
           WHERE CartNumber = ? AND ProductAttributeID = ? AND UserID = ?`,
          [newQty, itemTotal, cartItems.CartNumber, cartItems.ProductAttributeID, id]
        );
  
        return res.status(200).json({ message: "Cart item quantity updated successfully" });
      } else {
        // If item doesn't exist, insert a new cart entry
        if (cartItems.Qty > stockAvailable) {
          return res.status(400).json({
            message: "Insufficient stock",
            stock: stockAvailable,
          });
        }
  
        const values = [
          id || null,
          cartItems.CartNumber || null,
          decodedProductID,
          cartItems.ProductAttributeID || null,
          cartItems.Price || 0,
          cartItems.Qty || 1,
          cartItems.Price * cartItems.Qty || 0,
          cartItems.TranxRef || `TRX-${Date.now()}`,
          new Date(),
          cartItems.Voucherprice || 0,
        ];
  
        const insertQuery = `
          INSERT INTO tbl_tempcart (UserID, CartNumber, ProductID, ProductAttributeID, Price, Qty, ItemTotal, TranxRef, CartDate, Voucherprice) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
        await db.execute(insertQuery, values);
  
        return res.status(200).json({ message: "Cart item stored successfully" });
      }
    } catch (error) {
      console.error("Error storing cart item:", error);
      return res.status(500).json({ error: "Failed to store cart item" });
    }
  });
      
  cartRoute.put("/update-quantity", async (req, res) => {
    const { id, userId, number, user } = req.body;
  
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
         WHERE ProductAttributeID = ? AND CartNumber = ? AND UserID=?`,
        [number.qty, number.qty, id, userId, user]
      );
  
      if (updateResult.affectedRows > 0) {
        // Re-fetch the current quantity after update
        const [checkResult] = await db.execute(
          `SELECT Qty FROM tbl_tempcart 
           WHERE ProductAttributeID = ? AND CartNumber = ?`,
          [id, userId]
        );
        if (checkResult.length > 0 && checkResult[0].Qty === 0) {
          // If quantity is 0, delete the item
          await db.execute(
            `DELETE FROM tbl_tempcart 
             WHERE ProductAttributeID = ? AND CartNumber = ?`,
            [id, userId]
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
  
    cartRoute.put('/update-cart-user',async(req,res)=>{
      const {cartNumber,userId}=req.body;
      if(!cartNumber || !userId){
        return res.status(401).json({message:"cart number and id must required"})
      }
      try{
        const [result]=await db.execute(
          `UPDATE tbl_tempcart 
          SET UserID =?
          WHERE CartNumber = ? AND UserId=?`,
         [userId,cartNumber,1]
        );
        if(result.affectedRows>0){
          return res.status(200).json({message:"User updated successfully in cart"})
        }
      }
      catch{
        return res.status(500).json({message:"Error updating user in cart"})
      }
    })
    cartRoute.delete("/delete-cart-item", async (req, res) => {
      const { productAttributeID, cartNumber,user } = req.query; // Use req.query instead of req.params
    
      if (!productAttributeID || !cartNumber) {
        return res
          .status(400)
          .json({ error: "productAttributeID and cartNumber are required." });
      }
    
      try {
        const [result] = await db.execute(
          `DELETE FROM tbl_tempcart 
           WHERE ProductAttributeID = ? AND CartNumber = ? AND UserID=?`,
          [productAttributeID, cartNumber,user]
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