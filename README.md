# CivicResolve AI — Hackathon MVP

A full-stack prototype for the "AI Civic Complaint-to-Resolution Intelligence Platform" problem statement.

## What this MVP demonstrates

Citizen:
1. Register.
2. Login.
3. Enter problem, description and address.
4. Capture GPS coordinates.
5. Upload photo proof.
6. Submit complaint.
7. AI/rule-based triage classifies the complaint.
8. Complaint is assigned to a department.
9. Priority/urgency is calculated.
10. Duplicate complaints are detected.
11. Citizen tracks status.

Admin:
1. Login with the seeded admin account.
2. See complaint queue.
3. See category, department and priority.
4. Update status: Submitted → Assigned → In Progress → Resolved/Rejected.
5. See basic analytics.

## Tech stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: SQLite
- Authentication: JWT + bcrypt
- Uploads: Multer
- AI: Gemini API (optional)
- Fallback: local keyword classifier so the demo still works without an API key

Google's current Gemini API documentation shows `models.generateContent` and the `@google/genai` JavaScript SDK; this project uses the REST endpoint so the AI layer stays easy to understand and replace.

## Run backend

```bash
cd backend
npm install
copy .env.example .env
npm start
```

On Linux/macOS:
```bash
cp .env.example .env
npm install
npm start
```

The API starts at:
http://localhost:5000

## Configure AI

Open `backend/.env` and set:

GEMINI_API_KEY=your_key_here

The default model is:
GEMINI_MODEL=gemini-3.7-flash

If you do not provide a key, the application automatically uses a local fallback classifier.

## Run frontend

The simplest option is VS Code Live Server on the `frontend` folder.

Or:
```bash
cd frontend
python -m http.server 5500
```

Open:
http://localhost:5500

## Demo admin

Email:
admin@civic.local

Password:
Admin@12345

Change these values in `.env` before any real deployment.

## Important hackathon note

This is a prototype, not a production municipal system. For production, add:
- HTTPS
- rate limiting
- stronger validation
- secure cookie-based sessions or a hardened token strategy
- virus/file scanning
- audit logs
- department-level permissions
- notifications/SMS/email
- real municipal GIS/maps
- real government authentication and integrations
