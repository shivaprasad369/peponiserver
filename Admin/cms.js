import express from "express";
import db from "../db/db.js";
const cmsRoute = express.Router();
cmsRoute.post('/', async (req, res) => {
    const { header } = req.body;
    if(!header ){
        return res.status(400).json({message:"All fields are required"});
    }
   const [result] = await db.query('INSERT INTO cms (header) VALUES ( ?)', [ header]);
   if(result.affectedRows === 0){
    return res.status(400).json({message:"CMS creation failed"});
   }
   res.status(200).json({message:"CMS created successfully"});
  });
  
  cmsRoute.get('/', async (req, res) => {
 
   const [result] = await db.query('SELECT header,id FROM cms');
   if(result.length === 0){ 
    return res.status(400).json({message:"CMS failed"});
   }
   res.status(200).json({message:"CMS success",result:result});
  });


// Route to get a specific CMS entry by ID
cmsRoute.get('/:id', async (req, res) => {
    const { id } = req.params;
    if(!id){
        return res.status(400).json({message:"ID is required"});
    }
    try {
        
        const [result] = await db.query('SELECT * FROM cms WHERE id = ?', [id]);
          if (result.length === 0) {
            return res.status(404).json({message:"CMS entry not found"});
          }
          res.status(200).json({message:"CMS success",result:result});
          
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
      

  });
  
  // Route to update a CMS entry by ID
  cmsRoute.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    if(!id ||  !content){
        return res.status(400).json({message:"All fields are required"});
    }
    try {
        const [result] = await db.query('UPDATE cms SET  content = ? WHERE id = ?', [content, id]);
        if(result.affectedRows === 0){
            return res.status(404).json({message:"CMS entry not found"});
        }
        res.status(200).json({message:"CMS updated successfully"});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
   
  
  });
  
  



export default cmsRoute;