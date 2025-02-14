import express from 'express'
import dotenv from "dotenv";
import Stripe from 'stripe';
dotenv.config();
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
  export default paymentRoute;