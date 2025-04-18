from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, case, text, Enum, ForeignKey
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, timedelta
import enum
import json

db = SQLAlchemy()

class Role(enum.Enum):
    ADMIN = "admin"
    INSTRUCTOR = "instructor"
    STUDENT = "student"
    USER = "user"

class User(db.Model):
    """User model for authentication and profile management"""
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password = db.Column(db.String(100), nullable=False)
    full_name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True)
    dob = db.Column(db.Date)
    contact_no = db.Column(db.String(15))
    role = db.Column(db.String(20), default="user")
    profile_image = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    scores = db.relationship('Score', backref='user', lazy='dynamic', cascade="all, delete-orphan")
    question_attempts = db.relationship('QuestionAttempt', backref='user', lazy='dynamic')
    comments_received = db.relationship('ScoreComment', backref='user', 
                                        primaryjoin="User.id==Score.user_id",
                                        secondary="scores",
                                        viewonly=True)
    
    @property
    def average_score(self):
        """Calculate user's average score percentage across all quizzes"""
        result = db.session.query(
            func.sum(Score.total_scored).label('total_points'),
            func.sum(Score.total_questions * Question.marks).label('total_possible')
        ).join(Quiz, Score.quiz_id == Quiz.id
        ).join(Question, Question.quiz_id == Quiz.id
        ).filter(Score.user_id == self.id
        ).first()
        
        if result and result.total_possible:
            return (result.total_points / result.total_possible) * 100
        return 0

    @property
    def quizzes_completed(self):
        """Count number of quizzes completed by user"""
        return Score.query.filter_by(user_id=self.id).count()
    
    @property
    def strongest_subject(self):
        """Return the subject where user has the highest performance"""
        strength = UserStrength.query.filter_by(user_id=self.id).order_by(UserStrength.performance_score.desc()).first()
        if strength and strength.subject:
            return strength.subject.name
        return None

    @property
    def consistency_score(self):
        """
        Calculate the standard deviation of the user's quiz accuracies.
        Lower values indicate more consistent performance.
        """
        from statistics import stdev
        scores = [score.accuracy for score in self.scores if score.total_questions > 0]
        if len(scores) < 2:
            return 0.0
        return stdev(scores)

    @property
    def fastest_quiz(self):
        """
        Identify the quiz attempt with the minimum time spent among completed quizzes.
        """
        completed_scores = [s for s in self.scores if s.time_spent > 0]
        if not completed_scores:
            return None
        return min(completed_scores, key=lambda s: s.time_spent)

    @property
    def slowest_quiz(self):
        """
        Identify the quiz attempt with the maximum time spent among completed quizzes.
        """
        completed_scores = [s for s in self.scores if s.time_spent > 0]
        if not completed_scores:
            return None
        return max(completed_scores, key=lambda s: s.time_spent)

    @property
    def subject_performance(self):
        """
        Aggregate performance by subject.
        Returns a dictionary mapping subject names to the average accuracy
        of quizzes taken in that subject.
        """
        performance = {}
        for score in self.scores:
            quiz = score.quiz
            if quiz and quiz.chapter and quiz.chapter.subject:
                subject_name = quiz.chapter.subject.name
                if subject_name not in performance:
                    performance[subject_name] = []
                performance[subject_name].append(score.accuracy)
        # Compute average accuracy for each subject
        for subject in performance:
            accuracies = performance[subject]
            performance[subject] = sum(accuracies) / len(accuracies)
        return performance

class Subject(db.Model):
    """Subject model for organizing chapters"""
    __tablename__ = 'subjects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    description = db.Column(db.Text)
    code = db.Column(db.String(20), unique=True)
    image_path = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    chapters = db.relationship('Chapter', backref='subject', cascade="all, delete-orphan", lazy=True)
    user_performances = db.relationship('UserStrength', backref='subject', lazy='dynamic')
    
    @property
    def quiz_count(self):
        """Count total quizzes in this subject"""
        return db.session.query(func.count(Quiz.id)).join(
            Chapter, Quiz.chapter_id == Chapter.id
        ).filter(Chapter.subject_id == self.id).scalar() or 0
    
    @property
    def question_count(self):
        """Count total questions in this subject"""
        return db.session.query(func.count(Question.id)).join(
            Quiz, Question.quiz_id == Quiz.id
        ).join(
            Chapter, Quiz.chapter_id == Chapter.id
        ).filter(Chapter.subject_id == self.id).scalar() or 0

