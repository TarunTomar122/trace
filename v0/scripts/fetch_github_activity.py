#!/usr/bin/env python3
import requests
import json
import sys
import os
from datetime import datetime, timedelta

def fetch_github_activity(username, token=None, days=1):
    """Fetch user's recent GitHub activity"""
    headers = {}
    if token:
        headers['Authorization'] = f'token {token}'
    
    # Get events
    url = f"https://api.github.com/users/{username}/events"
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        return {"error": f"Failed to fetch: {response.status_code}"}
    
    events = response.json()
    cutoff = datetime.now() - timedelta(days=days)
    
    activities = []
    for event in events:
        created_at = datetime.strptime(event['created_at'], "%Y-%m-%dT%H:%M:%SZ")
        if created_at < cutoff:
            continue
            
        activity = {
            "type": event['type'],
            "repo": event['repo']['name'],
            "created_at": event['created_at']
        }
        
        # Add event-specific details
        if event['type'] == 'PushEvent':
            activity['commits'] = len(event['payload'].get('commits', []))
        elif event['type'] == 'IssuesEvent':
            activity['action'] = event['payload'].get('action')
        elif event['type'] == 'PullRequestEvent':
            activity['action'] = event['payload'].get('action')
        elif event['type'] == 'WatchEvent':
            activity['action'] = 'starred'
            
        activities.append(activity)
    
    return activities

if __name__ == "__main__":
    username = sys.argv[1] if len(sys.argv) > 1 else "torvalds"
    token = os.getenv("GITHUB_TOKEN")
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    activities = fetch_github_activity(username, token, days)
    print(json.dumps(activities, indent=2))

