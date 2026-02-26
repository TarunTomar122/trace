#!/usr/bin/env python3
"""
WhatsApp Bot for Trace - Interactive news and research
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from flask import Flask, request
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Load root .env
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# Import our existing modules
sys.path.insert(0, str(Path(__file__).parent))
from research_agent import search_with_exa, generate_deep_dive

app = Flask(__name__)

# Twilio credentials
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")  # Sandbox default

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Firebase
db = None

# User session storage (in-memory for now, should be in DB for production)
user_sessions: Dict[str, Dict[str, Any]] = {}


def init_firebase():
    """Initialize Firebase."""
    global db
    if db:
        return db

    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if cred_path and cred_path.startswith("./"):
        cred_path = str(ROOT_DIR / cred_path[2:])

    if not cred_path:
        cred_path = str(ROOT_DIR / "anybrew-7c6c1-firebase-adminsdk-fbsvc-fe164fd73a.json")

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    return db


def get_user_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    """Get user by phone number and full profile."""
    # For now, hardcode test user
    # In production, query user_profiles by phone field
    uid = "TTK4PNFSO2PxTBrSCvvXBmHsCIE2"

    try:
        doc = db.collection("user_profiles").document(uid).get()
        if doc.exists:
            profile = doc.to_dict()
            profile["uid"] = uid
            return profile
    except Exception as e:
        print(f"[WhatsApp] Error fetching profile: {e}")

    return {
        "uid": uid,
        "name": "Tarun",
        "phone": phone
    }


def get_trending_feed(uid: str) -> List[Dict[str, Any]]:
    """Get user's trending feed."""
    feed_ref = db.collection("v3_user_feeds").document(uid).collection("daily")
    docs = list(feed_ref.stream())

    if not docs:
        return []

    docs.sort(key=lambda d: d.id, reverse=True)
    latest = docs[0].to_dict()

    return latest.get("trending", [])


def format_headlines(articles: List[Dict[str, Any]]) -> str:
    """Format trending headlines for WhatsApp with easy tap numbers."""
    if not articles:
        return "No trending articles found."

    # WhatsApp shows quick taps for numbers when formatted like this
    message = "📰 *Your Trending Headlines*\n\n"

    number_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"]

    for i, article in enumerate(articles[:8]):
        title = article.get("title", "Untitled")
        emoji = number_emojis[i] if i < len(number_emojis) else f"{i+1}."
        message += f"{emoji} {title}\n\n"

    message += "_Tap any number above to explore that story_"

    return message


USE_INTERACTIVE_MESSAGES = os.getenv("WHATSAPP_USE_INTERACTIVE", "false").lower() == "true"


def send_headlines_with_list(to_number: str, articles: List[Dict[str, Any]]) -> Optional[str]:
    """Send headlines as interactive list message (requires approved WhatsApp Business API)."""
    if not articles:
        return None

    if not USE_INTERACTIVE_MESSAGES:
        print("[WhatsApp] Interactive messages disabled (sandbox mode)")
        return None

    try:
        import json

        # WhatsApp lists support up to 10 rows per section
        rows = []
        for i, article in enumerate(articles[:10], 1):
            title = article.get("title", "Untitled")[:72]  # Max 72 chars
            rows.append({
                "id": str(i),
                "title": f"{i}. {title[:60]}",
                "description": "Tap to explore"[:72]
            })

        # Build interactive list message
        list_message = {
            "type": "list",
            "body": {
                "text": "📰 Your Trending Headlines"
            },
            "action": {
                "button": "View Stories",
                "sections": [
                    {
                        "title": "Today's Top Stories",
                        "rows": rows
                    }
                ]
            }
        }

        # Send via Twilio's content API
        message = twilio_client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            to=to_number,
            content_sid=None,  # Custom content
            content_variables=json.dumps(list_message)
        )

        return message.sid

    except Exception as e:
        print(f"[WhatsApp] Error sending list: {e}")
        return None


