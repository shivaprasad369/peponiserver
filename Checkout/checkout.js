import express from "express";

import db from "../db/db.js";
import dotenv from "dotenv";

dotenv.config();
const checkout = express.Router();
// POST endpoint to insert data into tbl_finalmaster
checkout.post("/", async (req, res) => {
  const {
    addressId,
    UserEmail,
    OrderNumber,
    BillingFirstname,
    BillingLastname,
    BillingAddress,
    BillingAddressLine2,
    BillingEmailID,
    BillingPhone,
    BillingCity,
    BillingPostalcode,
    BillingCountry,
    ShippingFirstname,
    ShippingLastname,
    ShippingAddress,
    ShippingAddressLine2,
    ShippingEmailID,
    ShippingPhone,
    ShippingCity,
    ShippingPostalcode,
    ShippingCountry,
    GrandItemTotal,
    ShippingPrice,
    GrandTotal,
  } = req.body;

  try {
    // Check if the user already has an entry in `tbl_finalmaster`
    const checkQuery = `SELECT * FROM tbl_finalmaster WHERE UserEmail = ? AND stripeid IS NULL`;
    const [existingRecords] = await db.execute(checkQuery, [UserEmail]);

    let finalAddressId = addressId;

    if (addressId && addressId !== 0) {
      // If `addressId` is provided, update `tbl_address`
      const updateAddressQuery = `
        UPDATE tbl_address SET
          BillingFirstname = ?, BillingLastname = ?, BillingAddress = ?, BillingAddressLine2 = ?,
          BillingEmailID = ?, BillingPhone = ?, BillingCity = ?, BillingPostalcode = ?, BillingCountry = ?,
          ShippingFirstname = ?, ShippingLastname = ?, ShippingAddress = ?, ShippingAddressLine2 = ?,
          ShippingEmailID = ?, ShippingPhone = ?, ShippingCity = ?, ShippingPostalcode = ?, ShippingCountry = ?
        WHERE AddressId = ?
      `;
      const updateAddressValues = [
        BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID, BillingPhone,
        BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, ShippingAddress,
        ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry,
        addressId
      ];
      await db.execute(updateAddressQuery, updateAddressValues);
    } else {
      // If no `addressId`, insert a new address
      const insertAddressQuery = `
        INSERT INTO tbl_address (
          UserEmail, BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID, 
          BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
          ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const insertAddressValues = [
        UserEmail, BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID, 
        BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
        ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry
      ];
      const [result] = await db.execute(insertAddressQuery, insertAddressValues);
      finalAddressId = result.insertId; // Store the new address ID
    }

    if (existingRecords.length > 0) {
      // If record exists, update `tbl_finalmaster` with the new addressId
      const updateQuery = `
        UPDATE tbl_finalmaster SET
          addressID = ?, BillingFirstname = ?, BillingLastname = ?, BillingAddress = ?, BillingAddressLine2 = ?,
          BillingEmailID = ?, BillingPhone = ?, BillingCity = ?, BillingPostalcode = ?, BillingCountry = ?,
          ShippingFirstname = ?, ShippingLastname = ?, ShippingAddress = ?, ShippingAddressLine2 = ?,
          ShippingEmailID = ?, ShippingPhone = ?, ShippingCity = ?, ShippingPostalcode = ?, ShippingCountry = ?, 
          GrandItemTotal = ?, ShippingPrice = ?, GrandTotal = ?
        WHERE UserEmail = ? AND stripeid IS NULL
      `;
      const updateValues = [
        finalAddressId, BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID, 
        BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
        ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry,
        GrandItemTotal || 0, ShippingPrice || 0, GrandTotal || 0, UserEmail
      ];
      await db.execute(updateQuery, updateValues);
      return res.status(200).json({ message: "Order updated successfully", addressId: finalAddressId });
    } else {
      // If no record, insert into `tbl_finalmaster` with the new addressId
      const insertQuery = `
        INSERT INTO tbl_finalmaster (
          UserEmail, addressID, OrderNumber, BillingFirstname, BillingLastname, BillingAddress, 
          BillingAddressLine2, BillingEmailID, 
          BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
          ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity,
          ShippingPostalcode, ShippingCountry,
          GrandItemTotal, ShippingPrice, GrandTotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const insertValues = [
        UserEmail, finalAddressId, OrderNumber, BillingFirstname, BillingLastname, BillingAddress, 
        BillingAddressLine2, BillingEmailID, 
        BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
        ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, 
        ShippingPostalcode, ShippingCountry,
        GrandItemTotal || 0, ShippingPrice || 0, GrandTotal || 0
      ];
      await db.execute(insertQuery, insertValues);
      return res.status(201).json({ message: "New order and address added successfully", addressId: finalAddressId });
    }
  } catch (err) {
    console.error("Error processing request:", err);
    res.status(500).json({ error: "Failed to process the request" });
  }
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