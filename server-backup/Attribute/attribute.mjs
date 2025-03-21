import express from "express";
import db from "../db/db.js";

const attributeRoute = express.Router();
attributeRoute.get("/", async (req, res) => {
  const connection = await db.getConnection();
  try {
      const [attributes] = await connection.query(
          `SELECT a.attribute_name, v.value,  a.id as attribute_id, v.id as value_id
          FROM attributes a
          JOIN attribute_values v ON a.id = v.attribute_id
         
          `
      );
      // SELECT a.attribute_name, v.value, a.CategoryID, a.id, v.id as value_id, 
      //     a.subcategory, a.subcategorytwo, c.CategoryName, 
      //     sc.CategoryName as subcategoryName, st.CategoryName as subcategorytwoName
      //     FROM attributes a
      //     JOIN attribute_values v ON a.id = v.attribute_id
      //     JOIN tbl_category c ON a.CategoryID = c.CategoryID 
      //     JOIN tbl_category sc ON a.subcategory = sc.CategoryID
      //     JOIN tbl_category st ON a.subcategorytwo = st.CategoryID
      
      if (attributes.length === 0) {
          return res.status(404).json({ message: "No attributes found for the categories" });
      }

      const result = attributes.reduce((acc, curr) => {
        let existingAttribute = acc.find(attr => attr.attribute_id === curr.attribute_id);
        
        if (!existingAttribute) {
          existingAttribute = {
            attribute_id: curr.attribute_id,
            attributeName: curr.attribute_name,
            values: []
          };
          acc.push(existingAttribute);
        }
  
        // Add value if not already present
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

attributeRoute.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await db.getConnection();
        const [attributes] = await connection.query(`SELECT 
            a.attribute_name, v.value, a.CategoryID, a.id, v.id as value_id,
            a.subcategory, a.subcategorytwo, c.CategoryName,
            sc.CategoryName as subcategoryName,
            sct.CategoryName as subcategorytwoName
            FROM attributes a
            JOIN attribute_values v ON a.id = v.attribute_id 
            JOIN tbl_category c ON a.CategoryID = c.CategoryID
            JOIN tbl_category sc ON a.subcategory = sc.CategoryID
            LEFT JOIN tbl_category sct ON a.subcategorytwo = sct.CategoryID
            WHERE a.id = ?`, [id]);

        if (attributes.length === 0) {
            return res.status(404).json({ message: "Attribute not found" });
        }

        const result = attributes.reduce((acc, curr) => {
            let category = acc.find(item =>
                item.CategoryID === curr.CategoryID &&
                item.subcategory === curr.subcategory &&
                item.CategoryName === curr.CategoryName
            );

            if (!category) {
                category = {
                    CategoryID: curr.CategoryID,
                    subcategory: curr.subcategory, 
                    subcategorytwo: curr.subcategorytwo,
                    CategoryName: curr.CategoryName,
                    subcategoryName: curr.subcategoryName,
                    subcategorytwoName: curr.subcategorytwoName,
                    attributes: []
                };
                acc.push(category);
            }

            let existingAttribute = category.attributes.find(attr => attr.attribute_id === curr.id);

            if (!existingAttribute) {
                existingAttribute = {
                    attribute_id: curr.id,
                    attributeName: curr.attribute_name,
                    values: []
                };
                category.attributes.push(existingAttribute);
            }

            if (!existingAttribute.values.some(value => value.id === curr.value_id)) {
                existingAttribute.values.push({ id: curr.value_id, value: curr.value });
            }

            return acc;
        }, []);

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error.message });
        console.error(error);
    }
});

attributeRoute.post("/", async (req, res) => {
    const { Attributes } = req.body;

    if (!Attributes || !Array.isArray(Attributes)) {
        return res.status(400).json({ message: "Attributes must be provided as an array" });
    }

    const connection = await db.getConnection(); 
    try {
        await connection.beginTransaction();
        for (const attribute of Attributes) {
            const [attributeResult] = await connection.query(
                "INSERT INTO attributes (attribute_name) VALUES (?)",
                [attribute.attributeName]
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
  const { Attributes, categoryId, subCategoryId } = req.body;
// console.log(Attributes[0].values[0].id);
console.log(Attributes)
  if (!Attributes || !Array.isArray(Attributes)) {
    return res.status(400).json({ message: "Attributes must be provided as an array" });
  }

 

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    let PresentedValues = [];
    for (const attribute of Attributes) {
      let attributeId = attribute.attributeId;
      const [attributePresent] = await connection.query('SELECT * FROM attributes WHERE id=? FOR UPDATE', [attributeId]);
      if (attributePresent.length === 0) {
        const [insertResult] = await connection.query(
          `INSERT INTO attributes (attribute_name)
           VALUES (?)`,
          [attribute.attributeName]
        );
        attributeId = insertResult.insertId; 
        console.log(`Inserted new attribute with ID: ${attributeId}`);
      } else {
        console.log(`Processing attributeId: ${attributeId}, attributeName: ${attribute.attributeName}`);
        const [attributeResult] = await connection.query(
          `UPDATE attributes 
           SET attribute_name = ?  
           WHERE id = ?`,
          [attribute.attributeName, attributeId]
        );
        console.log(`Update result for attributeId ${attributeId}: affectedRows = ${attributeResult.affectedRows}`);
  
        if (attributeResult.affectedRows === 0) {
          throw new Error(`Attribute not found for attributeId: ${attributeId}`);
        }
      }
     
      // console.log("attribute",attribute.values);
      const [Present] = await connection.query("SELECT * FROM attribute_values WHERE id NOT IN (?) AND attribute_id = ? LOCK IN SHARE MODE", [attribute.values.map(value => value.id),attributeId]);
      if(Present.length >0){
        const filteredPresent = Present.filter(value => !attribute.values.some(attrValue => attrValue.id === value.id));
        PresentedValues.push(filteredPresent);
      }
      for(const value of attribute.values){
        if(value.id){
            
        
            const [updateResult] = await connection.query("UPDATE attribute_values SET value = ? WHERE id = ?", [value.value, value.id]);
            console.log(`Updated value for attributeId ${attributeId}: affectedRows = ${updateResult.affectedRows}`);
        

        }
        else{
          const [insertResult] = await connection.query("INSERT INTO attribute_values (attribute_id, value) VALUES (?, ?)", [attributeId, value.value]);
          console.log(`Inserted new value for attributeId ${attributeId}: insertId = ${insertResult.insertId}`);
        }
      }
      if (attribute.values && Array.isArray(attribute.values)) {
        const uniqueValues = [];

        for (const value of attribute.values) {
          const valueToInsert = value.id ? value : { value: value.value };
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
console.log("PresentedValues", PresentedValues);
    if (PresentedValues.length > 0) {
      // Flatten the array of arrays and map to get IDs
      const idsToDelete = PresentedValues.flat().map(value => value.id);
      if (idsToDelete.length > 0) {
        const [deleteResult] = await connection.query("DELETE FROM attribute_values WHERE id IN (?)", [idsToDelete]);
        console.log("deleteResult", deleteResult);
        // console.log(`Deleted values: ${JSON.stringify(idsToDelete)}`);
      }
    }
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