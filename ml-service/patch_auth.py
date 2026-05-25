import os
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
if 'from werkzeug.security import' not in content:
    content = content.replace(
        'from flask import render_template, Flask, request, jsonify, render_template_string, send_from_directory',
        'from flask import render_template, Flask, request, jsonify, render_template_string, send_from_directory, session, redirect, url_for\nfrom werkzeug.security import generate_password_hash, check_password_hash'
    )

# 2. Add secret key right after app = Flask(__name__)
if 'app.secret_key' not in content:
    content = content.replace(
        'app = Flask(__name__)',
        "app = Flask(__name__)\napp.secret_key = 'super_secret_neurotunes_key'"
    )

# 3. Update DB Init
db_init_code = """
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS listening_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            song_name TEXT NOT NULL,
            source TEXT DEFAULT 'local',
            played_at TEXT NOT NULL
        )
    ''')
    try:
        conn.execute("ALTER TABLE listening_history ADD COLUMN user_id INTEGER")
    except sqlite3.OperationalError:
        pass # Column already exists
    conn.commit()
    conn.close()
"""
content = re.sub(r'def init_db\(\):.*?conn\.close\(\)', db_init_code.strip(), content, flags=re.DOTALL)

# 4. Update History Functions
content = re.sub(
    r'def save_history\(song_name, source="local"\):.*?conn\.close\(\)',
    """def save_history(song_name, source="local"):
    user_id = session.get('user_id', 0)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO listening_history (user_id, song_name, source, played_at) VALUES (?, ?, ?, ?)",
        (user_id, song_name, source, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    )
    conn.commit()
    conn.close()""",
    content, flags=re.DOTALL
)

content = re.sub(
    r'def get_history\(limit=8\):.*?return \[.*?\n',
    """def get_history(limit=8):
    user_id = session.get('user_id', 0)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT song_name, source, played_at FROM listening_history WHERE user_id = ? ORDER BY id DESC LIMIT ?",
        (user_id, limit),
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"song": r[0], "source": r[1], "played_at": r[2]} for r in rows]\n""",
    content, flags=re.DOTALL
)


# 5. Add Auth Routes
auth_routes = """
@app.route("/login", methods=["GET"])
def login_page():
    return render_template("login.html")

@app.route("/api/signup", methods=["POST"])
def api_signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"success": False, "error": "Missing fields"}), 400
    
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, generate_password_hash(password))
        )
        conn.commit()
        
        # Auto log in
        cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        session['user_id'] = user[0]
        session['username'] = username
        conn.close()
        return jsonify({"success": True})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"success": False, "error": "Username already taken."}), 400

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password_hash(user[1], password):
        session['user_id'] = user[0]
        session['username'] = username
        return jsonify({"success": True})
    
    return jsonify({"success": False, "error": "Invalid username or password."}), 401

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('login_page'))

"""
if 'def login_page():' not in content:
    # Insert before the first route
    content = content.replace('@app.route("/")', auth_routes + '\n@app.route("/")')

# 6. Protect the Home route
home_code = """
@app.route("/")
def home():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("index.html", username=session.get('username'))
"""
content = re.sub(r'@app\.route\("/"\)\ndef home\(\):\n    return render_template\("index\.html"\)', home_code.strip(), content)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch applied successfully!")
