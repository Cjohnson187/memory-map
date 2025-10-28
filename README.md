# memory-map

A public, real-time, and collaborative application designed to visualize shared memories and points of interest on an interactive map. Users can contribute geographical "memories" that are instantly synchronized across all active users using **Firebase Firestore**, providing a living, shared tapestry of locations.

---

## ✨ Features

* **Real-Time Mapping:** Instantly view new memory submissions from other users without refreshing, thanks to Firestore's real-time listeners.

* **Interactive Map:** Utilizes **Leaflet.js** for a lightweight, fast, and responsive map interface.

* **Controlled Contribution:** Requires a secret key authorization step before a user can contribute, preventing unauthorized spam.

* **Modern Tooling:** Built using a modern React setup with TypeScript for type safety and Tailwind CSS for rapid, responsive styling.

* **Memory Details:** Each point on the map can store relevant information (e.g., story, location, and timestamps).

---

## 🛠 Tech Stack

This project leverages a powerful and modern set of tools for both the frontend and the cloud backend.

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | **React 19** & **TypeScript** | The main component library and type-safe development. |
| **Mapping** | **Leaflet** | Interactive, mobile-friendly maps. |
| **Backend** | **Firebase Functions (V2)** | Serverless logic for secure key checks and data writes. |
| **Database** | **Firebase Firestore** | Real-time, scalable NoSQL database for memory storage. |
| **Styling** | **Tailwind CSS** | Utility-first CSS framework for rapid UI development. |
| **Icons** | **Lucide React** | Simple and consistent icon library. |
| **Bundler** | **Vite** | Fast development server and build tool. |

### Firebase Cloud Functions

The backend logic is handled by two secure, callable Firebase Functions defined in `functions/index.ts`:

1.  **`checkAuthKey` (Callable Function)**
    * **Purpose:** Verifies a secret `AUTH_KEY` provided by the user against a value securely stored in **Firebase Secret Manager**.
    * **Action:** If the key is valid, it records the user's UID in the `authorizedUsers` collection in Firestore, granting them posting permission.

2.  **`addMemoryFunction` (Callable Function)**
    * **Purpose:** Handles the secure creation of a new memory pin.
    * **Action:** Requires the user to be authenticated and checks the `authorizedUsers` collection to ensure the user has permission before saving the memory to the public collection (`artifacts/memory-map-sr/public/data/memories`).

---

## 📁 Project Structure

The project is split into two main directories: the client-side frontend and the serverless functions.

```
memory-map/
├── public/                      # Static assets (index.html)
├── src/
│   ├── components/              # Reusable React components
│   ├── hooks/                   # Custom React hooks (e.g., useFirebase)
│   ├── utils/                   # Helper functions
│   └── App.tsx                  # Main application component (UI/Logic)
├── functions/                   # Firebase Cloud Functions backend code
│   ├── index.ts                 # Source code for all callable functions
│   └── package.json             # Dependencies for the functions runtime
├── firebase.json                # Firebase deployment configuration
├── firestore.rules              # Defines security rules for the database
├── README.md                    # This file
└── package.json                 # Frontend dependencies and scripts


```

---

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

1.  Node.js (LTS recommended)

2.  A Firebase project configured with **Firestore** and **Cloud Functions** enabled.

3.  The **`AUTH_KEY`** defined in the Firebase Secret Manager (via `firebase functions:secrets:set AUTH_KEY`).

### Installation

1.  **Clone the Repository:**

    ```
    git clone [your-repository-url]
    cd memory-map
    ```

2.  **Install Dependencies:**

    ```
    npm install
    cd functions
    npm install
    cd ..
    ```

3.  **Firebase Configuration:**
    The application needs access to your Firebase project credentials. Create a file named **`.env`** in the project root directory and populate it with your configuration:

    ```
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
  Runs the app in development mode using Vite. Open [http://localhost:5173](https://www.google.com/search?q=http://localhost:5173) to view it in your browser. The page will reload when you make changes.

* **`npm run build`**
  Builds the app for production to the `dist` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

* **`npm run lint`**
  Runs ESLint to check for code quality and style issues.

* **`npm run preview`**
  Locally previews the production build.