import express, { query } from "express";
import db from "../db/db.js";

const newCartRoute = express.Router()
newCartRoute.get("/generate-id", (req, res) => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '');
  const secondsStr = now.getSeconds().toString().padStart(2, '0'); // Get seconds with 2 digits
  const uniqueId = `${dateStr}${timeStr}${secondsStr}`;
  res.json({ id: uniqueId });
});
newCartRoute.get("/get-cart-by-number", async (req, res) => {
  const { cartNumber, email } = req.query;
  // if (!cartNumber || !email ) {
  //   return res.status(400).json({ error: "Invalid or missing CartNumber" });
  // }
  let q=''
  let qp=[]
  if(email){
    q='SELECT * FROM tbl_finalcart WHERE UserEmail=? '
    qp=[email]
    
  }
  else{
    q='SELECT * FROM tbl_tempcart WHERE CartNumber=?'
    qp=[cartNumber]
    
  }
  let [rows] = await db.query(q, qp);
  for (const data of rows) {  // ✅ Fixed syntax
    const [checkAvailability] = await db.query(
      `SELECT Stock FROM tbl_products WHERE ProductID=?`,
      [data.ProductID]
    );

    if (checkAvailability.length > 0 && checkAvailability[0].Stock === 0) {
      let updateQuery = email
        ? `UPDATE tbl_finalcart SET availbilty=false WHERE FinalCartID=?`
        : `UPDATE tbl_tempcart SET availbilty=false WHERE TempCartID=?`;

      const [updateAvailability] = await db.query(updateQuery, [email ? data.FinalCartID : data.TempCartID]);

      if (updateAvailability.affectedRows === 0) {
        throw new Error(`Failed to update availability for product ${data.ProductID}`);
      }
    }else{
      let updateQuery = email
       ? `UPDATE tbl_finalcart SET availbilty=true WHERE FinalCartID=?`
        : `UPDATE tbl_tempcart SET availbilty=true WHERE TempCartID=?`;
        const [updateAvailability] = await db.query(updateQuery, [email? data.FinalCartID : data.TempCartID]);
        if (updateAvailability.affectedRows === 0) {
        throw new Error(`Failed to update availability for product ${data.ProductID}`);
      }
    }
  }

 
  let query = ''
  try {
    if (email) {
      query = `
            SELECT 
              p.SellingPrice,
              p.Image,
              tc.*,
              p.Stock,
              p.ProductName,
              p.ProductPrice,
              c.CategoryName,p.ProductUrl
            FROM tbl_products p
            JOIN tbl_finalcart tc ON p.ProductID = tc.ProductID
            JOIN tbl_category c ON c.CategoryID = p.CategoryID
           
          `;
    } else {
      query = `
        SELECT 
          p.SellingPrice,
          p.Image,
          tc.*,
          p.Stock,
          p.ProductName,
          p.ProductPrice,
          c.CategoryName,
          p.ProductUrl
        FROM tbl_products p
        JOIN tbl_tempcart tc ON p.ProductID = tc.ProductID
        JOIN tbl_category c ON c.CategoryID = p.CategoryID
       `;
    }
    let queryParams = [];

    if (email) {
      query += `WHERE tc.UserEmail = ?`;
      queryParams.push(email);
    } else {
      query += `WHERE tc.CartNumber = ?`;
      queryParams.push(cartNumber);
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
newCartRoute.get("/Checkout/get-cart-by-number", async (req, res) => {
  const { cartNumber, email } = req.query;
  // if (!cartNumber || !email ) {
  //   return res.status(400).json({ error: "Invalid or missing CartNumber" });
  // }
  let query = ''
  try {
    if (email) {
      query = `
            SELECT 
              p.SellingPrice,
              p.Image,
              tc.*,
              p.Stock,
              p.ProductName,
              p.ProductPrice,
              c.CategoryName,p.ProductUrl
            FROM tbl_products p
            JOIN tbl_finalcart tc ON p.ProductID = tc.ProductID
            JOIN tbl_category c ON c.CategoryID = p.CategoryID
           
          `;
    } else {
      query = `
        SELECT 
          p.SellingPrice,
          p.Image,
          tc.*,
          p.Stock,
          p.ProductName,
          p.ProductPrice,
          c.CategoryName,
          p.ProductUrl
        FROM tbl_products p
        JOIN tbl_tempcart tc ON p.ProductID = tc.ProductID
        JOIN tbl_category c ON c.CategoryID = p.CategoryID
       `;
    }
    let queryParams = [];

    if (email) {
      query += `WHERE tc.UserEmail = ? AND tc.availbilty=true`;
      queryParams.push(email);
    } else {
      query += `WHERE tc.CartNumber = ? AND tc.availbilty=true`;
      queryParams.push(cartNumber);
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

async function storeCartItem(req, res, retries = 3) {
  const { cartItems, email } = req.body;
  const { id } = req.query;

  if (!cartItems || !cartItems.CartNumber || !cartItems.ProductAttributeID || !cartItems.ProductID) {
    return res.status(400).json({ error: "CartNumber, ProductAttributeID, and ProductID are required." });
  }

  const decodedProductID = Buffer.from(cartItems.ProductID, "base64").toString("utf-8");
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Check stock availability
    const [stockResult] = await connection.execute(
      "SELECT Stock FROM tbl_products WHERE ProductID = ?",
      [decodedProductID]
    );
    if (stockResult.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found." });
    }

    const stockAvailable = stockResult[0].Stock;

    // Build query to check existing items in the cart
    let checkQuery = "";
    let checkParams = [];

    if (email) {
      checkQuery = "SELECT Qty FROM tbl_finalcart WHERE ProductID = ? AND UserEmail=? FOR UPDATE";
      checkParams.push(decodedProductID, email);
    } else {
      checkQuery = "SELECT Qty FROM tbl_tempcart WHERE CartNumber=? AND ProductID = ? AND UserID=? FOR UPDATE";
      checkParams.push(cartItems.CartNumber, decodedProductID, 1);
    }

    const [existingItems] = await connection.execute(checkQuery, checkParams);

    if (existingItems.length > 0) {
      const newQty = cartItems.Qty;

      // Check stock before updating quantity
      if (newQty > stockAvailable) {
        await connection.rollback();
        return res.status(400).json({ message: "Insufficient stock", stock: stockAvailable });
      }

      // Update existing cart item quantity
      const itemTotal = newQty * cartItems.Price;
      let updateQuery = "";
      let updateParams = [];

      if (email) {
        updateQuery = `
                    UPDATE tbl_finalcart SET Qty = ?, ItemTotal = ?
                    WHERE UserEmail = ? AND ProductID = ?`;
        updateParams.push(newQty, itemTotal, email, Number(decodedProductID));
      } else {
        updateQuery = `
                    UPDATE tbl_tempcart SET Qty = ?, ItemTotal = ?
                    WHERE CartNumber = ? AND ProductID = ? AND UserID=?`;
        updateParams.push(newQty, itemTotal, cartItems.CartNumber, Number(decodedProductID), 1);
      }

      const [result] = await connection.execute(updateQuery, updateParams);

      if (result.affectedRows > 0) {
        await connection.commit();
        return res.status(200).json({ message: "Cart item quantity updated successfully", id: result.insertId });
      } else {
        await connection.rollback();
        return res.status(500).json({ error: "Failed to update cart item" });
      }
    } else {
      // If item doesn't exist, insert a new cart entry
      if (cartItems.Qty > stockAvailable) {
        await connection.rollback();
        return res.status(400).json({ message: "Insufficient stock", stock: stockAvailable });
      }

      let insertQuery = "";
      let queryParams = [];

      if (email) {
        insertQuery = `
                    INSERT INTO tbl_finalcart (UserEmail, ProductID, Price, Qty, ItemTotal, ProductAttributeId) 
                    VALUES (?, ?, ?, ?, ?, ?)`;
        queryParams.push(
          email || null,
          decodedProductID,
          cartItems.Price || 0,
          cartItems.Qty || 1,
          cartItems.Price * cartItems.Qty || 0,
          cartItems.ProductAttributeID
        );
      } else {
        insertQuery = `
                    INSERT INTO tbl_tempcart (UserID, UserEmail, CartNumber, ProductID, ProductAttributeID, 
                        Price, Qty, ItemTotal, TranxRef, CartDate, Voucherprice) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        queryParams.push(
          id || null,
          email || null,
          cartItems.CartNumber,
          decodedProductID,
          cartItems.ProductAttributeID,
          cartItems.Price || 0,
          cartItems.Qty || 1,
          cartItems.Price * cartItems.Qty || 0,
          cartItems.TranxRef || `TRX-${Date.now()}`,
          new Date(),
          cartItems.Voucherprice || 0
        );
      }

      const [result] = await connection.execute(insertQuery, queryParams);
      if (result.affectedRows > 0) {
        await connection.commit();
        return res.status(200).json({ message: "Cart item stored successfully", id: result.insertId });
      } else {
        await connection.rollback();
        return res.status(500).json({ error: "Failed to store cart item" });
      }
    }
  } catch (error) {
    await connection.rollback();
    console.log("Error storing cart item:", error);

    // Retry logic for lock timeout errors
    if (error.code === "ER_LOCK_WAIT_TIMEOUT" && retries > 0) {
      console.log(`Retrying transaction... Attempts left: ${retries}`);
      return storeCartItem(req, res, retries - 1);
    }

    return res.status(500).json({ error: "Failed to store cart item" });
  } finally {
    connection.release();
  }
}

// Use this function inside the route
newCartRoute.post("/store-cart", async (req, res) => {
  return storeCartItem(req, res);
});

newCartRoute.put("/update-quantity", async (req, res) => {
  const { id, userId, number, email,ProductUrl } = req.body;

  if (!userId || !number || !number.qty || !number.action) {
    return res.status(400).json({
      error: "id, userId, number.qty, and number.action are required.",
    });
  }
  if (number.qty === 0) {
    return res.status(400).json({ error: "Quantity cannot be zero." });
  }
  if (!["increment", "decrement"].includes(number.action)) {
    return res
      .status(400)
      .json({ error: 'Invalid action. Use "increment" or "decrement".' });
  }
  try {
    const operation = number.action === "increment" ? "+" : "-";
    let checkQuery = ``
    let checkParams = [];
    const [getQty] = await db.execute(
      `SELECT Stock FROM tbl_products
      WHERE ProductUrl =?`,
      [ProductUrl]
    );
    if (getQty[0].Stock === 0) {
      return res.status(404).json({ error: "Product Quantity not existed" });
    }
    if (email) {
      checkQuery += `
        UPDATE tbl_finalcart 
         SET Qty = GREATEST(0, Qty ${operation} ?), 
             ItemTotal = Price * GREATEST(0, Qty ${operation} ?) 
         WHERE FinalCartID = ?`
      checkParams.push(number.qty, number.qty, userId)
    }
    else {
      checkQuery += `
        UPDATE tbl_tempcart 
         SET Qty = GREATEST(0, Qty ${operation} ?), 
             ItemTotal = Price * GREATEST(0, Qty ${operation} ?) 
         WHERE TempCartID = ?`
      checkParams.push(number.qty, number.qty, userId)
    }
    const [updateResult] = await db.execute(
      checkQuery,
      checkParams
    );
    if (updateResult.affectedRows > 0) {
      res.status(200).send('Update Successfully')
    }

    //   if (updateResult.affectedRows > 0) {
    //     // Re-fetch the current quantity after update
    //     const [checkResult] = await db.execute(
    //       `SELECT Qty FROM tbl_tempcart 
    //        WHERE ProductAttributeID = ? AND TempCartID = ?`,
    //       [id, userId]
    //     );
    //     if (checkResult.length > 0 && checkResult[0].Qty === 0) {
    //       // If quantity is 0, delete the item
    //       await db.execute(
    //         `DELETE FROM tbl_tempcart 
    //          WHERE ProductAttributeID = ? AND TempCartID = ? AND UserEmail=?`,
    //         [id, userId,email]
    //       );
    //       return res.status(200).json({ message: "Item deleted as quantity reached 0" });
    //     }

    //     return res.status(200).json({ message: "Quantity updated successfully" });
    //   } else {
    //     return res.status(404).json({ error: "Product not found in cart" });
    //   }
  } catch (error) {
    console.error("Error updating quantity:", error);
    return res.status(500).json({ error: "Failed to update quantity" });
  }
});

newCartRoute.put('/update-cart-user', async (req, res) => {
  const { cartNumber, email, user } = req.body;

  if (!cartNumber || !email) {
    return res.status(400).json({ message: "Cart number and email are required." });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Fetch all cart items in one query
    const [cartItems] = await connection.execute(
      `SELECT ProductID, Qty, ProductAttributeID, Price 
             FROM tbl_tempcart 
             WHERE CartNumber = ?`,
      [cartNumber]
    );

    const productIDs = cartItems.map(item => item.ProductID);  

    if (productIDs.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "No items found in the cart." });
    }

    // Create placeholders (?, ?, ?)
    const placeholders = productIDs.map(() => '?').join(',');
    const sql = `SELECT ProductID, Qty FROM tbl_finalcart WHERE UserEmail = ? AND ProductID IN (${placeholders})`;

    const [existingCartItems] = await connection.execute(sql, [email, ...productIDs]);  


    // Convert existing items into a map for quick lookup
    const existingCartMap = new Map(existingCartItems.map(item => [item.ProductID, item.Qty]));

    const updatePromises = [];
    const insertPromises = [];
    const deletePromises = [];

    for (const cart of cartItems) {
      const { ProductID, Qty, ProductAttributeID, Price } = cart;
      const newItemTotal = Qty * Number(Price);

      if (existingCartMap.has(ProductID)) {
        // Update existing item
        updatePromises.push(
          connection.execute(
            `UPDATE tbl_finalcart SET Qty = ? WHERE UserEmail = ? AND ProductID = ?`,
            [Qty, email, ProductID]
          )
        );
      } else {
        // Insert new item
        insertPromises.push(
          connection.execute(
            `INSERT INTO tbl_finalcart (UserEmail, ProductID, Price, ProductAttributeId, ItemTotal, Qty) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
            [email, ProductID, Price, ProductAttributeID || null, newItemTotal, Qty]
          )
        );
      }

      // Delete from temporary cart
      deletePromises.push(
        connection.execute(
          `DELETE FROM tbl_tempcart WHERE ProductID = ? AND CartNumber = ? AND UserID = ?`,
          [ProductID, cartNumber, 1]
        )
      );
    }

    // Execute all update, insert, and delete queries in parallel
    await Promise.all([...updatePromises, ...insertPromises, ...deletePromises]);

    await connection.commit();
    return res.status(200).json({ message: "Cart updated successfully." });

  } catch (error) {
    await connection.rollback();
    console.error("Error updating cart:", error);
    return res.status(500).json({ message: "Error updating cart", error });
  } finally {
    connection.release();
  }
});


newCartRoute.delete("/delete-cart-item", async (req, res) => {
  const { id, email } = req.query; // Use req.query instead of req.params

  if (!id) {
    return res
      .status(400)
      .json({ error: "id is required." });
  }

  try {
    let checkQuer = ``;

    if (email) {
      checkQuer += `
                DELETE FROM tbl_finalcart 
                 WHERE FinalCartID=? `
    }
    else {
      checkQuer += `
                DELETE FROM tbl_tempcart 
                 WHERE TempCartID=?`

    }
    const [result] = await db.execute(
      checkQuer,
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
export default newCartRoute
