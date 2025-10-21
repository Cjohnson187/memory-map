# memory-map

A public, real-time, and collaborative application designed to visualize shared memories and points of interest on an interactive map. Users can contribute geographical "memories" that are instantly synchronized across all active users using **Firebase Firestore**, providing a living, shared tapestry of locations.

---

## ✨ Features

* **Real-Time Mapping:** Instantly view new memory submissions from other users without refreshing, thanks to Firestore's real-time listeners.
* **Interactive Map:** Utilizes **Leaflet.js** for a lightweight, fast, and responsive map interface.
* **Public Contribution:** Designed as a collaborative platform where anyone can add and view shared geographical points.
* **Modern Tooling:** Built using a modern React setup with TypeScript for type safety and Tailwind CSS for rapid, responsive styling.
* **Memory Details:** Each point on the map can store relevant information (e.g., title, description, and possibly timestamps).

---

## 🛠 Tech Stack

This project leverages a powerful and modern set of tools:

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | **React 19** & **TypeScript** | The main component library and type-safe development. |
| **Mapping** | **Leaflet** | Interactive, mobile-friendly maps. |
| **Database** | **Firebase Firestore** | Real-time, scalable NoSQL database for memory storage. |
| **Styling** | **Tailwind CSS** | Utility-first CSS framework for rapid UI development. |
| **Icons** | **Lucide React** | Simple and consistent icon library. |
| **Bundler** | **Vite** | Fast development server and build tool. |

---

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

1.  Node.js (LTS recommended)
2.  A Firebase project configured with **Firestore** enabled.

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone [your-repository-url]
    cd memory-map
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Firebase Configuration:**
    The application needs access to your Firebase project credentials. Create a file named **`.env`** in the project root directory and populate it with your configuration:

    ```env
    VITE_FIREBASE_API_KEY="YOUR_API_KEY"
    VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    VITE_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    VITE_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
    VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    VITE_FIREBASE_APP_ID="YOUR_APP_ID"
    ```
    *(Note: Vite automatically exposes environment variables prefixed with `VITE_`.)*

### Available Scripts

In the project directory, you can run:

* **`npm run dev`**
  Runs the app in development mode using Vite. Open [http://localhost:5173](http://localhost:5173) to view it in your browser. The page will reload when you make changes.

* **`npm run build`**
  Builds the app for production to the `dist` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

* **`npm run lint`**
  Runs ESLint to check for code quality and style issues.

* **`npm run preview`**
  Locally previews the production build.