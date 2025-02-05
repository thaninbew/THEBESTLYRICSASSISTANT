import os
import asyncio
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from dotenv import load_dotenv 

load_dotenv()

client = OpenAI()

last_scraped_lyrics = ""

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

def scrape_lyrics_from_url(url):
    """scrape lyrics from a genius song page given its url."""
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        return f"Error: Unable to fetch URL (status code {resp.status_code})."
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # look for the modern genius lyrics container
    lyric_divs = soup.find_all("div", attrs={"data-lyrics-container": "true"})
    if lyric_divs:
        lyrics = "\n".join(div.get_text(separator="\n").strip() for div in lyric_divs)
        return lyrics.strip()
    
    # fallback: try the old lyrics div
    old_lyrics_div = soup.find("div", class_="lyrics")
    if old_lyrics_div:
        return old_lyrics_div.get_text(separator="\n").strip()
    
    return "Lyrics not found on this page."

def scrape_lyrics_from_artist(username, max_songs=5):
    """
    Scrape lyrics for an artist using their exact Genius username.
    We try the artist's songs page and scrape a limited number of song URLs.
    """
    # construct the artist's songs URL. 
    artist_url = f"https://genius.com/artists/{username}/songs"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(artist_url, headers=headers)
    if resp.status_code != 200:
        return f"Error: Unable to fetch artist page (status code {resp.status_code})."

    soup = BeautifulSoup(resp.text, "html.parser")
    # find all song links – we look for anchor tags with hrefs that match a Genius song URL pattern.
    song_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # a very basic filter: the URL should start with 'https://genius.com/' and likely contain '-lyrics'
        if href.startswith("https://genius.com/") and re.search(r"-lyrics", href):
            song_links.append(href)
    # remove duplicates and limit to max_songs
    song_links = list(dict.fromkeys(song_links))[:max_songs]
    if not song_links:
        return "No song links found for this artist."

    # for each song URL, scrape the lyrics and combine them
    all_lyrics = []
    for idx, song_url in enumerate(song_links, 1):
        lyrics = scrape_lyrics_from_url(song_url)
        all_lyrics.append(f"--- Song {idx}: {song_url} ---\n{lyrics}\n")
    return "\n".join(all_lyrics)


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        
        if not data or "message" not in data:
            return jsonify({"response": "Invalid request: missing 'message' field."}), 400

        user_message = data.get("message")
        history = data.get("history", [])

        system_prompt = (
            "You are a songwriting assistant. Use this context:\n"
            f"{last_scraped_lyrics}\n\n"
            "Suggest improvements while maintaining the artist's style. "
            "Keep responses concise."
        )

        messages = [{"role": "system", "content": system_prompt}]
        
        if isinstance(history, list):
            for msg in history:
                if "role" in msg and "content" in msg:
                    messages.append({"role": msg["role"], "content": msg["content"]})
        
        messages.append({"role": "user", "content": user_message})
        
        try:
            completion = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=150,
                temperature=0.7,
            )
            reply = completion.choices[0].message.content.strip()
            return jsonify({"response": reply})
        except Exception as e:
            return jsonify({"response": f"Error generating response from AI: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"response": f"Server error: {str(e)}"}), 500


@app.route("/api/scrape", methods=["POST"])
def scrape():
    global last_scraped_lyrics
    data = request.get_json()
    if not data or "mode" not in data or "value" not in data:
        return jsonify({"lyrics": "Invalid request: missing required fields."}), 400

    mode = data.get("mode")
    value = data.get("value").strip()

    try:
        if mode == "url":
            lyrics = scrape_lyrics_from_url(value)
        elif mode == "artist":
            lyrics = scrape_lyrics_from_artist(value)
        else:
            return jsonify({"lyrics": "Invalid mode. Use 'url' or 'artist'."}), 400

        last_scraped_lyrics = lyrics
        return jsonify({"lyrics": lyrics})
    except Exception as e:
        return jsonify({"lyrics": "Error occurred during scraping."}), 500

if __name__ == "__main__":
    # For production, consider using a production-ready server (e.g., Gunicorn)
    app.run(host="0.0.0.0", port=5000, debug=True)
