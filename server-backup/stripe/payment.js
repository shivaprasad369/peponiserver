import express from 'express'
import Stripe from 'stripe';
import db from '../db/db.js'
import dotenv from "dotenv";
dotenv.config();
import nodemailer from 'nodemailer'
const paymentRoute= express.Router()
const calculateTax = false;

const calculate_tax = async (orderAmount, currency) => {
    const taxCalculation = await stripe.tax.calculations.create({
      currency,
      customer_details: {
        address: {
          line1: "10709 Cleary Blvd",
          city: "Plantation",
          state: "FL",
          postal_code: "33322",
          country: "US",
        },
        address_source: "shipping",
      },
      line_items: [
        {
          amount: orderAmount,
          reference: "ProductRef",
          tax_behavior: "exclusive",
          tax_code: "txcd_30011000"
        }
      ],
    });
  
    return taxCalculation;
  };
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

paymentRoute.post('/create-payment-intent', async (req, res) => {
    try {
      const { amount,item,amt } = req.body;  
      console.log(amount,item,amt)
      let orderAmount = amount;
      let paymentIntent;
     
        if (calculateTax) {
          let taxCalculation = await calculate_tax(orderAmount, "usd")
    
          paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: orderAmount,
            automatic_payment_methods: { enabled: true },
            metadata: { tax_calculation: taxCalculation.id }
          });
        }
        else {
          paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: orderAmount,
            automatic_payment_methods: { enabled: true }
          });
        }
    
        // Send publishable key and PaymentIntent details to client
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (e) {
        return res.status(400).send({
          error: {
            message: e.message,
          },
        });
    }
  });


  paymentRoute.post("/store-payment", async (req, res) => {
    return processPayment(req, res);
});
  async function processPayment(req, res, retries = 3) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
      const { email, paymentIntentId } = req.body;

      // ✅ Verify Payment Intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
          return res.status(500).json({ message: "Payment was not successful" });
      }

      // ✅ Check if payment is already processed
      const [existingPayment] = await connection.execute(
          "SELECT FinalMasterId FROM tbl_finalmaster WHERE stripeid = ?",
          [paymentIntentId]
      );

      if (existingPayment.length > 0) {
          return res.status(400).json({ error: "Payment already processed" });
      }

      // ✅ Fetch Order Details (LOCK the row to prevent concurrent modifications)
      const [orderResult] = await connection.execute(
          `SELECT FinalMasterId, OrderNumber 
           FROM tbl_finalmaster 
           WHERE UserEmail=? AND stripeid IS NULL 
           FOR UPDATE`,
          [email]
      );

      if (orderResult.length === 0) {
          return res.status(400).json({ message: "No order found for this user" });
      }

      const { FinalMasterId, OrderNumber } = orderResult[0];

      // ✅ Update Order in `tbl_finalmaster`
      const [updateMaster] = await connection.execute(
          `UPDATE tbl_finalmaster 
           SET stripeid=?, OrderDate=?, OrderStatus=? 
           WHERE FinalMasterId=?`,
          [paymentIntent.id, new Date(), 0, FinalMasterId]
      );

      if (updateMaster.affectedRows === 0) throw new Error("Failed to update order details");

      // ✅ Insert Order Status in `tbl_OrderStatusHistory`
      await connection.execute(
          `INSERT INTO tbl_OrderStatusHistory 
           (FinalMasterId, OrderNo, OrderUpdatedByUserType, OrderUpdatedByUser, OrderRemark, OrderStatus, OrderStatusDate) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [FinalMasterId, OrderNumber, 1, email, "Payment successful, order placed", 0, new Date()]
      );

      // ✅ Fetch Cart Items for Order
      const [cartItems] = await connection.execute(
          `SELECT c.ProductID, c.ProductAttributeId, c.Price, c.Qty,u.full_name,  c.ItemTotal, p.ProductName 
           FROM tbl_finalcart c 
           JOIN tbl_products p ON c.ProductID = p.ProductID 
           JOIN tbl_user u ON u.email = c.UserEmail 
           WHERE c.UserEmail=? AND c.availbilty=1`,
          [email]
      );

      if (cartItems.length === 0) throw new Error("No items found in cart");

      // ✅ Insert Items into `tbl_order` & Update Stock
      for (const item of cartItems) {
          await connection.execute(
              `INSERT INTO tbl_order 
               (UserEmail, ProductID,ProductName ,UserName,ProductAttributeId, Price, Qty, ItemTotal, OrderNumber, OrderDate) 
               VALUES (?, ?, ?, ?,?, ?, ?, ?, ?, ?)`,
              [email, item.ProductID, item.ProductName,item.full_name || null, item.ProductAttributeId || null, item.Price, item.Qty, item.Qty * item.Price || null, OrderNumber, new Date()]
          );

          // ✅ Check Stock Before Deducting
          const [stockCheck] = await connection.execute(
              `SELECT Stock FROM tbl_products WHERE ProductID = ?`,
              [item.ProductID]
          );

          if (stockCheck.length === 0 || stockCheck[0].Stock < item.Qty) {
              throw new Error(`Insufficient stock for ProductID: ${item.ProductID}`);
          }

          // ✅ Reduce Stock
          await connection.execute(
              `UPDATE tbl_products 
               SET Stock = Stock - ? 
               WHERE ProductID = ?`,
              [item.Qty, item.ProductID]
          );
      }

      // ✅ Delete Cart Items After Order is Confirmed
      const [deleteCart] = await connection.execute(
          `DELETE FROM tbl_finalcart WHERE UserEmail=? AND availbilty=1`,
          [email]
      );

      if (deleteCart.affectedRows === 0) throw new Error("Failed to delete cart items");

      // ✅ Commit Transaction
      await connection.commit();

      // ✅ Send Order Confirmation Email (after successful transaction)
      await sendOrderConfirmationEmail(email, cartItems, OrderNumber);

      return res.status(200).json({ message: "Payment successful, order placed, status updated, email sent" });

  } catch (error) {
      await connection.rollback();
      console.error("Error in store-payment:", error);
      if (error.code === "ER_LOCK_WAIT_TIMEOUT" && retries > 0) {
        console.warn(`Retrying payment transaction... Attempts left: ${retries}`);
        return processPayment(req, res, retries - 1);
    }

      return res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
      connection.release();
  }
  }
 

 

  // paymentRoute.post("/store-payment", async (req, res) => {
  //   const connection = await db.getConnection();
  //   await connection.beginTransaction();
  
  //   try {
  //     const { email, paymentIntentId } = req.body;
  
  //     // ✅ Retrieve Payment Intent from Stripe
  //     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  //     if (paymentIntent.status !== "succeeded") {
  //       return res.status(400).json({ message: "Payment was not successful" });
  //     }
  //     const existingPayment = await db.query("SELECT * FROM tbl_finalmaster  WHERE stripeid = ?", [paymentIntentId]);

  //     if (existingPayment.length > 0) {
  //       return res.status(400).json({ error: "Payment already processed" });
  //     }
  //     // ✅ Fetch Order Details (FOR UPDATE to prevent concurrent modifications)
  //     const [orderResult] = await connection.query(
  //       `SELECT FinalMasterId, OrderNumber 
  //        FROM tbl_finalmaster 
  //        WHERE UserEmail=? AND stripeid IS NULL 
  //        FOR UPDATE`,
  //       [email]
  //     );
  
  //     if (orderResult.length === 0) {
  //       return res.status(400).json({ message: "No order found for this user" });
  //     }
  
  //     const { FinalMasterId, OrderNumber } = orderResult[0];
  
  //     // ✅ Update Order Details in `tbl_finalmaster`
  //     const [updateMaster] = await connection.query(
  //       `UPDATE tbl_finalmaster 
  //        SET stripeid=?, OrderDate=?, OrderStatus=? 
  //        WHERE FinalMasterId=?`,
  //       [paymentIntent.id, new Date(), 0, FinalMasterId]
  //     );
  
  //     if (updateMaster.affectedRows === 0) throw new Error("Failed to update order details");
  
  //     // ✅ Log Order Status in `tbl_OrderStatusHistory`
  //     await connection.query(
  //       `INSERT INTO tbl_OrderStatusHistory 
  //        (FinalMasterId, OrderNo, OrderUpdatedByUserType, OrderUpdatedByUser, OrderRemark, OrderStatus, OrderStatusDate) 
  //        VALUES (?, ?, ?, ?, ?, ?, ?)`,
  //       [FinalMasterId, OrderNumber, 1, email, "Payment successful, order placed", 0, new Date()]
  //     );
  
  //     // ✅ Fetch Cart Items for the Order
  //     const [cartItems] = await connection.query(
  //       `SELECT c.ProductID, c.ProductAttributeId, c.Price, c.Qty, c.ItemTotal, p.ProductName 
  //        FROM tbl_finalcart c 
  //        JOIN tbl_products p ON c.ProductID = p.ProductID 
  //        WHERE c.UserEmail=?`,
  //       [email]
  //     );
  
  //     if (cartItems.length === 0) throw new Error("No items found in cart");
  
  //     // ✅ Insert Items into `tbl_order` and Update Stock
  //     for (const item of cartItems) {
  //       await connection.query(
  //         `INSERT INTO tbl_order 
  //          (UserEmail, ProductID, ProductAttributeId, Price, Qty, ItemTotal, OrderNumber, OrderDate) 
  //          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  //         [email, item.ProductID, item.ProductAttributeId || null, item.Price, item.Qty, item.ItemTotal || null, OrderNumber, new Date()]
  //       );
  
  //       await connection.query(
  //         `UPDATE tbl_products 
  //          SET Stock = Stock - ? 
  //          WHERE ProductID = ?`,
  //         [item.Qty, item.ProductID]
  //       );
  //     }
  
  //     // ✅ Delete Cart Items After Order is Confirmed
  //     const [deleteCart] = await connection.query(
  //       `DELETE FROM tbl_finalcart WHERE UserEmail=?`,
  //       [email]
  //     );
  
  //     if (deleteCart.affectedRows === 0) throw new Error("Failed to delete cart items");
  
  //     // ✅ Commit Transaction
  //     await connection.commit();
  
  //     // ✅ Send Order Confirmation Email (after successful transaction)
  //     await sendOrderConfirmationEmail(email, cartItems, OrderNumber);
  
  //     return res.status(200).json({ message: "Payment successful, order placed, status updated, email sent" });
  
  //   } catch (error) {
  //     await connection.rollback();
  //     console.error("Error in store-payment:", error);
  //     return res.status(500).json({ message: "Internal server error", error: error.message });
  //   } finally {
  //     connection.release();
  //   }
  // });
  
  
  async function sendOrderConfirmationEmail(userEmail, orderItems, orderNumber) {
 const transporter = nodemailer.createTransport({
   service: 'gmail',
   auth: {
     user: process.env.EMAIL_USER,
     pass: process.env.EMAIL_PASSWORD,
   },
 });
  
 let orderDetails = orderItems.map(item => `
  <tr>
    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.ProductName}</td>
    <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.Qty}</td>
    <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.Price}</td>
    <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.ItemTotal}</td>
  </tr>
`).join('');
  
let emailHTML = `
<div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; color: #333;">
  <div style="background: #007bff; color: #fff; padding: 20px; text-align: center; font-size: 22px; font-weight: bold;">
    Order Confirmation
  </div>

  <div style="padding: 20px;">
    <p style="font-size: 16px;">Hello,</p>
    <p>Thank you for your order. Here are your order details:</p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <tr style="background: #f2f2f2;">
        <th style="padding: 10px; text-align: left;">Product Name</th>
        <th style="padding: 10px; text-align: center;">Quantity</th>
        <th style="padding: 10px; text-align: right;">Price</th>
        <th style="padding: 10px; text-align: right;">Total</th>
      </tr>
      ${orderDetails}
    </table>

    <p style="margin-top: 20px;"><strong>Order Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Order Number:</strong> ${orderNumber}</p>

    <div style="margin-top: 20px; padding: 15px; background: #28a745; color: #fff; text-align: center; font-size: 18px; font-weight: bold;">
      Thank you for shopping with us!
    </div>
  </div>
</div>
`;
  
    let mailOptions = {
      from:process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Your Order Confirmation',
      html: emailHTML
    };
  
    try {
      await transporter.sendMail(mailOptions);
      console.log('Order confirmation email sent to:', userEmail);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
  
  
  
  export default paymentRoute;