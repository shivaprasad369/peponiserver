import express from "express";
import db from "../db/db.js";

const attributeRoute = express.Router();
attributeRoute.get("/", async (req, res) => {
  const connection = await db.getConnection();
  try {
      const [attributes] = await connection.query(
          `SELECT a.attribute_name, v.value, a.CategoryID, a.id, v.id as value_id, 
          a.subcategory, a.subcategorytwo, c.CategoryName, 
          sc.CategoryName as subcategoryName, st.CategoryName as subcategorytwoName
          FROM attributes a
          JOIN attribute_values v ON a.id = v.attribute_id
          JOIN tbl_category c ON a.CategoryID = c.CategoryID 
          JOIN tbl_category sc ON a.subcategory = sc.CategoryID
          JOIN tbl_category st ON a.subcategorytwo = st.CategoryID`
      );
      
      if (attributes.length === 0) {
          return res.status(404).json({ message: "No attributes found for the categories" });
      }

      // Reducing to properly structure and group attributes with their values
      const result = attributes.reduce((acc, curr) => {
        // Find the category group
        let category = acc.find(item =>
          item.CategoryID === curr.CategoryID &&
          item.subcategory === curr.subcategory &&
          item.subcategorytwo === curr.subcategorytwo &&
          item.CategoryName === curr.CategoryName
        );
      
        // If category group doesn't exist, create it
        if (!category) {
          category = {
            CategoryID: curr.CategoryID,
            subcategory: curr.subcategory,
            subcategorytwo: curr.subcategorytwo,
            CategoryName: curr.CategoryName,
            subcategoryName: curr.subcategoryName,
            subcategorytwoName: curr.subcategorytwoName,
            attributes: [] // Initialize the attributes array
          };
          acc.push(category);
        }
      
        // Find or create the attribute within the category
        let existingAttribute = category.attributes.find(attr => attr.attribute_id === curr.id);
      
        if (!existingAttribute) {
          existingAttribute = {
            attribute_id: curr.id,
            attributeName: curr.attribute_name,
            values: [] // Initialize values array
          };
          category.attributes.push(existingAttribute);
        }
      
        // Add value if it doesn't already exist
        if (!existingAttribute.values.some(value => value.id === curr.value_id)) {
          existingAttribute.values.push({ id: curr.value_id, value: curr.value });
        }
      
        return acc;
      }, []);
      
      
      res.status(200).json(result);
  } catch (error) {
      res.status(500).json({ message: "Internal server error", error: error.message });
      console.error(error);
  } finally {
      connection.release();
  }
});


attributeRoute.post("/", async (req, res) => {
    const { Attributes ,categoryId,subCategoryId,subCategoryLv2Id } = req.body;

    if (!Attributes || !Array.isArray(Attributes)) {
        return res.status(400).json({ message: "Attributes must be provided as an array" });
    }
if(!categoryId || !subCategoryId || !subCategoryLv2Id || isNaN(categoryId) || isNaN(subCategoryId) || isNaN(subCategoryLv2Id)){
    return res.status(400).json({ message: "CategoryID,subcategory,subcategorytwo must be provided" });
}
    const connection = await db.getConnection(); 
    try {
        await connection.beginTransaction();
        for (const attribute of Attributes) {
            const [attributeResult] = await connection.query(
                "INSERT INTO attributes (attribute_name,CategoryID,subcategory,subcategorytwo) VALUES (?,?,?,?)",
                [attribute.attributeName,categoryId,subCategoryId,subCategoryLv2Id]
            );
            const attributeId = attributeResult.insertId; 
            for (const attributeValue of attribute.values) {
                await connection.query(
                    "INSERT INTO attribute_values (attribute_id, value) VALUES (?, ?)",
                    [attributeId, attributeValue]
                );
            }
        }

        await connection.commit();
        res.status(200).json({ message: "Attributes and values inserted successfully" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: "Internal server error", error: error.message });
        console.error(error);
    } finally {
        connection.release(); 
    }
});

