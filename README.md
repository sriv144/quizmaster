Description
QuizMaster is a full-stack web application designed for creating and participating in quizzes. It provides a platform for users to test their knowledge on various subjects, create their own quizzes, and track their performance. This application is built with a modern technology stack, ensuring a responsive and user-friendly experience.

Features
User Authentication: Secure sign-up and sign-in functionality.

Quiz Management:

Create new quizzes with custom questions and options.

Edit existing quizzes.

Delete quizzes.

Take Quizzes:

Browse and search for available quizzes.

Attempt quizzes with a time limit.

Automatic submission when the time is up.

Progress Tracking:

View detailed results and statistics for attempted quizzes.

See your ranking among other users.

Responsive Design: Fully responsive and accessible on various devices.

Tech Stack
Frontend:

React

CSS

Backend:

Node.js

Express

MongoDB

Installation
To get a local copy up and running, follow these simple steps.

Prerequisites
Node.js

npm

MongoDB

Backend Setup
Clone the repository:

Bash

git clone https://github.com/sriv144/quizmaster.git
Navigate to the backend directory:

Bash

cd quizmaster/backend
Install NPM packages:

Bash

npm install
Create a .env file and add the following environment variables:

Code snippet

PORT=5000
MONGO_URI=<YOUR_MONGODB_CONNECTION_STRING>
JWT_SECRET=<YOUR_JWT_SECRET>
Start the server:

Bash

npm start
Frontend Setup
Navigate to the frontend directory:

Bash

cd quizmaster/frontend
Install NPM packages:

Bash

npm install
Create a .env file and add the following environment variable:

Code snippet

REACT_APP_BACKEND_URL=http://localhost:5000
Start the development server:

Bash

npm start
API Endpoints
User Routes
POST /api/users/signup - User registration

POST /api/users/signin - User login

GET /api/users/profile - Get user profile

PUT /api/users/update - Update user profile

Quiz Routes
POST /api/quizzes/create - Create a new quiz

GET /api/quizzes/:id - Get quiz details

PUT /api/quizzes/:id/edit - Edit a quiz

DELETE /api/quizzes/:id/delete - Delete a quiz

GET /api/quizzes/:id/stats - Get quiz statistics

POST /api/quizzes/progress - Track quiz progress

POST /api/quizzes/submit - Submit quiz results

Contributing
Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

Fork the Project

Create your Feature Branch (git checkout -b feature/AmazingFeature)

Commit your Changes (git commit -m 'Add some AmazingFeature')

Push to the Branch (git push origin feature/AmazingFeature)

Open a Pull Request