class Chapter(db.Model):
    """Chapter model for organizing quizzes within subjects"""
    __tablename__ = 'chapters'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    description = db.Column(db.Text)
    seq_num = db.Column(db.Integer, default=0)  # For ordering chapters
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    quizzes = db.relationship('Quiz', backref='chapter', cascade="all, delete-orphan", lazy=True)
    user_performances = db.relationship('UserStrength', backref='chapter', lazy='dynamic')
    
    @property
    def questions_count(self):
        """Count total questions in this chapter"""
        count = 0
        for quiz in self.quizzes:
            count += len(quiz.questions)
        return count
    
    @property
    def avg_difficulty(self):
        """Calculate average difficulty of questions in this chapter"""
        difficulty_map = {"Easy": 1, "Medium": 2, "Hard": 3}
        questions = Question.query.join(
            Quiz, Question.quiz_id == Quiz.id
        ).filter(Quiz.chapter_id == self.id).all()
        
        if not questions:
            return "Medium"
            
        total = 0
        for q in questions:
            total += difficulty_map.get(q.difficulty, 2)
        
        avg = total / len(questions)
        if avg <= 1.5:
            return "Easy"
        elif avg <= 2.5:
            return "Medium"
        else:
            return "Hard"

class QuizType(enum.Enum):
    PRACTICE = "practice"
    ASSESSMENT = "assessment"
    EXAM = "exam"
    SURVEY = "survey"

