import express from "express";
import db from "../db/db.js";
import dotenv from "dotenv";
dotenv.config();
const faqRoute = express.Router();


faqRoute.post('/', async (req, res) => {
    const { question, answer } = req.body;
    if(!question || !answer){
        return res.status(400).json({message:"All fields are required"});
    }
    try {
        const [result] = await db.query('INSERT INTO faqs (question, answer) VALUES (?, ?)', [question, answer]);
        if(result.affectedRows === 0){
            return res.status(400).json({message:"FAQ creation failed"});
        }
        res.status(200).json({message:"FAQ created successfully"});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }    
  });
  
  // Route to get all FAQs
 faqRoute.get('/', async (req, res) => {
    try {
        const [result] = await db.query('SELECT id, question, answer FROM faqs ORDER BY id DESC');
        if(result.length === 0){
            return res.status(400).json({message:"FAQ failed"});
        }
        res.status(200).json({message:"FAQ success",result:result});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
  });
  
  // Route to get a specific FAQ by ID
 faqRoute.get('/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
        const [result] = await db.query('SELECT * FROM faqs WHERE id = ?', [id]);
        if(result.length === 0){
            return res.status(400).json({message:"FAQ failed"});
        }
        res.status(200).json({message:"FAQ success",result:result});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
  });
  
  
  // Route to update a FAQ by ID
 faqRoute.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { question, answer } = req.body;
    if(!question || !answer){
        return res.status(400).json({message:"All fields are required"});
    }
    try {
        const [result] = await db.query('UPDATE faqs SET question = ?, answer = ? WHERE id = ?', [question, answer, id]);
        if(result.affectedRows === 0){
            return res.status(400).json({message:"FAQ update failed"});
        }
        res.status(200).json({message:"FAQ updated successfully"});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
  });
  
  
  // Route to delete a FAQ by ID
 faqRoute.delete('/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
        const [result] = await db.query('DELETE FROM faqs WHERE id = ?', [id]);
        if(result.affectedRows === 0){
            return res.status(400).json({message:"FAQ delete failed"});
        }
        res.status(200).json({message:"FAQ deleted successfully"});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
  });
  
export default faqRoute;
