#!/usr/bin/env python3
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import datetime
from pathlib import Path
import json
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__, static_folder='web/static', template_folder='web/templates')
CORS(app)

USERS_DIR = Path("users")
DEFAULT_USER = "tarun"

def get_user_dirs(user: str):
    """Get directory paths for a user"""
    user_dir = USERS_DIR / user
    return {
        "feeds": user_dir / "feeds",
        "memory": user_dir / "memory",
        "daily": user_dir / "memory" / "daily"
    }

@app.route('/')
def index():
    return send_from_directory('web/templates', 'index.html')

@app.route('/api/users')
def get_users():
    """Get list of available users"""
    users = []
    if USERS_DIR.exists():
        for user_dir in USERS_DIR.iterdir():
            if user_dir.is_dir():
                profile_file = user_dir / "memory" / "user_profile.json"
                if profile_file.exists():
                    with open(profile_file, 'r') as f:
                        profile = json.load(f)
                    users.append({
                        "id": user_dir.name,
                        "name": profile.get("name", user_dir.name),
                        "role": profile.get("role", "")
                    })
    return jsonify({"users": users})

@app.route('/api/feed')
def get_feed():
    """Get feed for a specific user and date"""
    user = request.args.get('user', DEFAULT_USER)
    date = request.args.get('date', datetime.now().strftime("%Y-%m-%d"))
    
    dirs = get_user_dirs(user)
    feed_file = dirs["feeds"] / f"{date}_feed.json"
    
    if not feed_file.exists():
        return jsonify({"items": [], "message": "No feed for this date"})
    
    with open(feed_file, 'r') as f:
        items = json.load(f)
    
    return jsonify({"items": items, "date": date, "user": user})

@app.route('/api/dates')
def get_available_dates():
    """Get list of available feed dates for a user"""
    user = request.args.get('user', DEFAULT_USER)
    dirs = get_user_dirs(user)
    
    dates = []
    if dirs["feeds"].exists():
        for feed_file in dirs["feeds"].glob("*_feed.json"):
            date_str = feed_file.stem.replace("_feed", "")
            dates.append(date_str)
    dates.sort(reverse=True)
    return jsonify({"dates": dates, "user": user})

@app.route('/api/interact', methods=['POST'])
def record_interaction():
    """Record upvote/downvote or remove vote"""
    data = request.json
    user = data.get('user', DEFAULT_USER)
    item_id = data.get('item_id')
    action = data.get('action')  # "upvote", "downvote", or "remove"
    item_metadata = data.get('item_metadata', {})
    feed_date = data.get('feed_date', datetime.now().strftime("%Y-%m-%d"))
    note = data.get('note')  # Optional note for downvotes
    
    if not item_id or action not in ['upvote', 'downvote', 'remove']:
        return jsonify({"error": "Invalid request"}), 400
    
    dirs = get_user_dirs(user)
    interactions_file = dirs["daily"] / f"{feed_date}_interactions.json"
    
    # Load existing interactions
    dirs["daily"].mkdir(parents=True, exist_ok=True)
    interactions = []
    if interactions_file.exists():
        with open(interactions_file, 'r') as f:
            interactions = json.load(f)
    
    # Remove any existing vote for this item
    interactions = [i for i in interactions if i.get('item_id') != item_id]
    
    # If not removing, add new interaction
    if action != 'remove':
        interaction = {
            "item_id": item_id,
            "action": action,
            "timestamp": datetime.now().isoformat(),
            "item_metadata": item_metadata
        }
        
        # Add note if provided (for downvotes)
        if note:
            interaction["note"] = note
        
        interactions.append(interaction)
    
    # Save
    with open(interactions_file, 'w') as f:
        json.dump(interactions, f, indent=2)
    
    msg = "vote removed" if action == 'remove' else f"{action} recorded"
    return jsonify({"success": True, "message": msg})

