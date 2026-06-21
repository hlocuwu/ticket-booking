"""
Run once to pre-generate tokens for all locust users.
Saves tokens.json — Locust loads from it so no login calls during test.

Usage: python3 generate_tokens.py
"""
import json
import threading
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

HOST         = "https://flashticket.site"
PASSWORD     = "Load@1234"
NUM_USERS    = 1000
WORKERS      = 10
OUTPUT_FILE  = "tokens.json"


def fetch(username):
    try:
        r = requests.post(
            f"{HOST}/api/auth/login",
            json={"username": username, "password": PASSWORD},
            timeout=30,
        )
        return username, r.json().get("token", "")
    except Exception as e:
        print(f"  WARN {username}: {e}")
        return username, ""


def main():
    usernames = [f"locust_{i}" for i in range(1, NUM_USERS + 1)]
    tokens = {}
    done = 0
    print(f"Logging in {NUM_USERS} users with {WORKERS} workers...")
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(fetch, u): u for u in usernames}
        for f in as_completed(futures):
            username, token = f.result()
            tokens[username] = token
            done += 1
            if done % 50 == 0:
                ok = sum(1 for t in tokens.values() if t)
                print(f"  {done}/{NUM_USERS} done, {ok} tokens OK")

    ok = sum(1 for t in tokens.values() if t)
    print(f"\nDone: {ok}/{NUM_USERS} tokens OK")
    with open(OUTPUT_FILE, "w") as f:
        json.dump(tokens, f)
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
