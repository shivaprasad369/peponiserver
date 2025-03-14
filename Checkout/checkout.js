import express from "express";

import db from "../db/db.js";
import dotenv from "dotenv";

dotenv.config();
const checkout = express.Router();
// POST endpoint to insert data into tbl_finalmaster
async function generateUniqueOrderNumber() {
  let uniqueOrderNumber;
  let isUnique = false;
  const maxAttempts = 10; // Set a limit to prevent infinite loops
  let attempts = 0;

  while (!isUnique && attempts < maxAttempts) {
      const randomNumber = Math.floor(10000000 + Math.random() * 90000000);
      uniqueOrderNumber = `ORD${randomNumber}`;

      // Check uniqueness
      const [rows] = await pool.query(
          "SELECT COUNT(*) as count FROM tbl_finalmaster WHERE OrderNumber = ?",
          [uniqueOrderNumber]
      );

      if (rows[0].count === 0) {
          isUnique = true;
      } else {
          attempts++;
      }
  }

  if (!isUnique) throw new Error("Failed to generate a unique order number.");
  return uniqueOrderNumber;
}

async function processCheckout(req, res, retries = 3){
const {
  addressId, UserEmail, BillingFirstname, BillingLastname, BillingAddress,
  BillingAddressLine2, BillingEmailID, BillingPhone, BillingCity, BillingPostalcode, BillingCountry,
  ShippingFirstname, ShippingLastname, ShippingAddress, ShippingAddressLine2, ShippingEmailID,
  ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry, GrandItemTotal, ShippingPrice, GrandTotal,
} = req.body;
const OrderNumber = await generateUniqueOrderNumber();

let connection;

try {
  connection = await db.getConnection();

// ✅ Start transaction
await connection.query("SET SESSION innodb_lock_wait_timeout = 50");
  // 🔹 Check if an order already exists
 
  let finalAddressId = addressId;

  if (addressId && addressId !== 0) {
    // 🔹 Update Address if addressId is provided
    const updateAddressQuery = `
      UPDATE tbl_address SET
        BillingFirstname = ?, BillingLastname = ?, BillingAddress = ?, BillingAddressLine2 = ?,
        BillingEmailID = ?, BillingPhone = ?, BillingCity = ?, BillingPostalcode = ?, BillingCountry = ?,
        ShippingFirstname = ?, ShippingLastname = ?, ShippingAddress = ?, ShippingAddressLine2 = ?,
        ShippingEmailID = ?, ShippingPhone = ?, ShippingCity = ?, ShippingPostalcode = ?, ShippingCountry = ?
      WHERE AddressId = ?`;
    const updateValues = [
      BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID, BillingPhone,
      BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, ShippingAddress,
      ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry,
      addressId,
    ];
    await connection.execute(updateAddressQuery, updateValues);
  } else {
    // 🔹 Insert new address if none exists
    const insertAddressQuery = `
      INSERT INTO tbl_address (
        UserEmail, BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID, 
        BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
        ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertAddressValues = [
      UserEmail, BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID,
      BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname,
      ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry,
    ];
    const [result] = await connection.execute(insertAddressQuery, insertAddressValues);
    finalAddressId = result.insertId;
  }
  await connection.beginTransaction(); 
  const checkQuery = `SELECT * FROM tbl_finalmaster WHERE UserEmail = ? AND stripeid IS NULL FOR UPDATE`;
  const [existingRecords] = await connection.execute(checkQuery, [UserEmail]);

  if (existingRecords.length > 0) {
    // 🔹 Update existing order
    const updateQuery = `
      UPDATE tbl_finalmaster SET
        addressID = ?, BillingFirstname = ?, BillingLastname = ?, BillingAddress = ?, BillingAddressLine2 = ?,
        BillingEmailID = ?, BillingPhone = ?, BillingCity = ?, BillingPostalcode = ?, BillingCountry = ?,
        ShippingFirstname = ?, ShippingLastname = ?, ShippingAddress = ?, ShippingAddressLine2 = ?,
        ShippingEmailID = ?, ShippingPhone = ?, ShippingCity = ?, ShippingPostalcode = ?, ShippingCountry = ?, 
        GrandItemTotal = ?, ShippingPrice = ?, GrandTotal = ?
      WHERE UserEmail = ? AND stripeid IS NULL`;
    const updateValues = [
      finalAddressId, BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID,
      BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname,
      ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry,
      GrandItemTotal || 0, ShippingPrice || 0, GrandTotal || 0, UserEmail,
    ];
    await connection.execute(updateQuery, updateValues);
  } else {
    // 🔹 Insert new order
    const insertQuery = `
      INSERT INTO tbl_finalmaster (
        UserEmail, addressID, OrderNumber, BillingFirstname, BillingLastname, BillingAddress, 
        BillingAddressLine2, BillingEmailID, 
        BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
        ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity,
        ShippingPostalcode, ShippingCountry,
        GrandItemTotal, ShippingPrice, GrandTotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertValues = [
      UserEmail, finalAddressId, OrderNumber, BillingFirstname, BillingLastname, BillingAddress,
      BillingAddressLine2, BillingEmailID,
      BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname,
      ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity,
      ShippingPostalcode, ShippingCountry,
      GrandItemTotal || 0, ShippingPrice || 0, GrandTotal || 0,
    ];
    await connection.execute(insertQuery, insertValues);
  }

  await connection.commit(); // ✅ Commit transaction
  res.status(200).json({ message: "Order processed successfully", addressId: finalAddressId });

} catch (err) {
  if (connection) await connection.rollback(); // ❌ Rollback on failure
  console.error("Transaction failed:", err);
  if (err.code === "ER_LOCK_WAIT_TIMEOUT" && retries > 0) {
    console.warn(`Retrying checkout transaction... Attempts left: ${retries}`);
    return processCheckout(req, res, retries - 1);
  }

  res.status(500).json({ error: "Failed to process the request" });
} finally {
  if (connection) connection.release(); // ✅ Always release connection
}
}
checkout.post("/", async (req, res) => {
  return processCheckout(req, res);
});



  
checkout.get("/", async (req, res) => {
    const {orderId,user} = req.query; // Get the order ID from the URL parameters
  // console.log(req.query)
    const query = `
      SELECT 
    f.*, a.*
FROM tbl_finalmaster f
JOIN tbl_address a ON a.AddressID = f.addressId
WHERE f.UserEmail = ?

    `;
  
    try {
      // Execute the query to fetch order data based on OrderNumber
      const [rows] = await db.execute(query, [user]);
  
      // If no rows are found, send a 404 response
      if (rows.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }
  
      // Send the fetched data as a JSON response
      res.status(200).json({
        message: "Order fetched successfully",
        data: rows[0], // Return the first (and only) result
      }); 
    } catch (err) { 
      console.error("Error fetching data: ", err);
      res.status(500).json({ error: "Failed to fetch data from the database" });
    }
  });
  checkout.put('/', async (req, res) => {
    const { orderId, cartNumber, user, stripeId, date } = req.body;
  
    // Check for missing parameters
    if (!orderId || !user) {
      return res.status(400).json({ error: 'Missing orderId or user parameter' });
    }
  
    try {
      // Step 1: Fetch items from tbl_tempcart
      const row = 'SELECT * FROM `tbl_tempcart` WHERE CartNumber=? AND UserEmail=?';
      const [cartItems] = await db.execute(row, [cartNumber, user]);
  
      // Step 2: Insert data into tbl_finalcart if there are items in the cart
      if (cartItems.length > 0) {
        // Format data for bulk insert
        const finalCartData = cartItems.map(item => [
          user, 
          orderId, 
          item.ProductID,
          item.Price, 
          item.Qty, 
          item.ItemTotal, 
          date, 
           null, 
         null, 
          item.ItemTotalVoucherprice || null, 
          item.WebsiteType, 
          item.Voucherprice, 
          item.ProductAttributeID 
        ]
      );
  console.log(finalCartData)
        // Insert into tbl_finalcart (multiple rows)
        const query = `
        INSERT INTO \`tbl_finalcart\`(\`UserEmail\`, \`OrderNumber\`, \`ProductID\`, \`Price\`, \`Qty\`, \`ItemTotal\`, \`OrderDate\`, \`VedorProdStatus\`, \`SubOrderNo\`, \`ItemTotalVoucherprice\`, \`WebsiteType\`, \`Voucherprice\`, \`ProductAttributeId\`) 
        VALUES ?
      `;
      
      // Ensure you pass the array of arrays as the second parameter to execute
      const [insert] = await db.query(query, [finalCartData]);
  
        if (insert.affectedRows > 0) {
          // Step 3: Delete from tbl_tempcart after successful insertion
          await db.execute('DELETE FROM `tbl_tempcart` WHERE CartNumber=? AND UserID=?', [cartNumber, user]);
        } else {
          return res.status(500).json({ error: 'Failed to insert into tbl_finalcart' });
        }
      }
  
      // Step 4: Update tbl_finalmaster
      const userQuery = `
        UPDATE tbl_finalmaster SET stripeid = ?, OrderDate = ? WHERE OrderNumber = ? AND UserEmail= ?
      `;
      const [result] = await db.execute(userQuery, [stripeId, date, orderId, user]);
  
      // Check if the update was successful
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      // Respond with success message
      res.status(201).json({
        message: 'Data inserted successfully',
        insertedId: result.insertId,
      });
    } catch (err) {
      // Catch any error and return a generic error message
      console.error(err);
      res.status(500).json({ error: 'Failed to process the request' });
    }
  });
  
  checkout.get('/address',async(req,res)=>{
    const {email} = req.query;
    if(!email){
      return res.status(400).json({error: 'Missing user parameter'});
    }
    const query = `
      SELECT * FROM tbl_address WHERE UserEmail =?
    `;
    try{
      const [rows] = await db.execute(query,[email]);
      if(rows.length === 0){
        return res.status(404).json({message: 'Data found'});
      }
      res.status(200).json({message: 'Address fetched successfully', data: rows})
    }catch(err){
      console.error('Error fetching data: ',err);
      res.status(500).json({error: 'Failed to fetch data from the database'});
    }
  })
  
  checkout.get('/address/:id',async(req,res)=>{
    const {id} = req.params;
    if(!id){
      return res.status(400).json({error: 'Missing user parameter'});
    }
    const query = `
      SELECT * FROM tbl_address WHERE AddressID =?
    `;
    try{
      const [rows] = await db.execute(query,[id]);
      if(rows.length === 0){
        return res.status(404).json({message: 'Data found'});
      }
      res.status(200).json({message: 'Address fetched successfully', data: rows[0]})
    }catch(err){
      console.error('Error fetching data: ',err);
      res.status(500).json({error: 'Failed to fetch data from the database'});
    }
  })
  checkout.delete('/address/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Missing address ID parameter' });
    }

    const checkQuery = `SELECT * FROM tbl_address WHERE AddressID = ?`;
    const deleteQuery = `DELETE FROM tbl_address WHERE AddressID = ?`;

    try {
        // Check if the address exists before deleting
        const [rows] = await db.execute(checkQuery, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // Delete the address
        await db.execute(deleteQuery, [id]);

        res.status(200).json({ message: 'Address deleted successfully' });
    } catch (err) {
        console.error('Error deleting data: ', err);
        res.status(500).json({ error: 'Failed to delete data from the database' });
    }
});

export default checkout;