from flask import Flask, render_template, request, jsonify
import sqlite3
import os

app = Flask(__name__)

DATABASE = os.path.join(app.root_path, "devpath.db")


# ---------------- DATABASE ----------------

def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    connection = get_db()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            course TEXT NOT NULL,
            interests TEXT NOT NULL
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            html INTEGER NOT NULL,
            css INTEGER NOT NULL,
            javascript INTEGER NOT NULL,
            python INTEGER NOT NULL,
            java INTEGER NOT NULL,
            FOREIGN KEY(profile_id) REFERENCES profiles(id)
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY(profile_id) REFERENCES profiles(id)
        )
    """)

    connection.commit()
    connection.close()


# ---------------- CAREER ENGINE ----------------

CAREERS = {
    "Web Developer": {
        "skills": ["html", "css", "javascript"],
        "roadmap": [
            "Learn HTML fundamentals",
            "Practice CSS and responsive design",
            "Learn JavaScript fundamentals",
            "Build interactive websites",
            "Learn Git and GitHub",
            "Deploy a portfolio project"
        ]
    },

    "Python Developer": {
        "skills": ["python", "javascript"],
        "roadmap": [
            "Learn Python fundamentals",
            "Practice functions and data structures",
            "Learn object-oriented programming",
            "Build applications using Flask",
            "Learn SQL and database operations",
            "Create and deploy a Python project"
        ]
    },

    "Java Developer": {
        "skills": ["java"],
        "roadmap": [
            "Learn Java syntax and fundamentals",
            "Practice arrays and strings",
            "Understand object-oriented programming",
            "Practice collections and exceptions",
            "Learn database connectivity",
            "Build a Java application"
        ]
    },

    "Frontend Developer": {
        "skills": ["html", "css", "javascript"],
        "roadmap": [
            "Master semantic HTML",
            "Practice CSS Flexbox and Grid",
            "Learn JavaScript DOM manipulation",
            "Build responsive interfaces",
            "Understand accessibility",
            "Publish projects on GitHub"
        ]
    }
}


def calculate_careers(skills):
    results = []

    for career_name, details in CAREERS.items():
        relevant_skills = details["skills"]

        score = sum(
            skills.get(skill, 0)
            for skill in relevant_skills
        ) / len(relevant_skills)

        results.append({
            "name": career_name,
            "score": round(score),
            "roadmap": details["roadmap"]
        })

    results.sort(key=lambda item: item["score"], reverse=True)

    return results


# ---------------- HOME PAGE ----------------

@app.route("/")
def home():
    return render_template("index.html")


# ---------------- CREATE PROFILE ----------------

@app.route("/api/profile", methods=["POST"])
def create_profile():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    course = str(data.get("course", "")).strip()
    interests = str(data.get("interests", "")).strip()

    if not name or not course or not interests:
        return jsonify({
            "error": "Please fill in all profile fields."
        }), 400

    if len(name) > 80 or len(course) > 100 or len(interests) > 250:
        return jsonify({
            "error": "One or more fields are too long."
        }), 400

    connection = get_db()

    cursor = connection.execute("""
        INSERT INTO profiles (name, course, interests)
        VALUES (?, ?, ?)
    """, (name, course, interests))

    connection.commit()
    profile_id = cursor.lastrowid
    connection.close()

    return jsonify({
        "message": "Profile created successfully.",
        "profile_id": profile_id,
        "name": name,
        "course": course,
        "interests": interests
    }), 201


# ---------------- SAVE SKILL ASSESSMENT ----------------

@app.route("/api/assessment", methods=["POST"])
def save_assessment():
    data = request.get_json(silent=True) or {}

    try:
        profile_id = int(data.get("profile_id", 0))

        skill_names = [
            "html",
            "css",
            "javascript",
            "python",
            "java"
        ]

        skills = {}

        for skill in skill_names:
            value = data.get(skill)

            if isinstance(value, bool):
                raise ValueError

            value = int(value)

            if not 0 <= value <= 100:
                raise ValueError

            skills[skill] = value

    except (TypeError, ValueError):
        return jsonify({
            "error": "Invalid profile ID or skill scores."
        }), 400

    connection = get_db()

    profile = connection.execute(
        "SELECT id FROM profiles WHERE id = ?",
        (profile_id,)
    ).fetchone()

    if profile is None:
        connection.close()

        return jsonify({
            "error": "Create a profile first."
        }), 404

    connection.execute("""
        INSERT INTO assessments
        (profile_id, html, css, javascript, python, java)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        profile_id,
        skills["html"],
        skills["css"],
        skills["javascript"],
        skills["python"],
        skills["java"]
    ))

    connection.commit()
    connection.close()

    careers = calculate_careers(skills)

    return jsonify({
        "message": "Assessment saved successfully.",
        "skills": skills,
        "average": round(sum(skills.values()) / len(skills)),
        "careers": careers
    })


