import express from "express";
import db from "../db/db.js";
 const dashRoute = express.Router();
    dashRoute.get("/", async (req, res) => {
        try {
            
            const [rows] = await db.query(
                `SELECT 
                 (SELECT COUNT(*) FROM tbl_products) AS product,
                 (SELECT COUNT(*) FROM tbl_user) AS user,
                (SELECT COUNT(*) from blogs) AS blog;`
            );
            res.json({ result: rows });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    export default dashRoute;