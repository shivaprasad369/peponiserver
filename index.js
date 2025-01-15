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
    // Fork worker processes based on the number of CPU cores
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
  
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
    });
  } else {
    const PORT = process.env.PORT || 9000;
    app.listen(PORT, () => {
      console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
  }