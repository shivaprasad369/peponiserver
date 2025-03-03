"use client";
import express from "express";
import db from "../db/db.js";
import Joi from "joi";
const reviewRoute = express.Router();
const reviewSchema = Joi.object({
    product_id: Joi.number().required(),
    UserEmail:  Joi.string().required(),
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
        const { product_id, UserEmail, rating, review_text, order_number , review_title, order_date } = req.body;
      const query = `
           INSERT INTO tbl_productreviews (product_id, UserEmail, rating, review_text, order_number, review_title, order_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await db.query(query, [product_id, UserEmail, rating, review_text, order_number , review_title, order_date ]);
      res.status(201).json({ message: "Review added successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  reviewRoute.get("/", async (req, res) => {
    try {
        const { page = 1, limit = 10,tab } = req.query;
        const offset = (page - 1) * limit;
        const [rows] = await db.query(
            `SELECT r.*,r.review_id as id, u.full_name as userName, p.ProductName,u.email as emailAddress FROM tbl_productreviews r
            LEFT JOIN tbl_user u ON r.UserEmail = u.email
            LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
            WHERE r.status=?
             LIMIT ? OFFSET ?
             `
             
             ,
            [tab,parseInt(limit), parseInt(offset)]
        );
        res.json({ page, limit, total: rows.length, result: rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

reviewRoute.get('/:email',async(req,res)=>{
    try {
        const  {email}  = req.params;
        if (!email) {
            return res.status(400).json({ message: "email id is required" });
        }
        const [rows] = await db.query(
            `SELECT r.*,r.review_id as id,p.Image,p.ProductUrl, p.ProductName FROM tbl_productreviews r
            LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
            WHERE r.UserEmail=?
            ORDER BY r.review_id DESC
             `
             ,
            [email]
        );
        res.json({ result: rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})

reviewRoute.put("/update/:id", async (req, res) => {
    const {id}= req.params;
    const {  rating,review_text } = req.body;
    // const { error } = reviewSchema.validate({rating, review_text });
    // if (error) return res.status(400).json({ message: error.details[0].message });
    if(!rating || !review_text){
        return res.status(400).json({ message: "All fields are required" });  
    }

    try {
       const [response]= await db.query(
            "UPDATE tbl_productreviews SET rating=?, review_text=?,status=? WHERE review_id=?",
            [ rating, review_text,0, id]
        );
        // console
        console.log(response)
        if(response.affectedRows === 0){
            return res.status(404).json({ message: "Review not found" });
        }

        res.status(200).json({ message: "Review updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})
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
    reviewRoute.get('/search', async (req, res) => {
        try {
            const { searchTerm = '', page = 1, limit = 10, tab } = req.query;
            const offset = (page - 1) * limit;
            let query, queryParams, countQuery, countParams;
            
            console.log(searchTerm,page,limit,tab,offset)
            if (searchTerm.trim() === '') {
                query = `
                    SELECT r.*,r.review_id as id, u.full_name as userName, p.ProductName,u.email as emailAddress FROM tbl_productreviews r
            LEFT JOIN tbl_user u ON r.UserEmail = u.email
            LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
            WHERE r.status=?
             LIMIT ? OFFSET ?
                `;
                queryParams = [tab, parseInt(limit), parseInt(offset)];
    
                countQuery = `
                    SELECT COUNT(*) as total 
                    FROM tbl_productreviews r
                    LEFT JOIN tbl_user u ON r.UserEmail = u.email
                    LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
                    WHERE r.status = ?
                `;
                countParams = [Number(tab)];
            } else {
                query = `
                    SELECT r.*, r.review_id as id, u.full_name as userName, 
                        p.ProductName, u.email as emailAddress 
                    FROM tbl_productreviews r
                    LEFT JOIN tbl_user u ON r.UserEmail = u.email
                    LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
                    WHERE r.status = ? 
                    AND (
                        r.review_text LIKE ? 
                        OR r.review_title LIKE ? 
                        OR p.ProductName LIKE ? 
                        OR u.full_name LIKE ? 
                        OR u.email LIKE ?
                    )
                    LIMIT ? OFFSET ?
                `;
                const searchTerms = `%${searchTerm}%`;
                queryParams = [Numver(tab), searchTerms, searchTerms, searchTerms, searchTerms, searchTerms, parseInt(limit), parseInt(offset)];
    
                countQuery = `
                    SELECT COUNT(*) as total 
                    FROM tbl_productreviews r
                    LEFT JOIN tbl_user u ON r.UserEmail = u.email
                    LEFT JOIN tbl_products p ON r.Product_id = p.ProductID
                    WHERE r.status = ? 
                    AND (
                        r.review_text LIKE ? 
                        OR r.review_title LIKE ? 
                        OR p.ProductName LIKE ? 
                        OR u.full_name LIKE ? 
                        OR u.email LIKE ?
                    )
                `;
                countParams = [tab, searchTerms, searchTerms, searchTerms, searchTerms, searchTerms];
            }
    
            const [rows] = await db.query(query, queryParams);
            const [totalResult] = await db.query(countQuery, countParams);
    
            res.json({ page, limit, total: totalResult[0].total, result: rows });
    
        } catch (error) {
            console.error("Error fetching reviews:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    });
    

    reviewRoute.get('/present/:id', async (req, res) => {
        const { id } = req.params;
    
        if (!id) {
            return res.status(400).json({ message: "Valid Order ID is required" });
        }
    
        try {
            const list = [];
            
            // Fetch all ProductIDs for the given OrderNumber
            const [products] = await db.query(
                `SELECT ProductID FROM tbl_order WHERE OrderNumber = ?`,
                [id]
            );
    
            if (products.length === 0) {
                return res.status(404).json({ message: "No products found for this order" });
            }
    
            // Check if reviews exist for each product in the order
            for (const product of products) {
                const [review] = await db.query(
                    `SELECT Product_id FROM tbl_productreviews WHERE order_number = ? AND Product_id = ?`,
                    [id, product.ProductID]
                );
    
                if (review.length > 0) {
                    list.push(review[0]); // Add review to list
                }
            }
    
            res.json(list);
        } catch (error) {
            console.error("Error fetching reviews:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    
    
    
export default reviewRoute;