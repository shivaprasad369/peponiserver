import express from 'express'
import db from '../db/db.js'
const newReviewRoute = express.Router();
import crypto, { createHmac } from "crypto";
import dotenv from "dotenv";

dotenv.config();
// const secret = 'abcdefg';
const SECRET_KEY ="1f7b1bfb4dd6e387d2a4b419e34b03c23f99dc0dafe4db3c6b6e5d6d5b4cf5e7"; // Load from .env
const IV_LENGTH = 16;
 // 16-byte IV (Initialization Vector)
// const SECRET_KEY = createHmac('sha256', secret)
//                .update('Peponi gallery')
//                .digest('hex');
// 🔹 Encrypt Function
export function encryptData(data) {
    if (!SECRET_KEY) throw new Error("SECRET_KEY is missing in .env");

    const key = Buffer.from(SECRET_KEY, "hex"); // Convert HEX string to buffer
    const iv = crypto.randomBytes(IV_LENGTH); // Generate a **random IV**

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted; // ✅ Return IV + Ciphertext
}

newReviewRoute.get('/search', async (req, res) => {
    try {
        const { searchTerm = '', page = 1, limit = 10, tab } = req.query;
        const offset = (page - 1) * limit;
        let query, queryParams, countQuery, countParams;
        
        console.log(searchTerm,page,limit,tab,offset)
        if (searchTerm.trim() === '') {
            query = `
                SELECT r.*,r.review_id as id, u.full_name as userName, p.ProductName,p.ProductUrl,u.email as emailAddress FROM tbl_productreviews r
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
                    p.ProductName,p.ProductUrl, u.email as emailAddress 
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

newReviewRoute.get('/all/:id', async (req, res) => {
    const { id } = req.params;
    let result = [];

    try {
        if (!id) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        // ✅ Fetch Product ID
        const [getData] = await db.query('SELECT ProductID FROM tbl_products WHERE ProductUrl = ?', [id]);

        if (getData.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        const productId = getData[0].ProductID;

        // ✅ Fetch Product Reviews
        const [rows] = await db.query(
            'SELECT rating, review_text, review_date, review_title, order_date, UserEmail FROM tbl_productreviews WHERE Product_id = ? AND status = ?', 
            [productId, 1]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "No reviews found for this product" });
        }

        // ✅ Fetch User Names in Parallel
        const userPromises = rows.map(async (row) => {
            const [getName] = await db.query('SELECT full_name FROM tbl_user WHERE email = ?', [row.UserEmail]);

            return {
                userName: getName.length > 0 ? getName[0].full_name : "Unknown User",
                ...row,
            };
        });

        result = await Promise.all(userPromises); // ✅ Resolve all queries in parallel

        // ✅ Encrypt data if needed
        // const encryptedData = encryptData(result);
        // return res.json({ data: encryptedData });

        res.json(result);
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

export default newReviewRoute