class Quiz(db.Model):
    """Quiz model for creating and scheduling quizzes"""
    __tablename__ = 'quizzes'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, index=True)
    chapter_id = db.Column(db.Integer, db.ForeignKey('chapters.id'), nullable=False)
    description = db.Column(db.Text)
    instructions = db.Column(db.Text)
    quiz_type = db.Column(db.String(20), default="assessment")
    passing_score = db.Column(db.Float, default=0.0)  # Minimum score to pass
    allow_retake = db.Column(db.Boolean, default=True)
    max_attempts = db.Column(db.Integer, default=1)  # 0 means unlimited
    show_answers = db.Column(db.Boolean, default=True)  # Show correct answers after quiz
    randomize_questions = db.Column(db.Boolean, default=False)
    
    # Scheduling
    date_of_quiz = db.Column(db.Date)
    time_duration = db.Column(db.Integer)  # Duration in minutes
    start_time = db.Column(db.DateTime, index=True)
    end_time = db.Column(db.DateTime, index=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Relationships
    questions = db.relationship('Question', backref='quiz', cascade="all, delete-orphan", lazy=True)
    scores = db.relationship('Score', backref='quiz', cascade="all, delete-orphan", lazy=True)
    tags = db.relationship('QuizTag', backref='quiz', cascade="all, delete-orphan", lazy=True)
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_quizzes')
    
    @property
    def is_scheduled(self):
        """Check if quiz is scheduled with a start time"""
        return self.start_time is not None
    
    @property
    def is_active_now(self):
        """Check if quiz is currently active based on schedule"""
        now = datetime.utcnow()
        if not self.start_time:
            return self.is_active
        return (self.is_active and 
                self.start_time <= now and 
                (not self.end_time or now <= self.end_time))
    
    @property
    def total_marks(self):
        """Calculate total possible marks for this quiz"""
        return sum(q.marks for q in self.questions)
    
    @property
    def avg_score(self):
        """Calculate average score percentage for this quiz"""
        total_marks = self.total_marks
        if total_marks == 0:
            return 0
        
        avg_raw = db.session.query(func.avg(Score.total_scored)).filter(
            Score.quiz_id == self.id).scalar() or 0
        return (avg_raw / total_marks) * 100
    
    @property
    def avg_time(self):
        """Calculate average time spent on this quiz in seconds"""
        return db.session.query(func.avg(Score.time_spent)).filter(
            Score.quiz_id == self.id).scalar() or 0
    
    @property
    def completion_rate(self):
        """Calculate quiz completion rate as percentage"""
        total_attempts = Score.query.filter_by(quiz_id=self.id).count()
        total_users = User.query.filter_by(role="user").count()
        return (total_attempts / total_users * 100) if total_users > 0 else 0
    
    @property
    def passing_rate(self):
        """Calculate percentage of users who passed the quiz"""
        total_attempts = Score.query.filter_by(quiz_id=self.id).count()
        if total_attempts == 0:
            return 0
            
        passed_attempts = Score.query.filter(
            Score.quiz_id == self.id,
            Score.total_scored >= self.passing_score
        ).count()
        
        return (passed_attempts / total_attempts) * 100

class QuizTag(db.Model):
    """Tags for categorizing quizzes"""
    __tablename__ = 'quiz_tags'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    tag = db.Column(db.String(50), nullable=False)
    
    __table_args__ = (db.UniqueConstraint('quiz_id', 'tag', name='_quiz_tag_uc'),)

class QuestionDifficulty(enum.Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"

class QuestionType(enum.Enum):
    SINGLE = "single"
    MULTIPLE = "multiple"
    INTEGER = "integer"
    TRUE_FALSE = "true_false"


class Question(db.Model):
    """Question model for quiz questions"""
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    question_statement = db.Column(db.Text, nullable=False)
    explanation = db.Column(db.Text)  # Explanation of correct answer
    
    # Options
    option1 = db.Column(db.String(200))
    option2 = db.Column(db.String(200))
    option3 = db.Column(db.String(200))
    option4 = db.Column(db.String(200))
    option5 = db.Column(db.String(200))
    option6 = db.Column(db.String(200))
    
    correct_option = db.Column(db.String(200))  # Comma-separated for multiselect
    difficulty = db.Column(db.String(20), default="Medium")
    question_type = db.Column(db.String(20), default="single")
    marks = db.Column(db.Integer, default=1)
    negative_marks = db.Column(db.Float, default=0)  # For negative marking
    is_required = db.Column(db.Boolean, default=True)  # Whether question must be answered
    seq_num = db.Column(db.Integer, default=0)  # For fixed ordering
    
    # Media
    image_path = db.Column(db.String(200))
    audio_path = db.Column(db.String(200))
    video_path = db.Column(db.String(200))
    
    # For matching or ordering questions
    matching_data = db.Column(db.Text)  # JSON string with matching pairs
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    
    # Relationships
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
    
    @property
    def options_list(self):
        return [
            self.option1, self.option2, self.option3,
            self.option4, self.option5
        ]

    def check_answer(self, user_answer):
        """Check if user's answer is correct"""
        if self.question_type == "multiple":
            correct_options = set(self.correct_option.split(","))
            user_options = set(user_answer if isinstance(user_answer, list) else [user_answer])
            return correct_options == user_options
        elif self.question_type =='single':
            return str(user_answer).strip().lower()==self.correct_option.strip().lower()
        elif self.question_type == "integer":
            try:
                return int(user_answer) == int(self.correct_option)
            except (ValueError, TypeError):
                return False
        elif self.question_type == "true_false":
            return str(user_answer).lower() == self.correct_option.lower()
        else:
            return False

class Score(db.Model):
    """Score model for tracking quiz attempts and performance"""
    __tablename__ = 'scores'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Performance metrics
    total_scored = db.Column(db.Float, nullable=False, default=0.0)
    time_spent = db.Column(db.Integer, nullable=False, default=0)  # in seconds
    time_stamp_of_attempt = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    completion_status = db.Column(db.String(20), default='Completed')  # Completed, Partial, Abandoned
    total_questions = db.Column(db.Integer, default=0)
    questions_answered = db.Column(db.Integer, default=0)
    questions_correct = db.Column(db.Integer, default=0)
    percentile = db.Column(db.Float)  # Calculated percentile compared to others
    ip_address = db.Column(db.String(45))  # For security logging
    
    # Attempt metadata
    attempt_number = db.Column(db.Integer, default=1)  # For tracking multiple attempts
    device_info = db.Column(db.String(200))  # User agent or device info
    
    # Relationships
    question_attempts = db.relationship('QuestionAttempt', backref='score', cascade="all, delete-orphan", lazy=True)
    comments = db.relationship('ScoreComment', backref='score', cascade="all, delete-orphan", lazy=True)
    
    __table_args__ = (
        db.UniqueConstraint('quiz_id', 'user_id', 'attempt_number', name='_quiz_user_attempt_uc'),
    )
    
    @property
    def accuracy(self):
        """Calculate accuracy percentage"""
        return (self.questions_correct / self.total_questions * 100) if self.total_questions > 0 else 0
    
    @property
    def pass_fail(self):
        """Determine if user passed or failed the quiz"""
        quiz = Quiz.query.get(self.quiz_id)
        if not quiz:
            return "N/A"
        return "Pass" if self.total_scored >= quiz.passing_score else "Fail"
    
    @property
    def relative_performance(self):
        quiz = Quiz.query.get(self.quiz_id)
        if not quiz:
            return 0
        return (self.total_scored / quiz.total_marks * 100) if quiz.total_marks > 0 else 0

# --- New Model Definitions to resolve the ImportError ---

class QuestionAttempt(db.Model):
    """Tracks each question attempt in a quiz"""
    __tablename__ = 'question_attempts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # Added foreign key to User
    score_id = db.Column(db.Integer, db.ForeignKey('scores.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    user_answer = db.Column(db.Text)
    is_correct = db.Column(db.Boolean, default=False)
    time_spent = db.Column(db.Integer, default=0)  # Time in seconds
    marks_awarded = db.Column(db.Float, default=0.0)


class ScoreComment(db.Model):
    """Model for storing comments on quiz scores."""
    __tablename__ = 'score_comments'
    id = db.Column(db.Integer, primary_key=True)
    score_id = db.Column(db.Integer, db.ForeignKey('scores.id'), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    comment_text = db.Column(db.Text)
    is_private = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserStrength(db.Model):
    __tablename__ = 'user_strengths'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    chapter_id = db.Column(db.Integer, db.ForeignKey('chapters.id'), nullable=True)  # New field, if applicable
    performance_score = db.Column(db.Float, default=0.0)

