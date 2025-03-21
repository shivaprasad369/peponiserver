import express from "express";
import db from "../db/db.js";

const notfyRoute = express.Router();

notfyRoute.get("/", async (req, res) => {
    try {
      // Fetch orders created in the last 24 hours
      const [orders] = await db.query(
        "SELECT * FROM tbl_order WHERE OrderDate >= NOW() - INTERVAL 1 DAY ORDER BY OrderDate DESC LIMIT 5"
      );
  
      // Fetch users registered in the last 24 hours
      const [users] = await db.query(
        "SELECT * FROM tbl_user WHERE created_at >= NOW() - INTERVAL 1 DAY ORDER BY created_at DESC LIMIT 5"
      );
      const [contact] = await db.query(
        "SELECT * FROM tbl_contact   WHERE CreatedAt >= NOW() - INTERVAL 1 DAY ORDER BY CreatedAt DESC LIMIT 5"
      );
      if (orders.length === 0 && users.length === 0 && contact.length === 0) {
        return res.status(404).json({ message: "No new notifications in the last 24 hours" });
      }
  
      res.status(200).json({
        message: "Notifications fetched successfully",
        orders: orders,
        users: users,
        contact: contact,
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Internal server error", error: error });
    }
  });
  


export default notfyRoute;

