
import express from "express";
import db from "../db/db.js";
import path from 'path';
import { fileURLToPath } from 'url';
import upload from "../uploads.js";
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bannerRouter = express.Router();
bannerRouter.post("/", upload.single("bannerImage"), (req, res) => {
try {
  const { bannerTitle, bannerText, description,  } =
    req.body;

  if (!req.file) {
    console.log("No file uploaded.");
    return res.status(400).json({ message: "No file uploaded!" });
  }

  const bannerImage = `/uploads/${req.file.filename}`;
  console.log("Banner image path:", bannerImage);

  const query = `
        INSERT INTO tbl_banner (BannerImage, BannerTitle, BannerText, Description)
        VALUES (?, ?, ?, ?)
    `;
  const values = [
    bannerImage,
    bannerTitle,
    bannerText,
    description,
  ];
  const res1 = db.query(query, values);

  if (res1) {
    res.status(200).json({ message: "Banner added successfully!" });
  }
} catch (err) {
  console.error("Error adding banner:", err);
  res.status(500).json({ message: "Failed to add banner" });
}
});


bannerRouter.get("/get/:id", async (req, res) => {
  try {
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: "Missing banner ID" });
    }
    const query = "SELECT * FROM tbl_banner WHERE BannerID=?";
    const [results] = await db.query(query, [req.params.id]);
    res.status(200).json({result:results});
  } catch (err) {
    console.error("Error fetching banner:", err);
    res.status(500).json({ message: "Failed to fetch banner" });
  }
});
bannerRouter.get("/", async (req, res) => {
  try {
    const query = "SELECT * FROM tbl_banner";
    const [results] = await db.query(query);
    res.status(200).json({result:results});
  } catch (err) {
    console.error("Error fetching banners:", err);
    res.status(500).json({ message: "Failed to fetch banners" });
  }
});

bannerRouter.patch("/update/:id", upload.single("bannerImage"), async (req, res) => {
  try {
    const bannerId = req.params.id;

    // Validate banner ID
    if (!bannerId || !Number.isInteger(Number(bannerId))) {
      return res.status(400).json({ message: "Invalid banner ID" });
    }

    const { bannerTitle, bannerText, description } = req.body;
    let updatedImagePath = null;

    // Handle new image upload
    if (req.file) {
      const [bannerResult] = await db.query("SELECT BannerImage FROM tbl_banner WHERE BannerId = ?", [bannerId]);

      if (bannerResult.length > 0 && bannerResult[0].BannerImage) {
        const oldImagePath = path.join(__dirname, "..", bannerResult[0].BannerImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log("Old image deleted successfully");
        } else {
          console.log("Old image not found, skipping deletion");
        }
      }
      updatedImagePath = `/uploads/${req.file.filename}`;
    }

    // Dynamically construct SQL query based on provided fields
    let updateFields = [];
    let values = [];

    if (updatedImagePath) {
      updateFields.push("BannerImage = ?");
      values.push(updatedImagePath);
    }
    if (bannerTitle) {
      updateFields.push("BannerTitle = ?");
      values.push(bannerTitle);
    }
    if (bannerText) {
      updateFields.push("BannerText = ?");
      values.push(bannerText);
    }
    if (description) {
      updateFields.push("Description = ?");
      values.push(description);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No updates provided" });
    }

    values.push(Number(bannerId));

    const query = `UPDATE tbl_banner SET ${updateFields.join(", ")} WHERE BannerId = ?`;

    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Banner update failed or no changes detected" });
    }

    res.status(200).json({ message: "Banner updated successfully!" });

  } catch (err) {
    console.error("Error updating banner:", err);
    res.status(500).json({ message: "Failed to update banner" });
  }
});

bannerRouter.delete("/:id", async (req, res) => {
  try {
    const bannerId = req.params.id;
    if (!bannerId ||!Number.isInteger(Number(bannerId))) {
      return res.status(400).json({ message: "Invalid banner ID" });
    }
    const [bannerResult] = await db.query("SELECT BannerImage FROM tbl_banner WHERE BannerId =?", [bannerId]);
    if (bannerResult.length === 0) {
      return res.status(404).json({ message: "Banner not found" });
    }
    const oldImagePath = path.join(__dirname, "..", bannerResult[0].BannerImage);
    if (fs.existsSync(oldImagePath))
    {
      fs.unlinkSync(oldImagePath);
      console.log("Old image deleted successfully");
    }
    const query = "DELETE FROM tbl_banner WHERE BannerId = ?";
    const [result] = await db.query(query, [bannerId]);
    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Failed to delete banner" });
    }
    res.status(200).json({ message: "Banner deleted successfully!" });
  } catch (err) {
    console.error("Error deleting banner:", err);
    res.status(500).json({ message: "Failed to delete banner" });
  }
});

bannerRouter.put('/status/:id', async (req, res) => { 
  try {
    const status = req.body.status;
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: "Invalid banner ID" });
    }
    const [result] = await db.query(
      "UPDATE tbl_banner SET status=? WHERE BannerId=?",
      [status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Banner not found" });
    }
    res.status(200).json({ message: "Status updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
bannerRouter.get('/frontend',async(req,res)=>{
  try {
    const query = `SELECT b.BannerImage,b.BannerTitle FROM tbl_banner b
     WHERE b.Status=1`;
    const [results] = await db.query(query);
    res.status(200).json({result:results});
  } catch (err) {
    console.error("Error fetching banners:", err);
    res.status(500).json({ message: "Failed to fetch banners" });
  }
});
export default bannerRouter;