def send_reply_buttons(to_number: str, message_text: str, buttons: List[Dict[str, str]]) -> Optional[str]:
    """Send message with reply buttons (requires approved WhatsApp Business API)."""
    if not USE_INTERACTIVE_MESSAGES:
        print("[WhatsApp] Interactive messages disabled (sandbox mode)")
        return None

    try:
        import json

        # WhatsApp supports max 3 reply buttons
        button_list = []
        for i, btn in enumerate(buttons[:3]):
            button_list.append({
                "type": "reply",
                "reply": {
                    "id": btn.get("id", str(i)),
                    "title": btn.get("title", "")[:20]  # Max 20 chars
                }
            })

        # Build interactive button message
        button_message = {
            "type": "button",
            "body": {
                "text": message_text
            },
            "action": {
                "buttons": button_list
            }
        }

        message = twilio_client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            to=to_number,
            content_sid=None,
            content_variables=json.dumps(button_message)
        )

        return message.sid

    except Exception as e:
        print(f"[WhatsApp] Error sending buttons: {e}")
        return None


def handle_headline_selection(user_phone: str, selection: int, articles: List[Dict[str, Any]]) -> str:
    """Handle when user selects a headline."""
    if selection < 1 or selection > len(articles):
        return "Invalid selection. Please choose a number from the list."

    selected = articles[selection - 1]
    title = selected.get("title", "Untitled")[:100]

    # Store selection in session
    if user_phone not in user_sessions:
        user_sessions[user_phone] = {}

    user_sessions[user_phone]["selected_article"] = selected
    user_sessions[user_phone]["state"] = "awaiting_context"

    # Try to send interactive buttons (only works with approved accounts)
    if USE_INTERACTIVE_MESSAGES:
        message_text = f"📖 Selected:\n{title}\n\nWhat do you want to know?"
        buttons = [
            {"id": "1", "title": "Technical details"},
            {"id": "2", "title": "What to build?"},
            {"id": "3", "title": "Relevance to me?"},
        ]
        send_reply_buttons(user_phone, message_text, buttons)
        return None  # Buttons sent via API

    # Fallback to text format
    return f"""📖 *Selected:*
{title}

*What do you want to know?*

1️⃣ Technical details & implementation
2️⃣ What can I build with this?
3️⃣ How is this relevant to my work?
4️⃣ Custom question (type your own)

_Tap a number or type your question_"""


def split_message(text: str, max_length: int = 1500) -> List[str]:
    """Split long message into chunks at section boundaries."""
    if len(text) <= max_length:
        return [text]

    chunks = []

    # Split by ## headers to keep sections together
    sections = text.split("\n##")

    current = ""
    for i, section in enumerate(sections):
        # Re-add ## for non-first sections
        section_text = ("##" + section) if i > 0 else section

        if len(current) + len(section_text) <= max_length:
            current += section_text
        else:
            if current:
                chunks.append(current.strip())
            current = section_text

    if current:
        chunks.append(current.strip())

    return chunks


def build_user_context(profile: Dict[str, Any], user_input: str) -> str:
    """Build context from user profile and their input."""
    role = profile.get("role", "professional")
    interests = profile.get("interests", [])
    goals = profile.get("careerGoals", [])

    # Build auto context
    auto_context = f"I'm a {role}"

    if interests:
        auto_context += f" interested in {', '.join(interests[:3])}"

    if goals:
        goal_text = goals[0] if goals else ""
        if goal_text == "get-promoted":
            auto_context += " and want to level up in my career"
        elif goal_text == "build-something":
            auto_context += " and want to build products"

    # Map quick options
    context_map = {
        "1": "Give me technical details",
        "2": "What can I build with this?",
        "3": "How is this relevant to my work?",
    }

    if user_input in context_map:
        return f"{auto_context}. {context_map[user_input]}"

    return f"{auto_context}. {user_input}"


def handle_deep_dive(user_phone: str, user_input: str, user_profile: Dict[str, Any]) -> List[str]:
    """Generate deep dive based on user context."""
    session = user_sessions.get(user_phone, {})
    article = session.get("selected_article")

    if not article:
        return ["Please select an article first. Send 'news' to see headlines."]

    # Build context from profile
    user_context = build_user_context(user_profile, user_input)

    # Do research
    title = article.get("title", "Untitled")
    print(f"[WhatsApp] Generating deep dive for: {title}")
    print(f"[WhatsApp] User context: {user_context}")

    # If user is asking a comparison or specific question, search for that too
    search_query = f"{title} {user_input}"
    research_results = search_with_exa(search_query, num_results=5)

    # Generate deep dive (using our research_agent function)
    deep_dive = generate_deep_dive(article, user_context, research_results)

    # Clear session
    user_sessions[user_phone]["state"] = "idle"

    # Format for WhatsApp - just send the answer
    response = f"{deep_dive}\n\n_Send 'news' for more_"

    # Only split if really necessary (over 1600 chars, WhatsApp limit)
    if len(response) > 1600:
        return split_message(response, max_length=1500)

    return [response]


