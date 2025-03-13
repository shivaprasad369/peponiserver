import express from 'express'
import cors from 'cors'
import { fileURLToPath } from "url";
import path from 'path';
import db from './db/db.js'
import adminroute from './Admin/login.js';
import cmsRoute from './Admin/cms.js';
import faqRoute from './Admin/faq.js';
import newsletterRoute from './Admin/newsletter.js';
import blogRoute from './Admin/blog.js';
import categoryRoute from './category/Add.js';
import categoryUpdateRoute from './category/update.js';
import attributeRoute from './Attribute/attribute.mjs';
import productRoute from './Product/product.mjs';
import productImageRoute from './Product/ProductImage.js';
import cluster from 'cluster';
import os from 'os';
import featureRoute from './Feature/feature.js';
import paginateRoute from './Product/paginate.js';
import forgetRoute from './Admin/forget.js';
import userRoute from './User/user.js';
import reviewRoute from './review/review.js';
import dashRoute from './dashboard/dashbord.js';
import bannerRouter from './Banner/banner.js';
import homeRoute from './HomePage/home.js';
import productsRoute from './products/products.js';
import detailRoute from './products/Details.js';
import cartRoute from './Cart/cart.js';
import blogsRoute from './HomePage/blog.js';
import checkout from './Checkout/checkout.js';
import newCartRoute from './Cart/New.js';
import contactRoute from './contact/contact.js';
import paymentRoute from './stripe/payment.js';
import Stripe from 'stripe';
import orderRoute from './order/order.js';
import newReviewRoute from './review/NewReview.js';
import reportRoute from './Report/report.js';
const numCPUs = os.cpus().length; 
const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// const stripe = require("stripe")('sk_test_51P25vZSAtyRKeDt751BHgHIA7gpHGGKgVRB9N4oreEa2xmwK8Wv7Oj2YzZ63EYLa2pvuW6J4UsnOjbSZ7oWpVln200l5pi3kVu');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use("/admin",adminroute)
app.use("/cms",cmsRoute)
app.use("/faq",faqRoute)
app.use("/newsletter",newsletterRoute)
app.use("/blog",blogRoute)
app.use("/category",categoryRoute)
app.use("/category/update",categoryUpdateRoute)
app.use("/attribute",attributeRoute)
app.use("/product",productRoute)
app.use("/productimage",productImageRoute)
app.use("/feature",featureRoute)
app.use("/paginate-product",paginateRoute)
app.use('/forgot-password',forgetRoute)
app.use('/user',userRoute)
app.use('/review',reviewRoute)
app.use("/dash", dashRoute)
app.use('/banner',bannerRouter)
app.use('/home',homeRoute)
app.use('/category-products',productsRoute)
app.use('/product-details',detailRoute)
app.use('/cart',newCartRoute)
app.use('/frontend-blog',blogsRoute)
app.use('/checkout',checkout)
app.use('/contact',contactRoute)
app.use('/payment',paymentRoute)
app.use('/order',orderRoute)
app.use('/newreview',newReviewRoute)
app.use('/report',reportRoute)
app.get("/test-db", async (req, res) => {
    console.log("connected");
    try {
      const [rows] = await db.query("SELECT 1 + 1 AS result");
      res.send(`Database connected! Result: ${rows[0].result}`);
    } catch (error) {
      console.error(error);
      res.status(500).send("Database connection failed");
    }
  });

  const calculateTotalOrderAmount = (items) => {
    return Number(items) * 100;
};

app.post("/create-payment-intent", async (req, res) => {
    const { items } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
        amount: calculateTotalOrderAmount(items.GrandTotal),
        currency: "inr",
        description: "Peponi Gallery, best art seller",
        automatic_payment_methods: {
            enabled: true,
        },
        shipping: {
          name: `${items.ShippingFirstname} ${items.ShippingLastname}`,
          phone: items.ShippingPhone,
          address: {
              line1: items.ShippingAddress,
              line2: items.ShippingAddressLine2 || "",
              city: items.ShippingCity,
              state: items.ShippingState || "",
              postal_code: items.ShippingPostalcode,
              country: items.ShippingCountry,
          },
      },
      metadata: {
          billing_name: `${items.BillingFirstname} ${items.BillingLastname}`,
          billing_email: items.BillingEmailID,
          billing_phone: items.BillingPhone,
          billing_address1: items.BillingAddress,
          billing_address2: items.BillingAddressLine2 || "",
          billing_city: items.BillingCity,
          billing_state: items.BillingState || "",
          billing_postal: items.BillingPostalcode,
          billing_country: items.BillingCountry,
          order_number: items.OrderNumber,
      },
        
    });

    res.send({
        clientSecret: paymentIntent.client_secret,
    });
});





  if (cluster.isPrimary) {
    console.log(`Primary process ${process.pid} is running`);
  
    // Fork workers for each CPU core
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
  
    // Handle worker exit and restart
    cluster.on('exit', (worker, code, signal) => {
      console.error(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
      console.log('Starting a new worker...');
      cluster.fork();
    });
  } else {
    // Worker process
    const PORT = process.env.PORT || 9000;
  
    // Start the server
    app.listen(PORT, () => {
      console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
  
    // Graceful shutdown on worker termination
    process.on('SIGTERM', () => {
      console.log(`Worker ${process.pid} shutting down...`);
      process.exit(0);
    });
  
    // Simulate an unhandled exception to test worker restart (optional)
    // setTimeout(() => {
    //   throw new Error('Simulated crash');
    // }, 10000);
  }
