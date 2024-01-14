const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config(); // Load environment variables from .env file

const app = express();

const corsOptions = {
  origin: "https://klinikkartika.up.railway.app",
  credentials: true,
  exposedHeaders: ["Set-Cookie"],
};

app.use(cors(corsOptions));

const dbConfig = {
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
};

const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const createConnection = async () => {
  return await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    port: dbConfig.port,
  });
};

const sessionStore = new MySQLStore(
  {
    ...dbConfig,
    clearExpired: true,
  },
  pool
);

// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   res.setHeader(
//     "Access-Control-Allow-Methods",
//     "GET,POST,PUT,PATCH,DELETE,OPTIONS"
//   );
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

//   next();
// });

app.use(
  session({
    secret: "session",
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      maxAge: 3600000,
    },
  })
);

// app.options("*", (req, res) => {
//   res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type");
//   res.status(200).end();
// });

app.use(express.json());

app.post("/login", async (req, res) => {
  console.log("Payload:", req.body);
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Username dan password harus diisi." });
  }

  try {
    const [results] = await pool.query(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );

    if (results.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Username atau password salah." });
    }

    const user = results[0];

    // Simpan informasi login ke dalam session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    // Log the session data
    console.log("Session data after login:", req.session);

    // Menentukan halaman berdasarkan role
    let redirectPage;
    switch (user.role) {
      case "admin":
        redirectPage = "/Admin";
        break;
      case "dokter":
        redirectPage = "/Dokter";
        break;
      case "apoteker":
        redirectPage = "/Apoteker";
        break;
      case "pemilik":
        redirectPage = "/Pemilik";
        break;
      case "perawat":
        redirectPage = "/Perawat";
        break;
      default:
        redirectPage = "/404";
    }

    console.log("Login successful:", req.session.user);

    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
      redirectPage,
    });
  } catch (err) {
    console.error("Login failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to fetch apoteker data based on username
app.get("/apoteker", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const [results] = await pool.query(
      "SELECT id, username, role, nama, no_telp, alamat FROM apoteker WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Apoteker not found" });
    }

    const apotekerData = results[0];
    res.json({ success: true, apoteker: apotekerData });
  } catch (error) {
    console.error("Error fetching apoteker data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/apoteker/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedApotekerData = req.body;

    // Log incoming data for debugging
    console.log("Incoming apoteker update data:", updatedApotekerData);

    const [results] = await pool.query("UPDATE apoteker SET ? WHERE id = ?", [
      updatedApotekerData,
      id,
    ]);

    // Check if the update was successful
    if (results.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Apoteker not found" });
    }

    res.json({ success: true, message: "Apoteker data updated successfully" });
  } catch (error) {
    console.error("Error updating apoteker data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/apoteker/change-password/:id", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const [results] = await pool.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [newPassword, id]
    );

    if (results.affectedRows === 1) {
      res.json({ success: true, message: "Password updated successfully." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (err) {
    console.error("Error updating password:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint untuk mendapatkan data dokter berdasarkan username
app.get("/dokter", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const [results] = await pool.query(
      "SELECT id, username, role, nama, no_telp, alamat FROM dokter WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Dokter not found" });
    }

    const dokterData = results[0];
    res.json({ success: true, dokter: dokterData });
  } catch (error) {
    console.error("Error fetching dokter data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/dokter/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedDokterData = req.body;

    // Log incoming data for debugging
    console.log("Incoming dokter update data:", updatedDokterData);

    const [results] = await pool.query("UPDATE dokter SET ? WHERE id = ?", [
      updatedDokterData,
      id,
    ]);

    // Check if the update was successful
    if (results.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Dokter not found" });
    }

    res.json({ success: true, message: "Dokter data updated successfully" });
  } catch (error) {
    console.error("Error updating dokter data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/dokter/change-password/:id", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const [results] = await pool.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [newPassword, id]
    );

    if (results.affectedRows === 1) {
      res.json({ success: true, message: "Password updated successfully." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (err) {
    console.error("Error updating password:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint untuk mendapatkan data perawat berdasarkan username
app.get("/perawat", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const [results] = await pool.query(
      "SELECT id, username, role, nama, no_telp, alamat FROM perawat WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Perawat not found" });
    }

    const perawatData = results[0];
    res.json({ success: true, perawat: perawatData });
  } catch (error) {
    console.error("Error fetching perawat data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/perawat/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPerawatData = req.body;

    // Log incoming data for debugging
    console.log("Incoming perawat update data:", updatedPerawatData);

    const [results] = await pool.query("UPDATE perawat SET ? WHERE id = ?", [
      updatedPerawatData,
      id,
    ]);

    // Check if the update was successful
    if (results.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Perawat not found" });
    }

    res.json({ success: true, message: "Perawat data updated successfully" });
  } catch (error) {
    console.error("Error updating perawat data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/perawat/change-password/:id", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const [results] = await pool.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [newPassword, id]
    );

    if (results.affectedRows === 1) {
      res.json({ success: true, message: "Password updated successfully." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (err) {
    console.error("Error updating password:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint untuk mendapatkan data pemilik berdasarkan username
app.get("/pemilik", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const [results] = await pool.query(
      "SELECT id, username, role, nama, no_telp, alamat FROM pemilik WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Pemilik not found" });
    }

    const pemilikData = results[0];
    res.json({ success: true, pemilik: pemilikData });
  } catch (error) {
    console.error("Error fetching pemilik data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Update Pemilik Data
app.put("/pemilik/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPemilikData = req.body;

    // Log incoming data for debugging
    console.log("Incoming pemilik update data:", updatedPemilikData);

    const [results] = await pool.query("UPDATE pemilik SET ? WHERE id = ?", [
      updatedPemilikData,
      id,
    ]);

    // Check if the update was successful
    if (results.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Pemilik not found" });
    }

    // Fetch the updated pemilik data from the database
    const [updatedPemilik] = await pool.query(
      "SELECT * FROM pemilik WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Pemilik data updated successfully",
      pemilik: updatedPemilik[0],
    });
  } catch (error) {
    console.error("Error updating pemilik data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/pemilik/change-password/:id", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const [results] = await pool.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [newPassword, id]
    );

    if (results.affectedRows === 1) {
      res.json({ success: true, message: "Password updated successfully." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (err) {
    console.error("Error updating password:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to fetch admin data based on username
app.get("/admin", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    const [results] = await pool.query(
      "SELECT id, username, role, nama, no_telp, alamat FROM admin WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    const adminData = results[0];
    res.json({ success: true, admin: adminData });
  } catch (error) {
    console.error("Error fetching admin data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint to update admin data
app.put("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedAdminData = req.body;

    // Log incoming data for debugging
    console.log("Incoming admin update data:", updatedAdminData);

    const [results] = await pool.query("UPDATE admin SET ? WHERE id = ?", [
      updatedAdminData,
      id,
    ]);

    // Check if the update was successful
    if (results.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    res.json({ success: true, message: "Admin data updated successfully" });
  } catch (error) {
    console.error("Error updating admin data:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/admin/change-password/:id", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const [results] = await pool.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [newPassword, id]
    );

    if (results.affectedRows === 1) {
      res.json({ success: true, message: "Password updated successfully." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (err) {
    console.error("Error updating password:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/tambahuser", async (req, res) => {
  const { username, role } = req.body;

  if (!username || !role) {
    return res
      .status(400)
      .json({ success: false, message: "Username and role are required." });
  }

  try {
    const password = "password";

    const [result] = await pool.query(
      "INSERT INTO users (username, role, password) VALUES (?, ?, ?)",
      [username, role, password]
    );

    const [newUser] = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ]);

    res.status(201).json({ success: true, user: newUser[0] });
  } catch (error) {
    console.error("Error adding user:", error.message);
    res.status(500).json({ success: false, error: error.message }); // Send detailed error message in the response
  }
});

app.get("/users/:role", async (req, res) => {
  const role = req.params.role;

  try {
    const [results] = await pool.query("SELECT * FROM users WHERE role = ?", [
      role,
    ]);
    res.json({ success: true, users: results });
  } catch (error) {
    console.error("Error fetching users by role:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint to fetch obat data with optional filter by jenis
app.get("/obat", async (req, res) => {
  try {
    const { jenis } = req.query; // Get the jenis parameter from the query

    let query = "SELECT * FROM obat";
    let queryParams = [];

    // Check if jenis parameter is provided
    if (jenis) {
      query += " WHERE jenis = ?";
      queryParams = [jenis];
    }

    const connection = await pool.getConnection();

    try {
      const [results] = await connection.query(query, queryParams);
      res.json({ success: true, obat: results });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /obat endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint to fetch user data
app.get("/user", (req, res) => {
  // Check if the user is logged in
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }

  // If logged in, return user data
  const user = req.session.user;
  console.log("Session data:", req.session);
  res.json({ success: true, user });
});

// Endpoint to get users
app.get("/users", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [results] = await connection.query("SELECT * FROM users");
      res.json({ success: true, users: results });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /users endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint to get all data from detail_transaksi with obat details
app.get("/detail_transaksi", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT dt.*, o.nama_obat
        FROM detail_transaksi dt
        LEFT JOIN obat o ON dt.obat_id = o.id
      `;
      const [results] = await connection.query(query);
      res.json({ success: true, detail_transaksi: results });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /detail_transaksi endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint to delete a user
app.delete("/users/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const connection = await pool.getConnection();
    try {
      // Check if the user exists
      const [checkResults] = await connection.query(
        "SELECT * FROM users WHERE id = ?",
        [userId]
      );

      if (checkResults.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      // Delete the user
      await connection.query("DELETE FROM users WHERE id = ?", [userId]);

      res.json({ success: true, message: "User deleted successfully" });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /users/:userId endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.post("/logout", (req, res) => {
  if (req.session) {
    // Hapus data pengguna dari sesi
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res
          .status(500)
          .json({ success: false, message: "Logout failed" });
      }

      // Hapus cookie sesi dari klien
      res.clearCookie("connect.sid", { path: "/" }); // Sesuaikan dengan nama cookie sesi yang digunakan

      return res.json({ success: true, message: "Logout successful" });
    });
  } else {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }
});

// Endpoint untuk mereset password
app.put("/users/reset-password/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const connection = await pool.getConnection();
    try {
      // Reset password to "password"
      await connection.query(
        "UPDATE users SET password = 'password' WHERE id = ?",
        [userId]
      );

      res.json({ success: true, message: "Password reset successfully" });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(
      "Error in /users/reset-password/:userId endpoint:",
      error.message
    );
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.put("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const { username, role } = req.body;

  try {
    if (!username || !role) {
      return res
        .status(400)
        .json({ success: false, error: "Username and role are required" });
    }

    const updateQuery = "UPDATE users SET username = ?, role = ? WHERE id = ?";
    const values = [username, role, userId];

    const connection = await pool.getConnection();
    try {
      await connection.query(updateQuery, values);
      res.json({ success: true, message: "User updated successfully" });
    } catch (queryError) {
      console.error("Error executing update query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.get("/obat", async (req, res) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [results] = await connection.query("SELECT * FROM obat");
      res.json({ success: true, obat: results });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /obat endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint untuk edit obat
app.put("/obat/:id", async (req, res) => {
  const obatId = req.params.id;
  const updatedObat = req.body;

  try {
    const connection = await pool.getConnection();

    try {
      // Update obat data in the database
      await connection.query(
        "UPDATE obat SET nama_obat=?, jumlah=?, harga=? WHERE id=?",
        [updatedObat.nama_obat, updatedObat.jumlah, updatedObat.harga, obatId]
      );

      res.json({ success: true, message: "Obat updated successfully" });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /obat/:id endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint untuk memperbarui informasi obat berdasarkan ID
app.patch("/transaksiobat/:id", async (req, res) => {
  const obatId = req.params.id;
  const { nama_obat, jumlah, harga } = req.body;

  try {
    const connection = await createConnection();

    // Perbarui informasi obat di tabel obat
    await connection.execute(
      "UPDATE obat SET nama_obat = ?, jumlah = ?, harga = ? WHERE id = ?",
      [nama_obat, jumlah, harga, obatId]
    );

    connection.end();

    res.status(200).json({ success: true, message: "Update obat successful" });
  } catch (error) {
    console.error("Error updating obat:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Update your backend endpoint for deleting a specific obat by ID
app.delete("/obat/:id", async (req, res) => {
  const obatId = req.params.id;

  try {
    const connection = await pool.getConnection();

    try {
      // Perform the deletion
      await connection.query("DELETE FROM obat WHERE id = ?", [obatId]);
      res.json({ success: true, message: "Obat deleted successfully" });
    } catch (queryError) {
      console.error("Error executing delete query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /obat/:id DELETE endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint untuk menambah obat baru
app.post("/tambahobat", async (req, res) => {
  const { nama_obat, jumlah, harga } = req.body;

  // Explicitly cast jumlah and harga to integers
  const numericJumlah = parseInt(jumlah, 10);
  const numericHarga = parseInt(harga, 10);

  try {
    const connection = await pool.getConnection();

    try {
      const result = await connection.query(
        "INSERT INTO obat (nama_obat, jumlah, harga) VALUES (?, ?, ?)",
        [nama_obat, numericJumlah, numericHarga]
      );

      console.log("MySQL Result:", result);

      res.json({ success: true, obatId: result[0].insertId });
    } catch (queryError) {
      console.error("Error executing insert query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /tambahobat endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Endpoint untuk mendapatkan data transaksi
app.get("/datatransaksi", async (req, res) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [results] = await connection.query("SELECT * FROM transaksi");

      // Manipulasi format tanggal sebelum mengirimkannya ke frontend
      const transaksiFormatted = results.map((transaksi) => ({
        ...transaksi,
        tanggal: formatDate(transaksi.tanggal),
      }));

      res.json({ success: true, transaksi: transaksiFormatted });
    } catch (queryError) {
      console.error("Error executing query:", queryError.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error in /transaksi endpoint:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Fungsi untuk memformat tanggal ke dalam format yang diinginkan
function formatDate(rawDate) {
  const date = new Date(rawDate);
  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("id-ID", options);
}

// Endpoint untuk membuat transaksi baru
app.post("/transaksi", async (req, res) => {
  try {
    const { nama_pembeli, total_harga } = req.body;

    // Validasi data yang diterima
    if (!nama_pembeli || !total_harga) {
      return res.status(400).json({ error: "Invalid data received." });
    }

    const connection = await createConnection();

    // Mendapatkan tanggal saat ini dalam format MySQL
    const currentDateTime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ")
      .replace(" ", " ");

    // Masukkan data transaksi ke dalam tabel transaksi
    const [result] = await connection.execute(
      "INSERT INTO transaksi (tanggal, nama_pembeli, total_harga) VALUES (?, ?, ?)",
      [currentDateTime, nama_pembeli, total_harga]
    );

    // Ambil ID transaksi yang baru dibuat
    const transaksiId = result.insertId;

    connection.end();

    res
      .status(201)
      .json({ id: transaksiId, message: "Transaksi berhasil dibuat." });
  } catch (error) {
    console.error("Error creating transaction:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint untuk membuat detail transaksi
app.post("/detail_transaksi", async (req, res) => {
  try {
    const { transaksi_id, obat_id, quantity, harga } = req.body;

    // Validasi data yang diterima
    if (!transaksi_id || !obat_id || !quantity || !harga) {
      return res.status(400).json({ error: "Invalid data received." });
    }

    const connection = await createConnection();

    // Masukkan data detail transaksi ke dalam tabel detail_transaksi
    await connection.execute(
      "INSERT INTO detail_transaksi (transaksi_id, obat_id, quantity, harga) VALUES (?, ?, ?, ?)",
      [transaksi_id, obat_id, quantity, harga]
    );

    // Update jumlah obat di tabel obat
    await connection.execute(
      "UPDATE obat SET jumlah = jumlah - ? WHERE id = ?",
      [quantity, obat_id]
    );

    connection.end();

    res.status(201).json({ message: "Detail transaksi berhasil dibuat." });
  } catch (error) {
    console.error("Error creating transaction detail:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log("Server is running on port ");
});
