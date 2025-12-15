const session = require("express-session");
const multer = require("multer");
const path = require("path");
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();
const messages = [];

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.set("trust proxy", 1);
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));
app.use(session({
  secret: process.env.SESSION_SECRET || "zipline_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Render handles HTTPS
    sameSite: "lax"
  }
}));
// SIGNUP
app.post("/signup", upload.single("photo"), async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const photo = req.file ? req.file.filename : null;

  db.run(
    "INSERT INTO users (name, email, password, photo) VALUES (?, ?, ?, ?)",
    [name, email, hashedPassword, photo],
    err => {
      if (err) {
        res.send("<h2>Email already exists</h2>");
      } else {
        res.send(`<a href="/login.html">Login</a>`);
      }
    }
  );
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (!user) {
        res.send("<h2>User not found</h2>");
        return;
      }

      const match = await bcrypt.compare(password, user.password);

      if (match) {
  req.session.user = user;
  res.redirect("/profile");
}else {
        res.send("<h2>Wrong password</h2>");
      }
    }
  );
});

// PROFILE
app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  const user = req.session.user;

  res.send(`
    <h1>${user.name}</h1>
    <img src="/uploads/${user.photo}" width="150">
    <p>${user.email}</p>
    <a href="/">Home</a>
  `);
});

app.listen(3000, () => {
  console.log("Zipline running");
});
app.use("/uploads", express.static("uploads"));

app.post("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");

  messages.push({
    user: req.session.user.name,
    text: req.body.message
  });

  res.redirect("/chat");
});

app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");

  const chat = messages.map(m =>
    `<p><strong>${m.user}:</strong> ${m.text}</p>`
  ).join("");

  res.send(`
    <h1>Chat</h1>
    ${chat}
    <form method="POST" action="/chat">
      <input name="message">
      <button>Send</button>
    </form>
  `);
});

app.post("/like", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");

  const fromUser = req.session.user.email;
  const toUser = req.body.toUser;

  // Save the like
  db.run(
    "INSERT INTO likes (from_user, to_user) VALUES (?, ?)",
    [fromUser, toUser]
  );

  // Check if the other user already liked back
  db.get(
    "SELECT * FROM likes WHERE from_user = ? AND to_user = ?",
    [toUser, fromUser],
    (err, row) => {
      if (row) {
        // MATCH!
        db.run(
          "INSERT INTO matches (user1, user2) VALUES (?, ?)",
          [fromUser, toUser]
        );
        res.send("<h2>🎉 It's a Match!</h2><a href='/matches'>View Matches</a>");
      } else {
        res.send("<h2>❤️ Liked!</h2><a href='/browse'>Keep Browsing</a>");
      }
    }
  );
});

app.get("/browse", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");

  const currentUser = req.session.user.email;

  db.all(
    "SELECT name, email FROM users WHERE email != ?",
    [currentUser],
    (err, users) => {
      const list = users.map(u => `
        <div>
          <p>${u.name}</p>
          <form method="POST" action="/like">
            <input type="hidden" name="toUser" value="${u.email}">
            <button>❤️ Like</button>
          </form>
        </div>
      `).join("");

      res.send(`
        <h1>Browse</h1>
        ${list}
        <a href="/profile">Profile</a>
      `);
    }
  );
});

app.get("/matches", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");

  const email = req.session.user.email;

  db.all(
    "SELECT * FROM matches WHERE user1 = ? OR user2 = ?",
    [email, email],
    (err, rows) => {
      const matches = rows.map(m => {
        const other = m.user1 === email ? m.user2 : m.user1;
        return `<p>💖 Matched with ${other}</p>`;
      }).join("");

      res.send(`
        <h1>Your Matches</h1>
        ${matches || "<p>No matches yet</p>"}
        <a href="/browse">Browse more</a>
      `);
    }
  );
});

app.get("/users", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const myId = req.session.user.id;

  db.all(
    `SELECT id, username, photo 
     FROM users 
     WHERE id != ?`,
    [myId],
    (err, users) => {
      if (err) return res.status(500).json(err);
      res.json(users);
    }
  );
});

app.post("/like", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const likerId = req.session.user.id;
  const { likedId } = req.body;

  // Save the like
  db.run(
    `INSERT INTO likes (liker_id, liked_id) VALUES (?, ?)`,
    [likerId, likedId],
    err => {
      if (err) return res.status(500).json(err);

      // Check if the other user already liked me
      db.get(
        `SELECT * FROM likes 
         WHERE liker_id = ? AND liked_id = ?`,
        [likedId, likerId],
        (err, row) => {
          if (row) {
            // MATCH FOUND
            db.run(
              `INSERT INTO matches (user1_id, user2_id)
               VALUES (?, ?)`,
              [likerId, likedId]
            );

            return res.json({ match: true });
          }

          res.json({ match: false });
        }
      );
    }
  );
});
function isMatched(userA, userB, cb) {
  db.get(
    `SELECT * FROM matches
     WHERE (user1_id = ? AND user2_id = ?)
        OR (user1_id = ? AND user2_id = ?)`,
    [userA, userB, userB, userA],
    (err, row) => cb(!!row)
  );
}

app.post("/message", (req, res) => {
  const sender = req.session.user.id;
  const { receiverId, text } = req.body;

  isMatched(sender, receiverId, matched => {
    if (!matched) {
      return res.status(403).json({ error: "Not matched" });
    }

    db.run(
      `INSERT INTO messages (sender_id, receiver_id, text)
       VALUES (?, ?, ?)`,
      [sender, receiverId, text],
      () => res.json({ success: true })
    );
  });
});
app.post("/upload-photo", upload.single("photo"), (req, res) => {
  const userId = req.session.user.id;
  const photoPath = `/uploads/${req.file.filename}`;

  db.run(
    `UPDATE users SET photo = ? WHERE id = ?`,
    [photoPath, userId],
    () => res.json({ photo: photoPath })
  );
});
app.get("/matches", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const myId = req.session.user.id;

  db.all(
    `
    SELECT u.id, u.username, u.photo
    FROM matches m
    JOIN users u
      ON (u.id = m.user1_id OR u.id = m.user2_id)
    WHERE (m.user1_id = ? OR m.user2_id = ?)
      AND u.id != ?
    `,
    [myId, myId, myId],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});
app.get("/messages/:userId", (req, res) => {
  const myId = req.session.user.id;
  const otherId = req.params.userId;

  isMatched(myId, otherId, matched => {
    if (!matched) {
      return res.status(403).json({ error: "Not matched" });
    }

    db.all(
      `
      SELECT sender_id, text, created_at
      FROM messages
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
      `,
      [myId, otherId, otherId, myId],
      (err, rows) => {
        res.json(rows);
      }
    );
  });
});
app.get("/liked-me", (req, res) => {
  const myId = req.session.user.id;

  db.all(
    `
    SELECT u.id, u.username, u.photo
    FROM likes l
    JOIN users u ON u.id = l.liker_id
    WHERE l.liked_id = ?
    `,
    [myId],
    (err, rows) => {
      res.json(rows);
    }
  );
});