def process_message(user_phone: str, message: str) -> str:
    """Process incoming WhatsApp message."""
    message = message.strip().lower()

    # Get user
    user = get_user_by_phone(user_phone)
    if not user:
        return "Sorry, I couldn't find your account. Please sign up at trace.app first."

    uid = user["uid"]
    name = user.get("name", "there")

    # Initialize session
    if user_phone not in user_sessions:
        user_sessions[user_phone] = {"state": "idle", "articles": []}

    session = user_sessions[user_phone]
    state = session.get("state", "idle")

    # Handle different states
    if message == "news" or message == "start" or message == "hi" or message == "hello":
        # Fetch and show trending headlines
        articles = get_trending_feed(uid)

        if not articles:
            return "No trending articles found for you today. Check back later!"

        # Store articles in session
        user_sessions[user_phone]["articles"] = articles
        user_sessions[user_phone]["state"] = "viewing_headlines"

        # Try to send interactive list (only works with approved accounts)
        if USE_INTERACTIVE_MESSAGES:
            send_headlines_with_list(user_phone, articles)
            return None  # List was sent via API

        # Fallback to text format
        return f"Hey {name}! 👋\n\n" + format_headlines(articles)

    elif state == "viewing_headlines":
        # User is selecting a headline number
        try:
            selection = int(message)
            articles = session.get("articles", [])
            return handle_headline_selection(user_phone, selection, articles)
        except ValueError:
            return "Please reply with a number (1-8) to select an article, or send 'news' for headlines."

    elif state == "awaiting_context":
        # Send "working" message immediately
        send_whatsapp_message(user_phone, "🔍 Researching...")

        # User is providing their context for deep dive
        messages = handle_deep_dive(user_phone, message, user)

        # Send all messages
        for msg in messages:
            send_whatsapp_message(user_phone, msg)

        return None  # Already sent via send_whatsapp_message

    else:
        # Default state
        return f"Hey {name}! Send 'news' to see your trending headlines."


@app.route("/webhook", methods=['POST'])
def whatsapp_webhook():
    """Handle incoming WhatsApp messages."""
    from_number = request.values.get('From', '')

    # Check if this is an interactive message response
    button_payload = request.values.get('ButtonPayload', '')
    list_reply = request.values.get('ListReply', '')

    if button_payload:
        # User clicked a button
        incoming_msg = button_payload
        print(f"[WhatsApp] Button clicked from {from_number}: {incoming_msg}")
    elif list_reply:
        # User selected from list
        import json
        try:
            list_data = json.loads(list_reply)
            incoming_msg = list_data.get('id', '')
            print(f"[WhatsApp] List selection from {from_number}: {incoming_msg}")
        except:
            incoming_msg = list_reply
    else:
        # Regular text message
        incoming_msg = request.values.get('Body', '').strip()
        print(f"[WhatsApp] Received from {from_number}: {incoming_msg}")

    # Process message
    try:
        response_text = process_message(from_number, incoming_msg)
    except Exception as e:
        print(f"[WhatsApp] Error: {e}")
        import traceback
        traceback.print_exc()
        response_text = "Sorry, something went wrong. Please try again."

    # Send response via Twilio (only if we have a response)
    resp = MessagingResponse()

    if response_text:
        resp.message(response_text)

    return str(resp)


@app.route("/health", methods=['GET'])
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "whatsapp-bot"}


def send_whatsapp_message(to_number: str, message: str):
    """Send a WhatsApp message via Twilio."""
    try:
        message = twilio_client.messages.create(
            body=message,
            from_=TWILIO_WHATSAPP_NUMBER,
            to=to_number
        )
        print(f"[WhatsApp] Sent message to {to_number}: {message.sid}")
        return message.sid
    except Exception as e:
        print(f"[WhatsApp] Error sending message: {e}")
        return None


if __name__ == "__main__":
    # Initialize Firebase
    init_firebase()

    # Run Flask app
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 WhatsApp Bot running on port {port}")
    print(f"📱 Webhook URL: http://localhost:{port}/webhook")
    print(f"🔗 Use ngrok to expose this for testing: ngrok http {port}")

    app.run(host="0.0.0.0", port=port, debug=True)
