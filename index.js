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
const numCPUs = os.cpus().length; 
const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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