# 🧠 QuizMaster

<div align="center">
  <p>
    A full-stack web application for creating and participating in quizzes. Test your knowledge, build your own quizzes, and track your performance with a modern, responsive, and user-friendly experience.
  </p>
</div>

<div align="center">
  <img src="https://img.shields.io/github/license/sriv144/quizmaster?style=for-the-badge" alt="License"/>
  <img src="https://img.shields.io/github/issues/sriv144/quizmaster?style=for-the-badge&color=blueviolet" alt="Issues"/>
  <img src="https://img.shields.io/github/stars/sriv144/quizmaster?style=for-the-badge&color=yellow" alt="Stars"/>
</div>

---

## ✨ Features

* 🔐 **User Authentication**: Secure sign-up and sign-in functionality.
* 📝 **Quiz Management**: Create, edit, and delete quizzes with custom questions and options.
* 🎮 **Interactive Quizzes**: Browse, search, and attempt quizzes with a time limit and automatic submission.
* 📊 **Progress Tracking**: View detailed results, statistics, and see your ranking among other users.
* 📱 **Responsive Design**: Fully accessible and functional on desktops, tablets, and mobile devices.

---

## 🛠️ Tech Stack

This project is built with the MERN stack and other modern technologies.

| Area       | Technology                                                                                           |
| :--------- | :--------------------------------------------------------------------------------------------------- |
| **Frontend** | ![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black) `React` `CSS` |
| **Backend** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white) `Node.js` `Express` |
| **Database** | ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white) `MongoDB` |

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have the following installed on your machine:
* Node.js
* npm (Node Package Manager)
* MongoDB (local or a cloud instance like MongoDB Atlas)

### Installation & Setup

1.  **Clone the Repository**
    ```sh
    git clone [https://github.com/sriv144/quizmaster.git](https://github.com/sriv144/quizmaster.git)
    cd quizmaster
    ```

2.  **Backend Setup**
    ```sh
    cd backend
    npm install
    ```
    Create a `.env` file in the `backend` directory and add the following variables:
    ```env
    PORT=5000
    MONGO_URI=<YOUR_MONGODB_CONNECTION_STRING>
    JWT_SECRET=<YOUR_JWT_SECRET>
    ```
    Start the backend server:
    ```sh
    npm start
    ```

3.  **Frontend Setup**
    ```sh
    cd ../frontend
    npm install
    ```
    Create a `.env` file in the `frontend` directory and add the following:
    ```env
    REACT_APP_BACKEND_URL=http://localhost:5000
    ```
    Start the React development server:
    ```sh
    npm start
    ```
    Your application should now be running at `http://localhost:3000`!

---

## 📡 API Endpoints

The application exposes the following REST API endpoints.

#### User Routes

| Method | Endpoint               | Description            |
| :----- | :--------------------- | :--------------------- |
| `POST` | `/api/users/signup`    | User registration      |
| `POST` | `/api/users/signin`    | User login             |
| `GET`  | `/api/users/profile`   | Get user profile       |
| `PUT`  | `/api/users/update`    | Update user profile    |

#### Quiz Routes

| Method   | Endpoint                     | Description              |
| :------- | :--------------------------- | :----------------------- |
| `POST`   | `/api/quizzes/create`        | Create a new quiz        |
| `GET`    | `/api/quizzes/:id`           | Get quiz details         |
| `PUT`    | `/api/quizzes/:id/edit`      | Edit a quiz              |
| `DELETE` | `/api/quizzes/:id/delete`    | Delete a quiz            |
| `GET`    | `/api/quizzes/:id/stats`     | Get quiz statistics      |
| `POST`   | `/api/quizzes/progress`      | Track quiz progress      |
| `POST`   | `/api/quizzes/submit`        | Submit quiz results      |

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
