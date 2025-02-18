import express from 'express'
import dotenv from "dotenv";
import Stripe from 'stripe';
import db from '../db/db.js'
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
          amount: 123,
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
      const { amount } = req.body;  
      let orderAmount = amount;
      let paymentIntent;
     
        if (calculateTax) {
          let taxCalculation = await calculate_tax(orderAmount, "usd")
    
          paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: taxCalculation.amount_total,
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

 

  paymentRoute.post('/store-payment', async (req, res) => {
      const connection = await db.getConnection(); // Get a DB connection
      await connection.beginTransaction(); // Start transaction
  
      try {
          const { email, paymentIntentId } = req.body;
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  
          if (paymentIntent.status !== 'succeeded') {
              return res.status(400).json({ message: 'Payment was not successful' });
          }
  
<<<<<<< HEAD
          // Fetch order details
          const [result] = await connection.query(
              'SELECT FinalMasterId, OrderNumber FROM tbl_finalmaster WHERE UserEmail=? AND stripeid IS NULL FOR UPDATE',
              [email]
=======
          // Update tbl_finalmaster with payment details
          const [updateMaster] = await db.query(
            'UPDATE tbl_finalmaster SET stripeid=?, OrderDate=?, OrderStatus=? WHERE UserEmail=? AND stripeid IS NULL',
            [paymentIntent.id, new Date(), 0, email]
>>>>>>> 16779861af2c1292ae186e67a83387435d1bf5bd
          );
  
          if (result.length === 0) {
              return res.status(400).json({ message: 'No order found for this user' });
          }
  
          const { FinalMasterId, OrderNumber } = result[0];
  
          // Update tbl_finalmaster with payment details
          const [updateMaster] = await connection.query(
              'UPDATE tbl_finalmaster SET stripeid=?, OrderDate=?, OrderStatus=? WHERE FinalMasterId=?',
              [paymentIntent.id, new Date(), 0, FinalMasterId]
          );
  
          if (updateMaster.affectedRows === 0) {
              throw new Error('Failed to update order details');
          }
  
          // Insert into tbl_OrderStatusHistory
          await connection.query(
              `INSERT INTO tbl_OrderStatusHistory (FinalMasterId, OrderNo, OrderUpdatedByUserType, OrderUpdatedByUser, OrderRemark, OrderStatus, OrderStatusDate) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [FinalMasterId, OrderNumber, 1, email, 'Payment successful, order placed', 0, new Date()]
          );
  
          // Fetch cart items
          const [getOrder] = await connection.query(
              `SELECT c.ProductID, c.ProductAttributeId, c.Price, c.Qty, c.ItemTotal, p.ProductName
               FROM tbl_finalcart c 
               JOIN tbl_products p ON c.ProductID = p.ProductID 
               WHERE c.UserEmail=?`,
              [email]
          );
  
          if (getOrder.length === 0) {
              throw new Error('No items found in cart');
          }
  
          // Insert into tbl_order and update stock
          for (const data of getOrder) {
              await connection.query(
                  `INSERT INTO tbl_order (UserEmail, ProductID, ProductAttributeId, Price, Qty, ItemTotal, OrderNumber, OrderDate)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [email, data.ProductID, data.ProductAttributeId || null, data.Price, data.Qty, data.ItemTotal || null, OrderNumber, new Date()]
              );
  
              await connection.query(
                  `UPDATE tbl_products SET Stock = Stock - ? WHERE ProductID = ?`,
                  [data.Qty, data.ProductID]
              );
          }
  
          // Send Order Confirmation Email
          await sendOrderConfirmationEmail(email, getOrder, OrderNumber);
  
          // Delete items from cart
          const [deleteCart] = await connection.query('DELETE FROM tbl_finalcart WHERE UserEmail=?', [email]);
  
          if (deleteCart.affectedRows === 0) {
              throw new Error('Failed to delete cart items');
          }
  
          await connection.commit(); // Commit transaction
  
          return res.status(200).json({ message: 'Payment successful, order placed, status updated, email sent' });
  
      } catch (error) {
          await connection.rollback(); // Rollback transaction in case of an error
          console.error("Error in store-payment:", error);
          return res.status(500).json({ message: 'Internal server error', error: error.message });
      } finally {
          connection.release(); // Release connection
      }
  });
  
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