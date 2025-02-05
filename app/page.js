"use client";  // Add this at the top of the file

// pages/index.js
import { useState } from "react";

export default function Home() {
  // Chat state
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  // Genius scraper state
  const [scrapeMode, setScrapeMode] = useState("url"); // "url" or "artist"
  const [scrapeInput, setScrapeInput] = useState("");
  const [scrapedLyrics, setScrapedLyrics] = useState("");
  const [loadingScrape, setLoadingScrape] = useState(false);

  // Send chat message to backend
  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    console.log("Sending message:", chatInput.trim());  // Debug log
    console.log("Current history:", chatHistory);  // Debug log
    
    const newHistory = [
      ...chatHistory,
      { role: "user", content: chatInput.trim() },
    ];
    setChatHistory(newHistory);
    setChatInput("");
    setLoadingChat(true);

    try {
      console.log("Making API request...");  // Debug log
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify({
          message: chatInput.trim(),
          history: chatHistory,
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();  // Get error details
        console.error("Server response:", {
          status: res.status,
          statusText: res.statusText,
          body: errorText
        });  // Detailed error log
        throw new Error(`HTTP error! status: ${res.status}, details: ${errorText}`);
      }
      
      const data = await res.json();
      console.log("Received response:", data);  // Debug log
      
      const reply = { role: "assistant", content: data.response };
      setChatHistory((prev) => [...prev, reply]);
    } catch (error) {
      console.error("Full error details:", {
        message: error.message,
        stack: error.stack
      });  // Detailed error log
      
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error.message}` },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Trigger Genius scraping
  const scrapeLyrics = async (e) => {
    e.preventDefault();
    if (!scrapeInput.trim()) return;
    setLoadingScrape(true);
    setScrapedLyrics("");
    try {
      const res = await fetch("http://localhost:5000/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify({
          mode: scrapeMode,
          value: scrapeInput.trim(),
        }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setScrapedLyrics(data.lyrics);
    } catch (error) {
      console.error("Scrape error:", error);
      setScrapedLyrics("Error: Unable to scrape lyrics.");
    } finally {
      setLoadingScrape(false);
    }
  };

  return (
    <div className="container">
      <h1>Lyrics Chatbot</h1>
      <div className="chat-section">
        <h2>Interactive Lyric Writing</h2>
        <div className="chat-window">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`message ${msg.role === "assistant" ? "assistant" : "user"}`}
            >
              <strong>{msg.role === "assistant" ? "Bot" : "You"}:</strong>{" "}
              {msg.content}
            </div>
          ))}
          {loadingChat && <div className="message assistant">Typing...</div>}
        </div>
        <form onSubmit={sendChatMessage} className="chat-form">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Enter your lyric prompt (e.g., 'write a verse about love in Eminem style')"
          />
          <button type="submit" disabled={loadingChat}>
            Send
          </button>
        </form>
      </div>

      <hr />

      <div className="scraper-section">
        <h2>Artist-Inspired Writing: Genius Scraper</h2>
        <form onSubmit={scrapeLyrics} className="scrape-form">
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="mode"
                value="url"
                checked={scrapeMode === "url"}
                onChange={() => setScrapeMode("url")}
              />
              Song URL
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                value="artist"
                checked={scrapeMode === "artist"}
                onChange={() => setScrapeMode("artist")}
              />
              Artist Username
            </label>
          </div>
          <input
            type="text"
            value={scrapeInput}
            onChange={(e) => setScrapeInput(e.target.value)}
            placeholder={
              scrapeMode === "url"
                ? "Enter Genius song URL"
                : "Enter exact Genius artist username (e.g., Eminem)"
            }
          />
          <button type="submit" disabled={loadingScrape}>
            {loadingScrape ? "Scraping..." : "Scrape Lyrics"}
          </button>
        </form>
        {scrapedLyrics && (
          <div className="scraped-lyrics">
            <h3>Scraped Lyrics:</h3>
            <pre>{scrapedLyrics}</pre>
          </div>
        )}
      </div>

      <style jsx>{`
        .container {
          max-width: 800px;
          margin: 2rem auto;
          padding: 1rem;
          font-family: Arial, sans-serif;
        }
        h1, h2, h3 {
          text-align: center;
        }
        .chat-section, .scraper-section {
          margin-bottom: 2rem;
        }
        .chat-window {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 1rem;
          height: 300px;
          overflow-y: auto;
          background: #f9f9f9;
        }
        .message {
          margin-bottom: 0.8rem;
        }
        .message.assistant {
          color: #006400;
        }
        .message.user {
          text-align: right;
          color: #00008b;
        }
        .chat-form, .scrape-form {
          display: flex;
          margin-top: 1rem;
          gap: 0.5rem;
        }
        input[type="text"] {
          flex: 1;
          padding: 0.5rem;
          font-size: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          padding: 0.5rem 1rem;
          font-size: 1rem;
          border: none;
          background: #0070f3;
          color: #fff;
          border-radius: 4px;
          cursor: pointer;
        }
        button:disabled {
          background: #999;
        }
        .radio-group {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .scraped-lyrics {
          margin-top: 1rem;
          background: #eee;
          padding: 1rem;
          border-radius: 4px;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}
