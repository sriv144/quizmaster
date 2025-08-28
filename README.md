# 🧠 QuizMaster

<div align="center">
  <p>
    A dynamic quiz application built with Python Flask and Bootstrap. Users can test their knowledge on various topics and compete for the top spot on the leaderboard!
  </p>
</div>



---

## ✨ Features

* **👤 User Authentication**: Secure login and registration system.
* **📚 Topic Selection**: Choose from a variety of quiz categories.
* **❓ Interactive Quizzes**: A clean and intuitive interface for answering questions.
* **💯 Real-time Scoring**: Get instant feedback and see your score update live.
* **🏆 Leaderboard**: Check the leaderboard to see how you rank against other players.
* **📱 Responsive Design**: Built with Bootstrap for a seamless experience on both desktop and mobile devices.

---

## 🛠️ Technology Stack

This project was built using the following technologies:

| Area      | Technology                                                                                                                                                                   |
| :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend** | ![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white) `Python` ![Flask](https://img.shields.io/badge/Flask-000000?style=flat&logo=flask&logoColor=white) `Flask` |
| **Frontend** | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white) `HTML5` ![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=flat&logo=bootstrap&logoColor=white) `Bootstrap` |
| **Database** | `SQLite`                                                                                                       |

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have **Python 3** and **pip** installed on your machine.

### Installation & Setup

1.  **Clone the Repository**
    ```sh
    git clone [https://github.com/sriv144/quizmaster.git](https://github.com/sriv144/quizmaster.git)
    cd quizmaster
    ```

2.  **Create and Activate a Virtual Environment**
    * It's highly recommended to use a virtual environment to manage project dependencies.

    * **On macOS/Linux:**
        ```sh
        python3 -m venv venv
        source venv/bin/activate
        ```
    * **On Windows:**
        ```sh
        python -m venv venv
        .\venv\Scripts\activate
        ```

3.  **Install Dependencies**
    * Install all the required Python packages from the `requirements.txt` file.
    ```sh
    pip install -r requirements.txt
    ```

4.  **Set Up Environment Variables** (Optional)
    * If your app uses a `.env` file for configuration (like a secret key), create it now.
    ```env
    FLASK_APP=app.py
    FLASK_ENV=development
    SECRET_KEY='your_super_secret_key'
    ```

5.  **Run the Application**
    * Start the Flask development server.
    ```sh
    flask run
    ```
    Your application should now be running at `http://127.0.0.1:5000/`!

---



---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
