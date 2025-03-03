import express from "express";
import db from "../db/db.js";
 const dashRoute = express.Router();
    dashRoute.get("/", async (req, res) => {
        try {
            
            const [rows] = await db.query(
                `SELECT 
                 (SELECT COUNT(*) FROM tbl_products) AS product,
                 (SELECT COUNT(*) FROM tbl_user) AS user,
                (SELECT COUNT(*) from blogs) AS blog,
                (SELECT SUM(ItemTotal) FROM tbl_order) AS Total`
            );
            res.json({ result: rows });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    

dashRoute.get("/weekly-stats", async (req, res) => {
  try {
    const sql = `
    SELECT 
    YEARWEEK(OrderDate, 1) AS week, 
    DATE_ADD(STR_TO_DATE(CONCAT(YEARWEEK(OrderDate, 1), ' Sunday'), '%X%V %W'), INTERVAL -6 DAY) AS week_start,
    DATE_ADD(STR_TO_DATE(CONCAT(YEARWEEK(OrderDate, 1), ' Sunday'), '%X%V %W'), INTERVAL 0 DAY) AS week_end,
    DAYNAME(DATE_ADD(STR_TO_DATE(CONCAT(YEARWEEK(OrderDate, 1), ' Sunday'), '%X%V %W'), INTERVAL -6 DAY)) AS start_day,
    SUM(ItemTotal) AS total_revenue,
    COUNT(DISTINCT OrderNumber) AS total_orders
FROM tbl_order
WHERE OrderDate >= DATE_SUB(CURDATE(), INTERVAL 6 WEEK)
GROUP BY week
ORDER BY week ASC

    `;

    const [result]= await db.query(sql);
    res.json(result);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


    export default dashRoute;