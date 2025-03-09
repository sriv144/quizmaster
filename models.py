# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(10), default='user')
    full_name = db.Column(db.String(120))
    qualification = db.Column(db.String(120))
    dob = db.Column(db.Date)
    contact_no = db.Column(db.String(20))  # New: Contact Number


# ... other models remain unchanged ...


class Subject(db.Model):
    __tablename__ = 'subjects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)  # optional description
    chapters = db.relationship('Chapter', backref='subject', lazy=True)

class Chapter(db.Model):
    __tablename__ = 'chapters'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    # Cascade delete quizzes when a chapter is deleted.
    quizzes = db.relationship('Quiz', backref='chapter', cascade="all, delete-orphan", lazy=True)
    
    @property
    def questions_count(self):
        # Sum the number of questions across all quizzes in this chapter.
        return sum(len(quiz.questions) for quiz in self.quizzes)

class Quiz(db.Model):
    __tablename__ = 'quizzes'
    id = db.Column(db.Integer, primary_key=True)
    chapter_id = db.Column(db.Integer, db.ForeignKey('chapters.id'), nullable=False)
    name = db.Column(db.String(120))
    date_of_quiz = db.Column(db.Date, nullable=True)
    time_duration = db.Column(db.String(10), nullable=True)
    # New fields to schedule the quiz
    start_time = db.Column(db.DateTime, nullable=True)
    end_time = db.Column(db.DateTime, nullable=True)
    # Cascade delete questions when a quiz is deleted.
    questions = db.relationship('Question', backref='quiz', cascade="all, delete-orphan", lazy=True)

class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    question_statement = db.Column(db.Text, nullable=False)
    option1 = db.Column(db.String(255), nullable=False)
    option2 = db.Column(db.String(255), nullable=False)
    option3 = db.Column(db.String(255))
    option4 = db.Column(db.String(255))
    correct_option = db.Column(db.String(50), nullable=False)
    # New fields for question type and difficulty, and image support:
    question_type = db.Column(db.String(50), default="single")  # "single", "multiselect", "integer"
    image_url = db.Column(db.String(255))
    difficulty = db.Column(db.String(50), default="Medium")

class Score(db.Model):
    __tablename__ = 'scores'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    time_stamp_of_attempt = db.Column(db.DateTime, default=datetime.utcnow)
    total_scored = db.Column(db.Integer, default=0)
    time_spent = db.Column(db.Integer, default=0)  # in seconds
