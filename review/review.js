"use client";
import express from "express";
import db from "../db/db.js";
import Joi from "joi";
const reviewRoute = express.Router();
const reviewSchema = Joi.object({
    product_id: Joi.number().required(),
    user_id: Joi.number().required(),
    rating: Joi.number().min(1).max(5).required(),
    review_text: Joi.string().allow(null, ""),
    order_number: Joi.string().allow(null, ""),
    review_title: Joi.string().allow(null, ""),
    order_date: Joi.date().required(),
});

reviewRoute.post("/", async (req, res) => {
    console.log(req.body);
    const { error } = reviewSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    try {
        const { product_id, user_id, rating, review_text, order_number , review_title, order_date } = req.body;
      const query = `
           INSERT INTO tbl_productreviews (product_id, user_id, rating, review_text, order_number, review_title, order_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await db.query(query, [product_id, user_id, rating, review_text, order_number , review_title, order_date ]);
      res.status(201).json({ message: "Review added successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  reviewRoute.get("/", async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const [rows] = await db.query(
            `SELECT r.*,r.review_id as id, u.FirstName as userName, p.ProductName,u.EmailID as emailAddress FROM tbl_productreviews r
            LEFT JOIN tbl_user u ON r.User_id = u.UserID
            LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
             LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );
        res.json({ page, limit, total: rows.length, result: rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

    reviewRoute.patch("/:id", async (req, res) => {
        try {
            const { status } = req.body;
            if (!req.params.id || isNaN(req.params.id)) {
                return res.status(400).json({ message: "Invalid review id" });
            }
            if (typeof status !== "number") {
                return res.status(400).json({ message: "Invalid status value" });
            }
            const [result] = await db.query(
                "UPDATE tbl_productreviews SET status=? WHERE review_id=?",
                [status, req.params.id]
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Review not found" });
            }
            res.status(200).json({ message: "Status updated successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    reviewRoute.delete("/:id", async (req, res) => {
        try {
            if (!req.params.id || isNaN(req.params.id)) {
                return res.status(400).json({ message: "Invalid review id" });
            }
            const [result] = await db.query("DELETE FROM tbl_productreviews WHERE review_id=?", [req.params.id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Review not found" });
            }
            res.status(200).json({ message: "Review deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    reviewRoute.get("/search", async (req, res) => {
        try {
            const { searchTerm = '', page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;
            if(searchTerm.trim() === '') {
                const [rows] = await db.query(
                    `SELECT r.*,r.review_id as id, u.FirstName as userName, p.ProductName,u.EmailID as emailAddress FROM tbl_productreviews r
                    LEFT JOIN tbl_user u ON r.User_id = u.UserID
                    LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
                     LIMIT ? OFFSET ?`,
                    [parseInt(limit), parseInt(offset)]
                );
                res.json({ page, limit, total: rows.length, result: rows });
            }
            // SQL query for filtering by search term (matches review_text or review_title)
            const query = `
                SELECT r.*,r.review_id as id, u.FirstName as userName, p.ProductName,u.EmailID as emailAddress FROM tbl_productreviews r
                LEFT JOIN tbl_user u ON r.User_id = u.UserID
                LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
                WHERE r.review_text LIKE ? OR r.review_title LIKE ? OR p.ProductName LIKE ? OR u.FirstName LIKE ? OR u.EmailID LIKE ? 
                LIMIT ? OFFSET ?
            `;
    
            const searchTerms = `%${searchTerm}%`; // Wildcard search for partial matches
            const [rows] = await db.query(query, [searchTerms, searchTerms,searchTerms,searchTerms,searchTerms, parseInt(limit), parseInt(offset)]);
    
            res.json({ page, limit, total: rows.length, result: rows });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    
    
export default reviewRoute;