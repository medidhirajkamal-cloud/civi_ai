import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

// ---------------- DATABASE ----------------

const db = new Database(path.join(__dirname, "civic.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'citizen',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    address TEXT,
    category TEXT DEFAULT 'general',
    department TEXT DEFAULT 'General',
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Submitted',
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

// ---------------- UPLOADS ----------------

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG and WEBP images are allowed"));
        }
    }
});

// ---------------- FRONTEND ----------------

app.use("/uploads", express.static(uploadDir));

const frontendDir = path.join(__dirname, "..", "frontend");

app.use(express.static(frontendDir));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
});

// ---------------- HEALTH ----------------

app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        service: "Civic Complaint AI API"
    });
});

// ---------------- REGISTER ----------------

app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        const existing = db
            .prepare("SELECT id FROM users WHERE email = ?")
            .get(email);

        if (existing) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users
            (name, email, phone, password_hash, role)
            VALUES (?, ?, ?, ?, 'citizen')
        `).run(
            name,
            email,
            phone || "",
            hashedPassword
        );

        res.json({
            success: true,
            user: {
                id: result.lastInsertRowid,
                name,
                email,
                role: "citizen"
            }
        });

    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});

// ---------------- LOGIN ----------------

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = db
            .prepare("SELECT * FROM users WHERE email = ?")
            .get(email);

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

const storedPassword = user.password_hash || user.password;

if (!storedPassword) {
    console.error("Password field missing in database:", user);
    return res.status(500).json({
        message: "User password is not stored correctly"
    });
}

const valid = await bcrypt.compare(password, storedPassword);

        if (!valid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

// ---------------- CREATE COMPLAINT ----------------

app.post(
    "/api/complaints",
    upload.single("image"),
    async (req, res) => {

        try {
            const {
                userId,
                title,
                description,
                address
            } = req.body;

            if (!title || !description) {
                return res.status(400).json({
                    message: "Title and description are required"
                });
            }

            const aiResult = await analyzeComplaint(
                title,
                description
            );

            const image = req.file
                ? `/uploads/${req.file.filename}`
                : null;

            const result = db.prepare(`
                INSERT INTO complaints
                (
                    user_id,
                    title,
                    description,
                    address,
                    category,
                    department,
                    priority,
                    status,
                    image
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?)
            `).run(
                userId || null,
                title,
                description,
                address || "",
                aiResult.category,
                aiResult.department,
                aiResult.priority,
                image
            );

            res.json({
                success: true,
                complaint: {
                    id: result.lastInsertRowid,
                    title,
                    description,
                    address,
                    category: aiResult.category,
                    department: aiResult.department,
                    priority: aiResult.priority,
                    status: "Submitted",
                    image
                }
            });

        } catch (error) {
            console.error("Complaint error:", error);

            res.status(500).json({
                message: "Could not submit complaint"
            });
        }
    }
);

// ---------------- GET COMPLAINTS ----------------

app.get("/api/complaints", (req, res) => {
    try {
        const userId = req.query.userId;

        let complaints;

        if (userId) {
            complaints = db.prepare(`
                SELECT *
                FROM complaints
                WHERE user_id = ?
                ORDER BY id DESC
            `).all(userId);
        } else {
            complaints = db.prepare(`
                SELECT *
                FROM complaints
                ORDER BY id DESC
            `).all();
        }

        res.json({
            success: true,
            complaints
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not load complaints"
        });
    }
});

// ---------------- ADMIN ALL COMPLAINTS ----------------

app.get("/api/admin/complaints", (_req, res) => {
    try {
        const complaints = db.prepare(`
            SELECT
                complaints.*,
                users.name AS citizen_name,
                users.email AS citizen_email
            FROM complaints
            LEFT JOIN users
            ON complaints.user_id = users.id
            ORDER BY complaints.id DESC
        `).all();

        res.json({
            success: true,
            complaints
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not load admin complaints"
        });
    }
});

// ---------------- UPDATE STATUS ----------------

app.patch("/api/admin/complaints/:id", (req, res) => {
    try {
        const { status } = req.body;

        db.prepare(`
            UPDATE complaints
            SET status = ?
            WHERE id = ?
        `).run(
            status,
            req.params.id
        );

        res.json({
            success: true,
            message: "Complaint updated"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not update complaint"
        });
    }
});

// ---------------- AI ANALYSIS ----------------

async function analyzeComplaint(title, description) {

    const apiKey = process.env.GEMINI_API_KEY;

    // If Gemini isn't configured, use a safe fallback.
    if (!apiKey) {
        return classifyLocally(title, description);
    }

    try {

        const prompt = `
You are an AI classifier for a civic complaint system.

Classify this complaint.

Title:
${title}

Description:
${description}

Return ONLY valid JSON in this exact format:

