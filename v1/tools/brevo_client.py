"""
Brevo Email Client - sends transactional emails via Brevo API.

Usage:
    python v1/tools/brevo_client.py --to "test@example.com" --subject "Test" --html "<p>Hello</p>"
"""
import argparse
import os
import sys
import time
from pathlib import Path
from typing import Optional

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")


# Default sender configuration
DEFAULT_SENDER_EMAIL = "yourtrace.online@gmail.com"
DEFAULT_SENDER_NAME = "Trace"

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2


def send_email(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    sender_email: str = DEFAULT_SENDER_EMAIL,
    sender_name: str = DEFAULT_SENDER_NAME,
    reply_to_email: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> dict:
    """
    Send an email via Brevo API.

    Args:
        to_email: Recipient email address
        to_name: Recipient name (optional)
        subject: Email subject
        html_content: HTML body content
        text_content: Plain text body (optional, will be generated from HTML if not provided)
        sender_email: Sender email address
        sender_name: Sender display name
        reply_to_email: Reply-to address (optional)
        tags: List of tags for tracking (optional)

    Returns:
        Dict with:
        - success: bool
        - message_id: str (if successful)
        - error: str (if failed)
    """
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "BREVO_API_KEY not set in environment",
        }

    try:
        import sib_api_v3_sdk
        from sib_api_v3_sdk.rest import ApiException

        # Configure API client
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key["api-key"] = api_key

        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
            sib_api_v3_sdk.ApiClient(configuration)
        )

        # Build recipient
        to = [{"email": to_email}]
        if to_name:
            to[0]["name"] = to_name

        # Build sender
        sender = {"email": sender_email, "name": sender_name}

        # Generate plain text from HTML if not provided
        if not text_content:
            import re
            text_content = re.sub(r'<[^>]+>', '', html_content)
            text_content = re.sub(r'\s+', ' ', text_content).strip()

        # Build email object
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=to,
            sender=sender,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )

        if reply_to_email:
            send_smtp_email.reply_to = {"email": reply_to_email}

        if tags:
            send_smtp_email.tags = tags

        # Send with retry
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = api_instance.send_transac_email(send_smtp_email)
                return {
                    "success": True,
                    "message_id": response.message_id,
                }
            except ApiException as e:
                last_error = str(e)
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                continue

        return {
            "success": False,
            "error": f"Failed after {MAX_RETRIES} retries: {last_error}",
        }

    except ImportError:
        return {
            "success": False,
            "error": "sib-api-v3-sdk not installed. Run: pip install sib-api-v3-sdk",
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
        }


def send_newsletter_email(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> dict:
    """
    Send a newsletter email with standard configuration.

    Args:
        to_email: Recipient email
        to_name: Recipient name
        subject: Email subject
        html_content: HTML newsletter content
        text_content: Plain text content (optional)

    Returns:
        Result dict from send_email
    """
    return send_email(
        to_email=to_email,
        to_name=to_name,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        sender_email=DEFAULT_SENDER_EMAIL,
        sender_name=DEFAULT_SENDER_NAME,
        tags=["newsletter", "daily"],
    )


def main():
    parser = argparse.ArgumentParser(description="Send email via Brevo")
    parser.add_argument("--to", required=True, help="Recipient email")
    parser.add_argument("--to-name", help="Recipient name")
    parser.add_argument("--subject", required=True, help="Email subject")
    parser.add_argument("--html", required=True, help="HTML content")
    parser.add_argument("--text", help="Plain text content")
    args = parser.parse_args()

    result = send_email(
        to_email=args.to,
        to_name=args.to_name,
        subject=args.subject,
        html_content=args.html,
        text_content=args.text,
    )

    if result["success"]:
        print(f"Email sent! Message ID: {result['message_id']}")
    else:
        print(f"Failed: {result['error']}")


if __name__ == "__main__":
    main()