attributeRoute.put("/", async (req, res) => {
  const { Attributes, categoryId, subCategoryId, subCategoryLv2Id } = req.body;

  if (!Attributes || !Array.isArray(Attributes)) {
    return res.status(400).json({ message: "Attributes must be provided as an array" });
  }

  if (
    !categoryId ||
    !subCategoryId ||
    !subCategoryLv2Id ||
    isNaN(categoryId) ||
    isNaN(subCategoryId) ||
    isNaN(subCategoryLv2Id)
  ) {
    return res
      .status(400)
      .json({ message: "CategoryID, subCategoryId, and subCategoryLv2Id must be valid numbers" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction(); // Start a transaction

    // Loop through each attribute
    for (const attribute of Attributes) {
      let attributeId = attribute.attributeId;
      const [attributePresent] = await connection.query('SELECT * FROM attributes WHERE id=?', [attributeId]);

      // Insert or update attribute
      if (attributePresent.length === 0) {
        const [insertResult] = await connection.query(
          `INSERT INTO attributes (attribute_name, CategoryID, subcategory, subcategorytwo)
           VALUES (?, ?, ?, ?)`,
          [attribute.attributeName, categoryId, subCategoryId, subCategoryLv2Id]
        );
        attributeId = insertResult.insertId; // Get the newly inserted attribute ID
        console.log(`Inserted new attribute with ID: ${attributeId}`);
      } else {
        console.log(`Processing attributeId: ${attributeId}, attributeName: ${attribute.attributeName}`);
        const [attributeResult] = await connection.query(
          `UPDATE attributes 
           SET attribute_name = ?, 
               CategoryID = ?, 
               subcategory = ?, 
               subcategorytwo = ? 
           WHERE id = ?`,
          [attribute.attributeName, categoryId, subCategoryId, subCategoryLv2Id, attributeId]
        );
        console.log(`Update result for attributeId ${attributeId}: affectedRows = ${attributeResult.affectedRows}`);
  
        if (attributeResult.affectedRows === 0) {
          throw new Error(`Attribute not found for attributeId: ${attributeId}`);
        }
      }

      // Delete existing values for the attribute
      const [deleteResult] = await connection.query("DELETE FROM attribute_values WHERE attribute_id = ?", [attributeId]);
      console.log(`Deleted ${deleteResult.affectedRows} rows from attribute_values for attributeId ${attributeId}`);

      if (deleteResult.affectedRows === 0) {
        console.log(`No values were deleted for attributeId: ${attributeId}`);
      }

      // Ensure attribute.values is an array and insert unique values
      if (attribute.values && Array.isArray(attribute.values)) {
        // Remove duplicates and insert unique values
        const uniqueValues = [];

        for (const value of attribute.values) {
          // Check if value has an 'id', and if not, create it
          const valueToInsert = value.id ? value : { value: value.value };

          // Check if the value already exists in the database
          const [existingValue] = await connection.query(
            "SELECT * FROM attribute_values WHERE attribute_id = ? AND value = ?",
            [attributeId, valueToInsert.value]
          );

          if (existingValue.length === 0) {
            uniqueValues.push([attributeId, valueToInsert.value]); // Add the value to the list for bulk insert
          }
        }

        // Insert unique values in bulk
        if (uniqueValues.length > 0) {
          await connection.query(
            "INSERT INTO attribute_values (attribute_id, value) VALUES ?",
            [uniqueValues]
          );
          console.log(`Inserted unique values: ${JSON.stringify(uniqueValues)}`);
        }
      } else {
        throw new Error(`Invalid or missing 'values' for attributeId: ${attributeId}`);
      }
    }

    // Commit the transaction if all queries are successful
    await connection.commit();
    res.status(200).json({ message: "Attributes and values updated successfully" });
  } catch (error) {
    await connection.rollback(); // Rollback the transaction in case of an error
    res.status(500).json({ message: "Internal server error", error: error.message });
    console.error(error);
  } finally {
    connection.release(); // Release the connection
  }
});


  
  
  attributeRoute.delete("/:id", async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
      await connection.query("DELETE FROM attributes WHERE id = ?", [id]);
      res.status(200).json({ message: "Attribute deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error", error: error.message });
      console.error(error);
    } finally {
      connection.release();
    }
  });



 export default attributeRoute;