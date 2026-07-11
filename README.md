# 🕹️ Tetris Retro Project

A modern, web-based recreation of the classic Tetris game built using vanilla web technologies. This project features a clean user interface, responsive controls, local game-state saving, and a persistent log history ready for database integration.

---

## 🚀 Features

* **Responsive Gameplay Canvas:** Smooth, grid-based piece movement and collision detection.
* **Game State Control:** Fully functional **Start / Pause / Stop** button logic that prevents time-skipping or lag calculation issues when resuming.
* **Dynamic Splash Screen:** User authentication and validation system requiring valid inputs before blurring out the UI background and starting the game.
* **Automated Form Validation:** Real-time username validation that filters accidental whitespaces (`.trim()`) and enforces formatting rules.
* **Persistent Match Logs:** A dynamic logging component that keeps track of the **Game Mode**, **Score**, and **Timestamp** for each match played, featuring an automatic layout height container that grows seamlessly as items are added.
* **Glassmorphism UI:** Modern, slick CSS styling with backdrop blur filters and semi-transparent layers for an arcade-like aesthetic.
* **Robust Backend Communications:** Includes a fully modular API request helper prepared to route game data dynamically via `GET` and `POST` methods to a PHP backend (`db.php`).

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Flexbox, Grid, Glassmorphism), Vanilla JavaScript (ES2020 features like Optional Chaining `?.` and Nullish Coalescing `??`).
* **Backend Support:** PHP (prepared API routing architecture with robust JSON error-handling and precise HTTP status response structures).

---

## 🕹️ Controls

| Action | Key |
| :--- | :--- |
| Move Left | `A` / `ArrowLeft` |
| Move Right | `D` / `ArrowRight` |
| Soft Drop | `S` / `ArrowDown` |
| Rotate Piece | *[Insert your rotation key, e.g., W or Space]* |

---

## 🔮 Future Roadmap (Planned Features)

While the project currently delivers a fully functional single-player environment, the architecture was designed with scalability in mind. Future development milestones include:

1.  **Full Database Integration:** Linking the existing PHP handler to a MySQL database to save high scores and logs permanently.
2.  **Real-Time Online Multiplayer:** Implementing a server-authoritative dedicated server using **Node.js** and **WebSockets (Socket.io)** to allow two players to connect from different devices and play in real-time sync.

---

## 💻 Getting Started

1. Clone or download this repository.
2. Open `index.html` directly in your browser to play the single-player game.
3. To test the API communication modules, host the project directory using a local PHP environment (like XAMPP or Laragon).

*Developed with ☕ and JavaScript.*
