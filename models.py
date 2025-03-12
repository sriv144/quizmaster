from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import func

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    full_name = db.Column(db.String(100))
    dob = db.Column(db.Date)
    contact_no = db.Column(db.String(15))
    role = db.Column(db.String(20), default="user")

class Subject(db.Model):
    __tablename__ = 'subjects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    chapters = db.relationship('Chapter', backref='subject', cascade="all, delete-orphan", lazy=True)

class Chapter(db.Model):
    __tablename__ = 'chapters'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    quizzes = db.relationship('Quiz', backref='chapter', cascade="all, delete-orphan", lazy=True)
    
    @property
    def questions_count(self):
        count = 0
        for quiz in self.quizzes:
            count += len(quiz.questions)
        return count

class Quiz(db.Model):
    __tablename__ = 'quizzes'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    chapter_id = db.Column(db.Integer, db.ForeignKey('chapters.id'), nullable=False)
    date_of_quiz = db.Column(db.Date)
    time_duration = db.Column(db.Integer)  # Duration in minutes
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    questions = db.relationship('Question', backref='quiz', cascade="all, delete-orphan", lazy=True)
    scores = db.relationship('Score', backref='quiz', cascade="all, delete-orphan", lazy=True)
    
    @property
    def avg_score(self):
        """Calculate average score for this quiz"""
        return db.session.query(func.avg(Score.total_scored)).filter(Score.quiz_id == self.id).scalar() or 0
    
    @property
    def avg_time(self):
        """Calculate average time spent on this quiz in seconds"""
        return db.session.query(func.avg(Score.time_spent)).filter(Score.quiz_id == self.id).scalar() or 0
    
    @property
    def completion_rate(self):
        """Calculate quiz completion rate as percentage"""
        total_attempts = Score.query.filter_by(quiz_id=self.id).count()
        total_users = User.query.filter_by(role="user").count()
        return (total_attempts / total_users * 100) if total_users > 0 else 0

class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    question_statement = db.Column(db.Text, nullable=False)
    option1 = db.Column(db.String(200))
    option2 = db.Column(db.String(200))
    option3 = db.Column(db.String(200))
    option4 = db.Column(db.String(200))
    correct_option = db.Column(db.String(200))
    difficulty = db.Column(db.String(20), default="Medium")
    question_type = db.Column(db.String(20), default="single")
    marks = db.Column(db.Integer, default=1)
    image_path = db.Column(db.String(200))
    attempts = db.relationship('QuestionAttempt', backref='question', cascade="all, delete-orphan", lazy=True)
    
    @property
    def success_rate(self):
        """Calculate the percentage of correct answers for this question"""
        total = QuestionAttempt.query.filter_by(question_id=self.id).count()
        if total == 0:
            return 0
        correct = QuestionAttempt.query.filter_by(question_id=self.id, is_correct=True).count()
        return (correct / total * 100) if total > 0 else 0
    
    @property
    def avg_time_spent(self):
        """Calculate average time spent on this question in seconds"""
        return db.session.query(func.avg(QuestionAttempt.time_spent)).filter(
            QuestionAttempt.question_id == self.id).scalar() or 0

class Score(db.Model):
    __tablename__ = 'scores'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    total_scored = db.Column(db.Float, nullable=False, default=0.0)
    time_spent = db.Column(db.Integer, nullable=False, default=0)  # in seconds
    time_stamp_of_attempt = db.Column(db.DateTime, default=datetime.utcnow)
    completion_status = db.Column(db.String(20), default='Completed')  # Completed, Partial, Abandoned
    total_questions = db.Column(db.Integer, default=0)
    questions_answered = db.Column(db.Integer, default=0)
    questions_correct = db.Column(db.Integer, default=0)
    percentile = db.Column(db.Float)  # Calculated percentile compared to others
    question_attempts = db.relationship('QuestionAttempt', backref='score', cascade="all, delete-orphan", lazy=True)
    comments = db.relationship('ScoreComment', backref='score', cascade="all, delete-orphan", lazy=True)
    
    @property
    def accuracy(self):
        """Calculate accuracy percentage"""
        return (self.questions_correct / self.total_questions * 100) if self.total_questions > 0 else 0

class QuestionAttempt(db.Model):
    """Track detailed data about each question attempt"""
    __tablename__ = 'question_attempts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    score_id = db.Column(db.Integer, db.ForeignKey('scores.id'), nullable=False)
    user_answer = db.Column(db.String(255))  # Store the user's selected answer(s)
    is_correct = db.Column(db.Boolean, default=False)
    time_spent = db.Column(db.Integer)  # Time spent on this question in seconds
    attempt_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='question_attempts')

class ScoreComment(db.Model):
    """Allow admins to provide feedback on quiz attempts"""
    __tablename__ = 'score_comments'
    id = db.Column(db.Integer, primary_key=True)
    score_id = db.Column(db.Integer, db.ForeignKey('scores.id'), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    comment_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    admin = db.relationship('User', backref='comments_made')

class UserStrength(db.Model):
    """Track user's strengths and weaknesses by subject/chapter"""
    __tablename__ = 'user_strengths'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True)
    chapter_id = db.Column(db.Integer, db.ForeignKey('chapters.id'), nullable=True)
    performance_score = db.Column(db.Float, default=0.0)  # 0-100 score
    questions_attempted = db.Column(db.Integer, default=0)
    questions_correct = db.Column(db.Integer, default=0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='strengths')
    subject = db.relationship('Subject', backref='user_performances')
    chapter = db.relationship('Chapter', backref='user_performances')