@app.route('/api/interactions')
def get_interactions():
    """Get interactions for a specific user and date"""
    user = request.args.get('user', DEFAULT_USER)
    date = request.args.get('date', datetime.now().strftime("%Y-%m-%d"))
    
    dirs = get_user_dirs(user)
    interactions_file = dirs["daily"] / f"{date}_interactions.json"
    
    if not interactions_file.exists():
        return jsonify({"interactions": {}, "notes": {}})
    
    with open(interactions_file, 'r') as f:
        interactions = json.load(f)
    
    # Convert to dicts keyed by item_id for easy lookup
    votes = {}
    notes = {}
    for interaction in interactions:
        item_id = interaction.get('item_id')
        if item_id:
            votes[item_id] = interaction.get('action')
            if interaction.get('note'):
                notes[item_id] = interaction.get('note')
    
    return jsonify({"interactions": votes, "notes": notes})

@app.route('/api/star', methods=['POST'])
def toggle_star():
    """Star or unstar an item"""
    data = request.json
    user = data.get('user', DEFAULT_USER)
    item = data.get('item')  # Full item object
    action = data.get('action')  # "star" or "unstar"
    
    if not item or not item.get('id') or action not in ['star', 'unstar']:
        return jsonify({"error": "Invalid request"}), 400
    
    dirs = get_user_dirs(user)
    starred_file = dirs["memory"] / "starred.json"
    
    # Load existing starred items
    starred = []
    if starred_file.exists():
        with open(starred_file, 'r') as f:
            starred = json.load(f)
    
    item_id = item.get('id')
    
    if action == 'star':
        # Add if not already starred
        if not any(s.get('id') == item_id for s in starred):
            item['starred_at'] = datetime.now().isoformat()
            starred.insert(0, item)  # Add to beginning
    else:
        # Remove from starred
        starred = [s for s in starred if s.get('id') != item_id]
    
    # Save
    with open(starred_file, 'w') as f:
        json.dump(starred, f, indent=2)
    
    return jsonify({"success": True, "starred_count": len(starred)})

@app.route('/api/starred')
def get_starred():
    """Get all starred items for a user"""
    user = request.args.get('user', DEFAULT_USER)
    
    dirs = get_user_dirs(user)
    starred_file = dirs["memory"] / "starred.json"
    
    if not starred_file.exists():
        return jsonify({"items": []})
    
    with open(starred_file, 'r') as f:
        starred = json.load(f)
    
    return jsonify({"items": starred})

@app.route('/api/activity', methods=['POST'])
def log_activity():
    """Log user activity (GitHub, YouTube, etc.)"""
    data = request.json
    user = data.get('user', DEFAULT_USER)
    activity_type = data.get('type')
    activity_data = data.get('data', {})
    
    if not activity_type:
        return jsonify({"error": "Invalid request"}), 400
    
    dirs = get_user_dirs(user)
    date = datetime.now().strftime("%Y-%m-%d")
    activity_file = dirs["daily"] / f"{date}_activity.json"
    
    # Load existing activities
    dirs["daily"].mkdir(parents=True, exist_ok=True)
    activities = []
    if activity_file.exists():
        with open(activity_file, 'r') as f:
            activities = json.load(f)
    
    # Add new activity
    activities.append({
        "type": activity_type,
        "data": activity_data,
        "timestamp": datetime.now().isoformat()
    })
    
    # Save
    with open(activity_file, 'w') as f:
        json.dump(activities, f, indent=2)
    
    return jsonify({"success": True, "message": "Activity logged"})

@app.route('/api/reflect', methods=['POST'])
def trigger_reflection():
    """Manually trigger reflection for a user"""
    import asyncio
    from agent import reflect_on_day
    
    data = request.json or {}
    user = data.get('user', DEFAULT_USER)
    user_folder = f"users/{user}"
    github_username = data.get('github_username')
    
    try:
        result = asyncio.run(reflect_on_day(user_folder, github_username))
        return jsonify({
            "success": True,
            "output": str(result.final_output)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/generate', methods=['POST'])
def trigger_generate():
    """Manually trigger feed generation for a user"""
    import asyncio
    from agent import generate_feed
    
    data = request.json or {}
    user = data.get('user', DEFAULT_USER)
    user_folder = f"users/{user}"
    github_username = data.get('github_username')
    
    try:
        result = asyncio.run(generate_feed(user_folder, github_username))
        return jsonify({
            "success": True,
            "output": str(result.final_output)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
