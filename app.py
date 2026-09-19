import json
import os
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, render_template, request

from data import CAMPUS_ACTIVITIES

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "campus.db")

app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False


def get_db_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def ensure_user(user_id: str):
    if not user_id:
        return
    connection = get_db_connection()
    connection.execute(
        "INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)",
        (user_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    connection.commit()
    connection.close()


def normalize_missing_info(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        if value.startswith("["):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except (TypeError, ValueError):
                pass
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def serialize_activity(row, user_id=None):
    data = dict(row)
    data["missing_info"] = normalize_missing_info(data.get("missing_info"))
    data["favorite"] = False
    data["signed_up"] = False

    if user_id:
        connection = get_db_connection()
        favorite = connection.execute(
            "SELECT 1 FROM user_actions WHERE user_id = ? AND activity_id = ? AND action_type = 'favorite' LIMIT 1",
            (user_id, data["id"]),
        ).fetchone()
        signed = connection.execute(
            "SELECT 1 FROM user_actions WHERE user_id = ? AND activity_id = ? AND action_type = 'signup' LIMIT 1",
            (user_id, data["id"]),
        ).fetchone()
        connection.close()
        data["favorite"] = bool(favorite)
        data["signed_up"] = bool(signed)

    return data


def seed_default_data(connection):
    count = connection.execute("SELECT COUNT(*) FROM activities").fetchone()[0]
    if count > 0:
        return

    for item in CAMPUS_ACTIVITIES:
        connection.execute(
            """
            INSERT INTO activities (
                id, title, type, source, organizer, target, start_time, deadline,
                location, fee, requirements, status, missing_info, risk_note,
                description, is_user_published, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                item.get("id"),
                item.get("title"),
                item.get("type"),
                item.get("source"),
                item.get("organizer"),
                item.get("target"),
                item.get("start_time"),
                item.get("deadline"),
                item.get("location"),
                item.get("fee"),
                item.get("requirements"),
                item.get("status"),
                json.dumps(normalize_missing_info(item.get("missing_info")), ensure_ascii=False),
                item.get("risk_note"),
                item.get("description"),
                1 if item.get("is_user_published") else 0,
            ),
        )

    connection.commit()


def init_db():
    connection = get_db_connection()
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            type TEXT,
            source TEXT,
            organizer TEXT,
            target TEXT,
            start_time TEXT,
            deadline TEXT,
            location TEXT,
            fee TEXT,
            requirements TEXT,
            status TEXT,
            missing_info TEXT DEFAULT '[]',
            risk_note TEXT,
            description TEXT,
            is_user_published INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            activity_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, activity_id, action_type)
        )
        """
    )
    connection.commit()
    seed_default_data(connection)
    connection.close()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/activities")
def get_activities():
    user_id = request.args.get("user_id", "").strip()
    activity_type = request.args.get("type", "").strip()
    source = request.args.get("source", "").strip()
    status = request.args.get("status", "").strip()
    search = request.args.get("search", "").strip().lower()
    is_user_published = request.args.get("is_user_published", "").strip().lower()

    query = "SELECT * FROM activities WHERE 1 = 1"
    params = []

    if activity_type:
        query += " AND type = ?"
        params.append(activity_type)

    if source:
        query += " AND source = ?"
        params.append(source)

    if status:
        query += " AND status LIKE ?"
        params.append(f"%{status}%")

    if is_user_published in {"1", "true", "yes"}:
        query += " AND is_user_published = 1"
    elif is_user_published in {"0", "false", "no"}:
        query += " AND is_user_published = 0"

    if search:
        query += " AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(organizer) LIKE ? OR LOWER(target) LIKE ?)"
        like_term = f"%{search}%"
        params.extend([like_term, like_term, like_term, like_term])

    query += " ORDER BY created_at DESC"

    connection = get_db_connection()
    rows = connection.execute(query, params).fetchall()
    activities = [serialize_activity(row, user_id) for row in rows]
    connection.close()

    return jsonify(activities)


@app.route("/api/publish", methods=["POST"])
def publish_activity():
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("user_id", "")).strip()
    title = str(payload.get("title", "")).strip()
    activity_type = str(payload.get("type", "")).strip()
    source = str(payload.get("source", "")).strip() or "学生个人发布"
    organizer = str(payload.get("organizer", "")).strip() or "学生发布"
    target = str(payload.get("target", "")).strip() or "在校学生"
    start_time = str(payload.get("start_time", "")).strip()
    deadline = str(payload.get("deadline", "")).strip() or "待定"
    location = str(payload.get("location", "")).strip() or "待定"
    fee = str(payload.get("fee", "")).strip() or "待定"
    requirements = str(payload.get("requirements", "")).strip()
    status = str(payload.get("status", "")).strip() or "待审核"
    description = str(payload.get("description", "")).strip()
    missing_info = normalize_missing_info(payload.get("missing_info", []))
    risk_note = str(payload.get("risk_note", "")).strip() or "信息待核实。"

    if not user_id or not title or not description:
        return jsonify({"success": False, "message": "需要提供 user_id、title 和 description"}), 400

    ensure_user(user_id)

    connection = get_db_connection()
    cursor = connection.execute(
        """
        INSERT INTO activities (
            title, type, source, organizer, target, start_time, deadline,
            location, fee, requirements, status, missing_info, risk_note,
            description, is_user_published, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        """,
        (
            title,
            activity_type or "其他",
            source,
            organizer,
            target,
            start_time or "待定",
            deadline,
            location,
            fee,
            requirements or "未说明",
            status,
            json.dumps(missing_info, ensure_ascii=False),
            risk_note,
            description,
        ),
    )
    connection.commit()
    new_row = connection.execute("SELECT * FROM activities WHERE id = ?", (cursor.lastrowid,)).fetchone()
    connection.close()

    return jsonify({"success": True, "activity": serialize_activity(new_row, user_id)})


@app.route("/api/favorite", methods=["POST"])
def favorite_activity():
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("user_id", "")).strip()
    activity_id = payload.get("activity_id")

    if not user_id or activity_id is None:
        return jsonify({"success": False, "message": "需要提供 user_id 和 activity_id"}), 400

    ensure_user(user_id)
    connection = get_db_connection()
    existing = connection.execute(
        "SELECT 1 FROM user_actions WHERE user_id = ? AND activity_id = ? AND action_type = 'favorite' LIMIT 1",
        (user_id, activity_id),
    ).fetchone()

    if existing:
        connection.execute(
            "DELETE FROM user_actions WHERE user_id = ? AND activity_id = ? AND action_type = 'favorite'",
            (user_id, activity_id),
        )
        is_favorite = False
    else:
        connection.execute(
            "INSERT OR IGNORE INTO user_actions (user_id, activity_id, action_type, created_at) VALUES (?, ?, 'favorite', datetime('now'))",
            (user_id, activity_id),
        )
        is_favorite = True

    connection.commit()
    connection.close()
    return jsonify({"success": True, "favorite": is_favorite, "activity_id": activity_id})


@app.route("/api/signup", methods=["POST"])
def signup_activity():
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("user_id", "")).strip()
    activity_id = payload.get("activity_id")

    if not user_id or activity_id is None:
        return jsonify({"success": False, "message": "需要提供 user_id 和 activity_id"}), 400

    ensure_user(user_id)
    connection = get_db_connection()
    existing = connection.execute(
        "SELECT 1 FROM user_actions WHERE user_id = ? AND activity_id = ? AND action_type = 'signup' LIMIT 1",
        (user_id, activity_id),
    ).fetchone()

    if existing:
        connection.execute(
            "DELETE FROM user_actions WHERE user_id = ? AND activity_id = ? AND action_type = 'signup'",
            (user_id, activity_id),
        )
        is_signed = False
    else:
        connection.execute(
            "INSERT OR IGNORE INTO user_actions (user_id, activity_id, action_type, created_at) VALUES (?, ?, 'signup', datetime('now'))",
            (user_id, activity_id),
        )
        is_signed = True

    connection.commit()
    connection.close()
    return jsonify({"success": True, "signed_up": is_signed, "activity_id": activity_id})


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