# ---------------- DASHBOARD ----------------

@app.route("/api/dashboard/<int:profile_id>")
def dashboard(profile_id):
    connection = get_db()

    profile = connection.execute(
        "SELECT id, name, course, interests FROM profiles WHERE id = ?",
        (profile_id,)
    ).fetchone()

    if profile is None:
        connection.close()

        return jsonify({
            "error": "Profile not found."
        }), 404

    assessment = connection.execute("""
        SELECT html, css, javascript, python, java
        FROM assessments
        WHERE profile_id = ?
        ORDER BY id DESC
        LIMIT 1
    """, (profile_id,)).fetchone()

    goals = connection.execute("""
        SELECT id, title, completed
        FROM goals
        WHERE profile_id = ?
        ORDER BY id DESC
    """, (profile_id,)).fetchall()

    connection.close()

    skills = dict(assessment) if assessment else {}

    return jsonify({
        "profile": dict(profile),
        "skills": skills,
        "average": (
            round(sum(skills.values()) / len(skills))
            if skills else 0
        ),
        "goals": [dict(goal) for goal in goals]
    })


# ---------------- ADD GOAL ----------------

@app.route("/api/goals", methods=["POST"])
def add_goal():
    data = request.get_json(silent=True) or {}

    try:
        profile_id = int(data.get("profile_id", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid profile ID."}), 400

    title = str(data.get("title", "")).strip()

    if not title or len(title) > 150:
        return jsonify({
            "error": "Enter a goal of 1–150 characters."
        }), 400

    connection = get_db()

    profile = connection.execute(
        "SELECT id FROM profiles WHERE id = ?",
        (profile_id,)
    ).fetchone()

    if profile is None:
        connection.close()

        return jsonify({
            "error": "Profile not found."
        }), 404

    cursor = connection.execute("""
        INSERT INTO goals (profile_id, title)
        VALUES (?, ?)
    """, (profile_id, title))

    connection.commit()
    goal_id = cursor.lastrowid
    connection.close()

    return jsonify({
        "message": "Goal added successfully.",
        "goal": {
            "id": goal_id,
            "title": title,
            "completed": 0
        }
    }), 201


# ---------------- UPDATE GOAL ----------------

@app.route("/api/goals/<int:goal_id>", methods=["PATCH"])
def update_goal(goal_id):
    data = request.get_json(silent=True) or {}
    completed = data.get("completed")

    if completed not in [True, False, 0, 1]:
        return jsonify({
            "error": "Invalid completion status."
        }), 400

    connection = get_db()

    cursor = connection.execute("""
        UPDATE goals
        SET completed = ?
        WHERE id = ?
    """, (int(completed), goal_id))

    connection.commit()
    updated = cursor.rowcount
    connection.close()

    if not updated:
        return jsonify({"error": "Goal not found."}), 404

    return jsonify({
        "message": "Goal updated successfully."
    })


# ---------------- LEARNING ROADMAP ----------------

@app.route("/api/roadmap/<career_name>")
def roadmap(career_name):
    career = CAREERS.get(career_name)

    if career is None:
        return jsonify({
            "error": "Career not found."
        }), 404

    return jsonify({
        "career": career_name,
        "steps": career["roadmap"]
    })


# ---------------- START APPLICATION ----------------

init_db()

if __name__ == "__main__":
    app.run(debug=True)
