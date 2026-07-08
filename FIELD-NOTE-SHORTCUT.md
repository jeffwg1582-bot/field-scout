# "Hey Siri, Field Note" — 2-minute setup

Talk a note in hands-free; it lands on the Field Scout server. Next time you tap **⬇️ Pull team inbox**, the app turns it into a lead (business you spotted) or files it under 💡 Ideas — automatically.

## Build the Shortcut (on your iPhone)

1. Open the **Shortcuts** app → **+** (new shortcut).
2. Add these actions in order (search each by name):

   **① Dictate Text**
   - Language: English. Leave "Stop Listening" on **After Pause** (or set to "After short pause" if offered).

   **② Get Current Location** *(optional but nice — pins the note to where you were)*

   **③ Get Contents of URL**
   - URL: `https://fieldscout-network.netlify.app/.netlify/functions/note`
   - Tap the arrow to expand → **Method: POST** → Request Body: **JSON**, add fields:
     | key | value |
     |---|---|
     | `pass` | *your owner passcode* |
     | `text` | **Dictated Text** (magic variable from step ①) |
     | `lat` | **Latitude** (from Current Location, step ②) |
     | `lng` | **Longitude** (from Current Location, step ②) |
     | `via` | `siri` |

   **④ Show Notification** *(optional)*
   - Body: `Filed ✅` — so you know it landed.

3. Tap the shortcut's name at the top → **Rename** → call it **Field Note**.
4. Done. Saying **"Hey Siri, Field Note"** now starts dictation immediately — works from lock screen, CarPlay, or AirPods.

## Tips

- Say it like you'd tell a buddy: *"bunch of trucks with Jim Bob Plumbing at the QuikTrip on 281"* → becomes a lead with that as the email hook.
- *"I have an idea — add a leaderboard for the scouts"* → filed under 💡 Ideas.
- One breath can do both: *"Anderson Roofing yard signs all over Timberwood Park, and remind me to call Dave about the booth."*
- Notes wait safely on the server; nothing processes (or costs anything) until you Pull.
- If Siri mishears a company name badly, fix it on the Review card before approving — nothing sends without your approval, same as always.

## Add it to CarPlay / Lock Screen (optional)

Shortcuts app → long-press **Field Note** → **Details** → enable **Show on Apple Watch** / add to Home Screen. In CarPlay, Siri voice works without any of this.