{
  "category": "roads|drainage|waste|water|streetlights|public_facilities|general",
  "department": "Roads|Drainage & Sanitation|Waste Management|Water Supply|Electrical|Public Facilities|General",
  "priority": "Low|Medium|High|Critical"
}
`;

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const text = await response.text();

        console.log("Gemini status:", response.status);

        if (!response.ok) {
            console.log("Gemini error:", text);
            return classifyLocally(title, description);
        }

        const data = JSON.parse(text);

        const result =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!result) {
            return classifyLocally(title, description);
        }

        const cleaned = result
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(cleaned);

    } catch (error) {

        console.error("AI classification error:", error);

        return classifyLocally(title, description);
    }
}

// ---------------- LOCAL FALLBACK ----------------

function classifyLocally(title, description) {

    const text =
        `${title} ${description}`.toLowerCase();

    if (
        text.includes("drain") ||
        text.includes("sewage") ||
        text.includes("sewer")
    ) {
        return {
            category: "drainage",
            department: "Drainage & Sanitation",
            priority: "High"
        };
    }

    if (
        text.includes("pothole") ||
        text.includes("road") ||
        text.includes("street")
    ) {
        return {
            category: "roads",
            department: "Roads",
            priority: "High"
        };
    }

    if (
        text.includes("garbage") ||
        text.includes("waste") ||
        text.includes("trash")
    ) {
        return {
            category: "waste",
            department: "Waste Management",
            priority: "Medium"
        };
    }

    if (
        text.includes("water") ||
        text.includes("pipe") ||
        text.includes("leak")
    ) {
        return {
            category: "water",
            department: "Water Supply",
            priority: "High"
        };
    }

    if (
        text.includes("light") ||
        text.includes("streetlight") ||
        text.includes("lamp")
    ) {
        return {
            category: "streetlights",
            department: "Electrical",
            priority: "Medium"
        };
    }

    return {
        category: "general",
        department: "General",
        priority: "Medium"
    };
}

// ---------------- CHATBOT ----------------

app.post("/api/chat", async (req, res) => {

    try {

        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                message: "Please enter a message."
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.json({
                reply: localChat(message)
            });
        }

        const prompt = `
You are the Citizen Complaint Assistant for a Civic Complaint Management System.

Help citizens with:
- raising complaints
- checking complaint status
- understanding categories
- understanding priorities
- explaining what happens after submitting a complaint
- login/account guidance
- general civic complaint information

Be concise, friendly and helpful.

Citizen message:
${message}
`;

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const text = await response.text();

        console.log("Gemini status:", response.status);

        if (!response.ok) {
            console.log("Gemini response:", text);

            return res.json({
                reply: localChat(message)
            });
        }

        const data = JSON.parse(text);

        const reply =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        res.json({
            reply:
                reply ||
                localChat(message)
        });

    } catch (error) {

        console.error("Chat error:", error);

        res.json({
            reply: localChat(req.body?.message || "")
        });
    }
});

// ---------------- LOCAL CHAT FALLBACK ----------------

function localChat(message) {

    const text = message.toLowerCase();

    if (
        text.includes("raise") ||
        text.includes("submit") ||
        text.includes("complaint")
    ) {
        return "To raise a complaint, enter a problem title, describe the issue, provide the address and submit the complaint. The system will classify and route it to the appropriate department.";
    }

    if (text.includes("status")) {
        return "You can check your complaint status in the My Complaints section after logging in.";
    }

    if (text.includes("login")) {
        return "Use your registered email and password to log in. If you don't have an account, create one using Register.";
    }

    return "I can help you raise a civic complaint, understand complaint categories, check status, and explain the complaint process.";
}

// ---------------- ANALYTICS ----------------

app.get("/api/admin/analytics", (_req, res) => {

    try {

        const byCategory = db.prepare(`
            SELECT category, COUNT(*) AS count
            FROM complaints
            GROUP BY category
            ORDER BY count DESC
        `).all();

        const byStatus = db.prepare(`
            SELECT status, COUNT(*) AS count
            FROM complaints
            GROUP BY status
            ORDER BY count DESC
        `).all();

        const byDepartment = db.prepare(`
            SELECT department, COUNT(*) AS count
            FROM complaints
            GROUP BY department
            ORDER BY count DESC
        `).all();

        res.json({
            byCategory,
            byStatus,
            byDepartment
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Analytics unavailable"
        });
    }
});

// ---------------- ERROR HANDLER ----------------

app.use((error, _req, res, _next) => {

    console.error("Server error:", error);

    res.status(500).json({
        message: error.message || "Server error"
    });
});

// ---------------- START ----------------

app.listen(PORT, () => {

    console.log(
        `Civic AI API running at http://localhost:${PORT}`
    );

});