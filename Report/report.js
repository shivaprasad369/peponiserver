import express from "express";
import db from "../db/db.js";

const reportRoute = express.Router();

reportRoute.get("/sales", async (req, res) => {
    try {
        let { reportType, yearValue, month, startDate, endDate,halfYearOption, quarterOption } = req.query;
        let halfYear = halfYearOption ;
        let quarter = quarterOption;
        let year = yearValue;

        const currentDate = new Date();
        let query = "";
        let queryParams = [];

        switch (reportType) {
            case "current":
                // Fetch sales for the current month
                year = year || currentDate.getFullYear();
                month = month || currentDate.getMonth() + 1; // JS months are 0-indexed, SQL is 1-based
                query = `
                    SELECT p.ProductName, u.full_name AS UserName, o.UserEmail, o.OrderNumber, o.OrderDate, o.Qty, o.Price
                    FROM tbl_products p
                    JOIN tbl_order o ON p.ProductID = o.ProductID
                    JOIN tbl_user u ON u.email = o.UserEmail
                    WHERE YEAR(o.OrderDate) = ? AND MONTH(o.OrderDate) = ?
                    ORDER BY o.OrderDate ASC
                `;
                queryParams = [year, month];
                break;

            case "year":
                // Fetch sales for the given year
                year = year || currentDate.getFullYear();
                query = `
                    SELECT p.ProductName, u.full_name AS UserName, o.UserEmail, o.OrderNumber, o.OrderDate, o.Qty, o.Price
                    FROM tbl_products p
                    JOIN tbl_order o ON p.ProductID = o.ProductID
                    JOIN tbl_user u ON u.email = o.UserEmail
                    WHERE YEAR(o.OrderDate) = ?
                    ORDER BY o.OrderDate ASC
                `;
                queryParams = [year];
                break;

            case "custom":
                // Fetch sales between two dates
                if (!startDate || !endDate) {
                    return res.status(400).json({ message: "startDate and endDate are required for datebetween reportType." });
                }
                query = `
                    SELECT p.ProductName, u.full_name AS UserName, o.UserEmail, o.OrderNumber, o.OrderDate, o.Qty, o.Price
                    FROM tbl_products p
                    JOIN tbl_order o ON p.ProductID = o.ProductID
                    JOIN tbl_user u ON u.email = o.UserEmail
                    WHERE o.OrderDate BETWEEN ? AND ?
                    ORDER BY o.OrderDate ASC
                `;
                queryParams = [startDate, endDate];
                break;

            case "half":
                // Fetch sales for H1 (Jan-Jun) or H2 (Jul-Dec)
                year = year || currentDate.getFullYear();
                if (halfYear === "H1") {
                    query = `
                        SELECT p.ProductName, u.full_name AS UserName, o.UserEmail, o.OrderNumber, o.OrderDate, o.Qty, o.Price
                        FROM tbl_products p
                        JOIN tbl_order o ON p.ProductID = o.ProductID
                        JOIN tbl_user u ON u.email = o.UserEmail
                        WHERE YEAR(o.OrderDate) = ? AND MONTH(o.OrderDate) BETWEEN 1 AND 6
                        ORDER BY o.OrderDate ASC
                    `;
                } else if (halfYear === "H2") {
                    query = `
                        SELECT p.ProductName, u.full_name AS UserName, o.UserEmail, o.OrderNumber, o.OrderDate, o.Qty, o.Price
                        FROM tbl_products p
                        JOIN tbl_order o ON p.ProductID = o.ProductID
                        JOIN tbl_user u ON u.email = o.UserEmail
                        WHERE YEAR(o.OrderDate) = ? AND MONTH(o.OrderDate) BETWEEN 7 AND 12
                        ORDER BY o.OrderDate ASC
                    `;
                } else {
                    return res.status(400).json({ message: "Invalid halfYear value. Use 'H1' or 'H2'." });
                }
                queryParams = [year];
                break;

            case "quarter":
                // Fetch sales for a specific quarter (Q1, Q2, Q3, Q4)
                year = year || currentDate.getFullYear();
                let monthRange = [];
                if (quarter === "Q1") monthRange = [1, 3];
                else if (quarter === "Q2") monthRange = [4, 6];
                else if (quarter === "Q3") monthRange = [7, 9];
                else if (quarter === "Q4") monthRange = [10, 12];
                else return res.status(400).json({ message: "Invalid quarter value. Use 'Q1', 'Q2', 'Q3', or 'Q4'." });

                query = `
                    SELECT p.ProductName, u.full_name AS UserName, o.UserEmail, o.OrderNumber, o.OrderDate, o.Qty, o.Price
                    FROM tbl_products p
                    JOIN tbl_order o ON p.ProductID = o.ProductID
                    JOIN tbl_user u ON u.email = o.UserEmail
                    WHERE YEAR(o.OrderDate) = ? AND MONTH(o.OrderDate) BETWEEN ? AND ?
                    ORDER BY o.OrderDate ASC
                `;
                queryParams = [year, ...monthRange];
                break;

            default:
                return res.status(400).json({ message: "Invalid reportType. Use 'currentmonth', 'year', 'datebetween', 'halfyear', or 'quarter'." });
        }

        // Execute the query
        const [sales] = await db.query(query, queryParams);

        // Format response data
        const formattedSales = sales.map((sale) => ({
            OrderNumber: sale.OrderNumber,
            ProductName: sale.ProductName,
            UserName: sale.UserName,
            UserEmail: sale.UserEmail,
            OrderDate: sale.OrderDate, // Extract YYYY-MM-DD from ISO format
            Quantity: sale.Qty,
            Price: Number(parseFloat(sale.Price).toFixed(2))
        }));

        // Group sales by OrderNumber
        const groupedSales = formattedSales.reduce((acc, sale) => {
            if (!acc[sale.OrderNumber]) {
                acc[sale.OrderNumber] = {
                    OrderNumber: sale.OrderNumber,
                    UserName: sale.UserName,
                    UserEmail: sale.UserEmail,
                    OrderDate: sale.OrderDate,
                    Items: []
                };
            }
            acc[sale.OrderNumber].Items.push({
                ProductName: sale.ProductName,
                Quantity: sale.Quantity,
                Price: sale.Price
            });
            return acc;
        }, {});

        // Convert grouped sales into an array format
        const formattedResponse = Object.values(groupedSales);

        res.json({ reportType, year, month, sales: formattedResponse });

    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ message: error.message });
    }
});

export default reportRoute;
