import express from "express";
import db from "../db/db.js";
import dotenv from "dotenv";
dotenv.config();
const newsletterRoute = express.Router();

newsletterRoute.get("/", async (req, res) => {
    try {
        const [result] = await db.query("SELECT * FROM subscribers ");
        res.status(200).json({ message: "Newsletter fetched successfully", result: result });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error });
    }
});

newsletterRoute.post("/", async (req, res) => {
  const { email } = req.body;
  if(!email){
    return res.status(400).json({ message: "Email is required" });
  }
  try {
    const [result] = await db.query("SELECT * FROM subscribers WHERE email = ?", [email]);
    if(result.length > 0){
      return res.status(400).json({ message: "Email already exists" });
    }
    const [result1] = await db.query("INSERT INTO subscribers (email) VALUES (?)", [email]);
    res.status(200).json({ message: "Newsletter subscribed successfully",result:result1 });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error });
  }
});

newsletterRoute.delete("/:id", async (req, res) => {
  const id = req.params.id;
  if(!id || isNaN(id)){
    return res.status(400).json({ message: "Id is not valid" });
  }
  try {
    const [result] = await db.query("DELETE FROM subscribers WHERE id = ?", [id]);
    if(result.affectedRows === 0){
      return res.status(404).json({ message: "Subscriber not found" });
    }
    res.status(200).json({ message: "Newsletter unsubscribed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error });
  }
});

export default newsletterRoute;
