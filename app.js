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
};

const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
});

const createConnection = async () => {
  return await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });
};

const sessionStore = new MySQLStore(
  {
    ...dbConfig,
    clearExpired: true,
  },
  pool
);

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

app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://klinikkartika.up.railway.app"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  res.status(200).end();
});

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

app.listen(4000, () => {
  console.log("Server is running on port 4000");
});
