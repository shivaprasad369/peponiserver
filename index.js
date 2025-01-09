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

app.listen(9000,()=>{
    console.log('Server is running on port 9000')
})