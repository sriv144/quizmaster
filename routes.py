import os
import random
from flask import Blueprint, render_template, redirect, url_for, request, session, flash, current_app
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from models import db, User, Subject, Chapter, Quiz, Question, Score
from sqlalchemy import func

app_routes = Blueprint("app_routes", __name__)

# Configuration for image uploads
UPLOAD_FOLDER = "static/uploads"
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

#########################
# COMMON ROUTES
#########################

@app_routes.route("/")
def index():
    return render_template("login.html")

@app_routes.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password")
        user = User.query.filter_by(username=username).first()
        
        if user and user.password == password:
            session['user_id'] = user.id
            session['role'] = user.role
            session['username'] = user.username
            flash("Login successful!", "success")
            
            if user.role == "admin":
                return redirect(url_for("app_routes.admin_dashboard"))
            else:
                return redirect(url_for("app_routes.user_dashboard"))
        else:
            flash("Invalid credentials!", "danger")
    
    return render_template("login.html")

@app_routes.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully.", "info")
    return redirect(url_for("app_routes.login"))

@app_routes.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")
        
        if password != confirm_password:
            flash("Passwords do not match.", "danger")
            return redirect(url_for("app_routes.register"))
        
        if not username.endswith("@gmail.com"):
            flash("Please use a valid Gmail address.", "danger")
            return redirect(url_for("app_routes.register"))
        
        full_name = request.form.get("full_name")
        dob_str = request.form.get("dob")
        contact_no = request.form.get("contact_no", "").strip()
        
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash("Username already exists.", "danger")
            return redirect(url_for("app_routes.register"))
        
        new_user = User(username=username, password=password, full_name=full_name, contact_no=contact_no)
        
        if dob_str:
            try:
                new_user.dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
            except ValueError:
                flash("Invalid date format. Please use YYYY-MM-DD.", "warning")
        
        if request.form.get("is_admin") == "yes":
            new_user.role = "admin"
        else:
            new_user.role = "user"
        
        db.session.add(new_user)
        db.session.commit()
        
        flash("Registration successful! Please log in.", "success")
        return redirect(url_for("app_routes.login"))
    
    return render_template("register.html")

@app_routes.route("/reset_password", methods=["GET", "POST"])
def reset_password():
    if request.method == "POST":
        if not session.get("otp_sent"):
            username = request.form.get("username", "").strip()
            contact_no = request.form.get("contact_no", "").strip()
            
            user = User.query.filter_by(username=username, contact_no=contact_no).first()
            if not user:
                flash("User not found with provided details.", "danger")
                return redirect(url_for("app_routes.reset_password"))
            
            otp = random.randint(1000, 9999)
            session["reset_otp"] = str(otp)
            session["reset_user_id"] = user.id
            session["otp_sent"] = True
            
            flash(f"OTP sent! (Demo OTP: {otp})", "info")
            return redirect(url_for("app_routes.reset_password"))
        else:
            entered_otp = request.form.get("otp", "").strip()
            new_password = request.form.get("new_password")
            confirm_new_password = request.form.get("confirm_new_password")
            
            if new_password != confirm_new_password:
                flash("Passwords do not match.", "danger")
                return redirect(url_for("app_routes.reset_password"))
            
            if entered_otp != session.get("reset_otp"):
                flash("Invalid OTP.", "danger")
                return redirect(url_for("app_routes.reset_password"))
            
            user_id = session.get("reset_user_id")
            user = User.query.get(user_id)
            user.password = new_password
            db.session.commit()
            
            flash("Password has been reset. Please log in.", "success")
            session.pop("reset_otp", None)
            session.pop("reset_user_id", None)
            session.pop("otp_sent", None)
            
            return redirect(url_for("app_routes.login"))
    
    return render_template("reset_password.html")

#########################
# ADMIN-SIDE ROUTES
#########################

@app_routes.route("/admin/dashboard")
def admin_dashboard():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    search_query = request.args.get("search")
    if search_query:
        subjects = Subject.query.filter(Subject.name.ilike(f"%{search_query}%")).all()
    else:
        subjects = Subject.query.all()
    
    return render_template("admin_dashboard.html", subjects=subjects)

@app_routes.route("/admin/quiz_management")
def quiz_management():
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    search_query = request.args.get("search")
    if search_query:
        quizzes = Quiz.query.filter(Quiz.name.ilike(f"%{search_query}%")).all()
    else:
        quizzes = Quiz.query.all()
    
    return render_template("quiz_management.html", quizzes=quizzes)

@app_routes.route("/admin/summary", methods=["GET"])
def admin_summary():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    sort_by = request.args.get("sort_by", "user")
    
    # Base query for the admin summary data
    query = db.session.query(
        Score.id.label("score_id"),
        Score.total_scored,
        Score.time_spent,
        Score.time_stamp_of_attempt,
        User.id.label("user_id"),
        User.username,
        Quiz.id.label("quiz_id"),
        Quiz.name.label("quiz_name"),
        Chapter.id.label("chapter_id"),
        Chapter.name.label("chapter_name"),
        Subject.id.label("subject_id"),
        Subject.name.label("subject_name")
    ).join(User, User.id == Score.user_id
    ).join(Quiz, Quiz.id == Score.quiz_id
    ).join(Chapter, Chapter.id == Quiz.chapter_id
    ).join(Subject, Subject.id == Chapter.subject_id)
    
    # Apply sorting based on the selected criteria
    if sort_by == "subject":
        query = query.order_by(Subject.name)
    elif sort_by == "quiz":
        query = query.order_by(Quiz.name)
    elif sort_by == "score":
        query = query.order_by(Score.total_scored.desc())
    elif sort_by == "time":
        query = query.order_by(Score.time_spent.desc())
    elif sort_by == "completion":
        # Sort by completion status - requires joining with the quiz table again
        query = query.order_by(Score.completion_status, User.username)
    else:
        # Default sort by user
        query = query.order_by(User.username)
    
    results = query.all()
    
    # Calculate statistics for display in the summary cards
    avg_score = db.session.query(func.avg(Score.total_scored)).scalar() or 0
    avg_time = db.session.query(func.avg(Score.time_spent)).scalar() or 0
    quiz_count = Quiz.query.count()
    student_count = User.query.filter_by(role="user").count()
    
    # Prepare chart data for the user performance chart
    user_scores_map = {}
    for row in results:
        uname = row.username
        user_scores_map.setdefault(uname, 0)
        user_scores_map[uname] += row.total_scored
    
    chart_labels = list(user_scores_map.keys())
    chart_data = list(user_scores_map.values())
    
    # Get data for difficult questions analysis
    # Using a subquery to find questions with low success rates
    difficult_questions_data = []
    questions_with_attempts = db.session.query(
        QuestionAttempt.question_id,
        func.count(QuestionAttempt.id).label('total_attempts'),
        func.sum(case((QuestionAttempt.is_correct == True, 1), else_=0)).label('correct_attempts'),
        func.avg(QuestionAttempt.time_spent).label('avg_time')
    ).group_by(QuestionAttempt.question_id).subquery()
    
    difficult_questions = db.session.query(
        Question.id,
        Question.question_statement.label('statement'),
        Quiz.name.label('quiz_name'),
        (100 - (100 * questions_with_attempts.c.correct_attempts / questions_with_attempts.c.total_attempts)).label('incorrect_rate'),
        questions_with_attempts.c.avg_time.label('avg_time_spent')
    ).join(
        questions_with_attempts, Question.id == questions_with_attempts.c.question_id
    ).join(
        Quiz, Question.quiz_id == Quiz.id
    ).filter(
        questions_with_attempts.c.total_attempts > 5  # Only consider questions with sufficient attempts
    ).order_by(
        (100 * questions_with_attempts.c.correct_attempts / questions_with_attempts.c.total_attempts).asc()
    ).limit(10).all()
    
    # Format the difficult questions data for the template
    for q in difficult_questions:
        difficult_questions_data.append({
            'statement': q.statement,
            'quiz_name': q.quiz_name,
            'incorrect_rate': round((q.incorrect_rate or 0), 1),
            'avg_time_spent': round((q.avg_time_spent or 0), 1)
        })
    
    return render_template("admin_summary.html",
                          data=results,
                          sort_by=sort_by,
                          chart_labels=chart_labels,
                          chart_data=chart_data,
                          avg_score=avg_score,
                          avg_time=avg_time/60 if avg_time else 0,  # Convert seconds to minutes
                          quiz_count=quiz_count,
                          student_count=student_count,
                          difficult_questions=difficult_questions_data)

@app_routes.route("/admin/add_subject", methods=["GET", "POST"])
def add_subject():
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    if request.method == "POST":
        subject_name = request.form.get("subject_name")
        description = request.form.get("description")
        
        new_subj = Subject(name=subject_name, description=description)
        db.session.add(new_subj)
        db.session.commit()
        
        flash("Subject added successfully!", "success")
        return redirect(url_for("app_routes.admin_dashboard"))
    
    return render_template("add_subject.html")

@app_routes.route("/admin/add_chapter", methods=["GET", "POST"])
def add_chapter():
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    subject_id_prefill = request.args.get("subject_id")
    subjects = Subject.query.all()
    
    if request.method == "POST":
        chapter_name = request.form.get("chapter_name")
        subject_id = request.form.get("subject_id")
        
        new_chapter = Chapter(name=chapter_name, subject_id=subject_id)
        db.session.add(new_chapter)
        db.session.commit()
        
        flash("Chapter added successfully!", "success")
        return redirect(url_for("app_routes.admin_dashboard"))
    
    return render_template("add_chapter.html", subjects=subjects, subject_id_prefill=subject_id_prefill)

@app_routes.route("/admin/edit_chapter/<int:chapter_id>", methods=["GET", "POST"])
def edit_chapter(chapter_id):
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    chapter = Chapter.query.get_or_404(chapter_id)
    
    if request.method == "POST":
        chapter.name = request.form.get("name")
        db.session.commit()
        
        flash("Chapter updated successfully!", "success")
        return redirect(url_for("app_routes.admin_dashboard"))
    
    return render_template("edit_chapter.html", chapter=chapter)

@app_routes.route("/admin/delete_chapter/<int:chapter_id>", methods=["POST"])
def delete_chapter(chapter_id):
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    chapter = Chapter.query.get_or_404(chapter_id)
    db.session.delete(chapter)
    db.session.commit()
    
    flash("Chapter deleted successfully!", "success")
    return redirect(url_for("app_routes.admin_dashboard"))

@app_routes.route("/admin/add_quiz", methods=["GET", "POST"])
def add_quiz():
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    chapters = Chapter.query.all()
    
    if request.method == "POST":
        chapter_id = request.form.get("chapter_id")
        quiz_name = request.form.get("quiz_name")
        date_of_quiz = request.form.get("date_of_quiz")
        duration_minutes = request.form.get("duration_minutes")  # Duration in minutes
        start_time_str = request.form.get("start_time")
        
        # Compute end_time based on duration if provided
        start_dt = None
        end_dt = None
        
        if start_time_str:
            try:
                # Try DD-MM-YY HH:MM format
                start_dt = datetime.strptime(start_time_str, "%d-%m-%y %H:%M")
                if duration_minutes:
                    end_dt = start_dt + timedelta(minutes=int(duration_minutes))
            except ValueError:
                try:
                    # Alternative format DD-MM-YYYY HH:MM
                    start_dt = datetime.strptime(start_time_str, "%d-%m-%Y %H:%M")
                    if duration_minutes:
                        end_dt = start_dt + timedelta(minutes=int(duration_minutes))
                except ValueError:
                    flash("Invalid start time format. Use DD-MM-YY HH:MM (e.g., 11-03-25 15:40)", "warning")
        
        date_obj = None
        if date_of_quiz:
            try:
                # Try DD-MM-YY format
                date_obj = datetime.strptime(date_of_quiz, "%d-%m-%y").date()
            except ValueError:
                try:
                    # Alternative format DD-MM-YYYY
                    date_obj = datetime.strptime(date_of_quiz, "%d-%m-%Y").date()
                except ValueError:
                    flash("Invalid date format. Use DD-MM-YY (e.g., 11-03-25)", "warning")
        
        new_quiz = Quiz(
            chapter_id=chapter_id,
            name=quiz_name,
            date_of_quiz=date_obj,
            time_duration=duration_minutes,  # store duration as string if needed
            start_time=start_dt,
            end_time=end_dt
        )  # Added closing parenthesis
        
        db.session.add(new_quiz)
        db.session.commit()
        flash("Quiz added successfully!", "success")
        return redirect(url_for("app_routes.admin_dashboard"))
    
    return render_template("add_quiz.html", chapters=chapters)

@app_routes.route("/admin/add_question/<int:quiz_id>", methods=["GET", "POST"])
def add_question(quiz_id):
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    quiz = Quiz.query.get_or_404(quiz_id)
    
    if request.method == "POST":
        action = request.form.get("action")
        # Only process the form data if we're not just closing
        if action != "close":
            question_statement = request.form.get("question_statement")
            option1 = request.form.get("option1")
            option2 = request.form.get("option2")
            option3 = request.form.get("option3")
            option4 = request.form.get("option4")
            difficulty = request.form.get("difficulty") or "Medium"
            question_type = request.form.get("question_type") or "single"
            marks = int(request.form.get("marks", 1))
            
            if question_type == "multiselect":
                selected = request.form.getlist("correct_options")
                correct_option = ",".join(selected)
            else:
                correct_option = request.form.get("correct_options")
            
            image_path = None
            if "image" in request.files:
                file = request.files["image"]
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(UPLOAD_FOLDER, filename)
                    file.save(file_path)
                    image_path = file_path

            new_question = Question(
                quiz_id=quiz.id,
                question_statement=question_statement,
                option1=option1,
                option2=option2,
                option3=option3,
                option4=option4,
                correct_option=correct_option,
                difficulty=difficulty,
                question_type=question_type,
                marks=marks,
                image_path=image_path
            )  # Added closing parenthesis
            
            db.session.add(new_question)
            db.session.commit()
            flash("Question added successfully!", "success")
        
        # Handle redirection based on button clicked
        if action == "save_next":
            return redirect(url_for("app_routes.add_question", quiz_id=quiz.id))
        else: # Handles both "close" and simple "save" scenarios
            return redirect(url_for("app_routes.quiz_management"))
    
    return render_template("add_question.html", quiz=quiz)

@app_routes.route("/admin/edit_question/<int:question_id>", methods=["GET", "POST"])
def edit_question(question_id):
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    question = Question.query.get_or_404(question_id)
    
    if request.method == "POST":
        question_statement = request.form.get("question_statement")
        
        # Validate question statement is not empty
        if not question_statement:
            flash("Question statement cannot be empty!", "danger")
            return render_template("edit_question.html", question=question)
            
        question.question_statement = question_statement
        question.option1 = request.form.get("option1")
        question.option2 = request.form.get("option2")
        question.option3 = request.form.get("option3")
        question.option4 = request.form.get("option4")
        question.difficulty = request.form.get("difficulty") or "Medium"
        question.question_type = request.form.get("question_type") or "single"
        question.marks = int(request.form.get("marks", 1))
        
        # Handle different question types properly
        if question.question_type == "multiselect":
            selected = request.form.getlist("correct_options")
            question.correct_option = ",".join(selected)
        else:
            question.correct_option = request.form.get("correct_options")
        
        # Handle image upload if present
        if "image" in request.files:
            file = request.files["image"]
            if file and file.filename and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file_path = os.path.join(UPLOAD_FOLDER, filename)
                file.save(file_path)
                question.image_path = file_path
        
        db.session.commit()
        flash("Question updated successfully!", "success")
        return redirect(url_for("app_routes.quiz_management"))
    
    return render_template("edit_question.html", question=question)

@app_routes.route("/admin/delete_question/<int:question_id>", methods=["POST"])
def delete_question(question_id):
    if session.get("role") != "admin":
        return redirect(url_for("app_routes.login"))
    
    question = Question.query.get_or_404(question_id)
    db.session.delete(question)
    db.session.commit()
    
    flash("Question deleted successfully!", "success")
    return redirect(url_for("app_routes.quiz_management"))

#########################
# USER-SIDE ROUTES
#########################

@app_routes.route("/user/dashboard", methods=["GET"])
def user_dashboard():
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    now = datetime.now()
    search_query = request.args.get("search")
    
    if search_query:
        quizzes = Quiz.query.filter(Quiz.name.ilike(f"%{search_query}%")).all()
    else:
        quizzes = Quiz.query.all()
    
    user_id = session['user_id']
    quiz_status_list = []
    
    for quiz in quizzes:
        score = Score.query.filter_by(quiz_id=quiz.id, user_id=user_id).first()
        
        if score:
            status = "Completed"
        else:
            if quiz.start_time and now < quiz.start_time:
                status = "Scheduled"
            elif quiz.end_time and now > quiz.end_time:
                status = "Overdue"
            else:
                status = "Available"
        
        quiz_status_list.append({
            'quiz': quiz,
            'status': status
        })
    
    return render_template("user_dashboard.html", quiz_status_list=quiz_status_list)

@app_routes.route("/user/scores")
def user_scores():
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    user_id = session['user_id']
    scores = Score.query.filter_by(user_id=user_id).order_by(Score.time_stamp_of_attempt.desc()).all()
    
    return render_template("user_scores.html", scores=scores)

@app_routes.route("/user/summary")
def user_summary():
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    user_id = session.get('user_id')
    
    # Get user's quiz scores
    user_scores = Score.query.filter_by(user_id=user_id).order_by(Score.time_stamp_of_attempt.asc()).all()
    
    # Initialize data containers for charts and tables
    quiz_labels = []
    quiz_scores = []
    class_avg_scores = []
    quiz_attempts = []
    
    total_correct = 0
    total_questions = 0
    total_time_spent = 0
    
    for score in user_scores:
        quiz = Quiz.query.get(score.quiz_id)
        if not quiz:
            continue
        
        # Add quiz data for the line chart
        quiz_name = quiz.name or f"Quiz #{quiz.id}"
        quiz_labels.append(quiz_name)
        
        # Calculate score percentage
        questions = Question.query.filter_by(quiz_id=quiz.id).all()
        max_possible_score = sum(q.marks for q in questions) if questions else 0
        user_score_percent = (score.total_scored / max_possible_score * 100) if max_possible_score > 0 else 0
        quiz_scores.append(user_score_percent)
        
        # Get class average for comparison
        avg_score_for_quiz = db.session.query(func.avg(Score.total_scored)).filter(
            Score.quiz_id == quiz.id,
            Score.user_id != user_id  # Exclude current user
        ).scalar() or 0
        avg_score_percent = (avg_score_for_quiz / max_possible_score * 100) if max_possible_score > 0 else 0
        class_avg_scores.append(avg_score_percent)
        
        # Get time data
        time_spent_mins = score.time_spent / 60 if score.time_spent else 0
        avg_time_mins = quiz.avg_time / 60 if quiz.avg_time else 0
        
        # Calculate percentile by seeing what percentage of people scored lower
        user_rank = db.session.query(func.count(Score.id)).filter(
            Score.quiz_id == quiz.id,
            Score.total_scored < score.total_scored
        ).scalar() or 0
        total_attempts = db.session.query(func.count(Score.id)).filter(
            Score.quiz_id == quiz.id
        ).scalar() or 1
        percentile = (user_rank / total_attempts * 100) if total_attempts > 0 else 0
        
        # Add data for the detailed attempts table
        quiz_attempts.append({
            'quiz_name': quiz_name,
            'score': user_score_percent,
            'avg_score': avg_score_percent,
            'time_spent': time_spent_mins,
            'avg_time_spent': avg_time_mins,
            'questions_correct': score.questions_correct if hasattr(score, 'questions_correct') else 0,
            'total_questions': score.total_questions if hasattr(score, 'total_questions') else len(questions),
            'percentile': percentile
        })
        
        # Accumulate totals for overall statistics
        total_correct += score.total_scored
        total_questions += max_possible_score
        total_time_spent += score.time_spent if score.time_spent else 0
    
    # Get subject performance data for radar chart
    subject_labels = []
    subject_scores = []
    
    # Get all subjects
    subjects = Subject.query.all()
    for subject in subjects:
        subject_labels.append(subject.name)
        
        # Get all quizzes for this subject through chapters
        subject_chapters = Chapter.query.filter_by(subject_id=subject.id).all()
        chapter_ids = [chapter.id for chapter in subject_chapters]
        
        # Skip if no chapters found
        if not chapter_ids:
            subject_scores.append(0)
            continue
        
        subject_quizzes = Quiz.query.filter(Quiz.chapter_id.in_(chapter_ids)).all()
        quiz_ids = [quiz.id for quiz in subject_quizzes]
        
        # Skip if no quizzes found
        if not quiz_ids:
            subject_scores.append(0)
            continue
        
        # Calculate average score for this subject
        subject_scores_list = Score.query.filter(
            Score.quiz_id.in_(quiz_ids),
            Score.user_id == user_id
        ).all()
        
        if not subject_scores_list:
            subject_scores.append(0)
            continue
        
        # Calculate total scored vs maximum possible
        subject_total_scored = sum(score.total_scored for score in subject_scores_list)
        subject_total_possible = 0
        
        for quiz_id in quiz_ids:
            questions = Question.query.filter_by(quiz_id=quiz_id).all()
            subject_total_possible += sum(q.marks for q in questions)
        
        if subject_total_possible > 0:
            subject_score_percent = (subject_total_scored / subject_total_possible * 100)
        else:
            subject_score_percent = 0
        
        subject_scores.append(subject_score_percent)
    
    # Get timing analysis data
    question_attempts = QuestionAttempt.query.filter_by(user_id=user_id).all()
    total_questions_attempted = len(question_attempts)
    
    avg_time_per_question = 0
    if total_questions_attempted > 0:
        avg_time_per_question = sum(qa.time_spent for qa in question_attempts if qa.time_spent) / total_questions_attempted
    
    # Calculate class average time per question
    class_avg_time_per_question = db.session.query(func.avg(QuestionAttempt.time_spent)).filter(
        QuestionAttempt.user_id != user_id
    ).scalar() or 0
    
    # Find topics that take more/less time
    time_consuming_topics = []
    time_efficient_topics = []
    
    # Group question attempts by chapter to find time trends
    chapter_times = {}
    for qa in question_attempts:
        question = Question.query.get(qa.question_id)
        if not question:
            continue
            
        quiz = Quiz.query.get(question.quiz_id)
        if not quiz:
            continue
            
        chapter = Chapter.query.get(quiz.chapter_id)
        if not chapter:
            continue
            
        chapter_times.setdefault(chapter.id, {'name': chapter.name, 'times': []})
        chapter_times[chapter.id]['times'].append(qa.time_spent if qa.time_spent else 0)
    
    # Calculate average time for each chapter
    chapter_avg_times = []
    for chapter_id, data in chapter_times.items():
        if data['times']:
            avg_time = sum(data['times']) / len(data['times'])
            chapter_avg_times.append({'name': data['name'], 'time': avg_time})
    
    # Sort chapters by time
    chapter_avg_times.sort(key=lambda x: x['time'], reverse=True)
    
    # Get top 3 time-consuming and time-efficient topics
    time_consuming_topics = chapter_avg_times[:3] if len(chapter_avg_times) >= 3 else chapter_avg_times
    time_efficient_topics = chapter_avg_times[-3:][::-1] if len(chapter_avg_times) >= 3 else chapter_avg_times[::-1]
    
    # Get questions the user answered incorrectly for review
    incorrect_questions = []
    
    incorrect_attempts = QuestionAttempt.query.filter_by(
        user_id=user_id, 
        is_correct=False
    ).order_by(QuestionAttempt.attempt_time.desc()).limit(10).all()
    
    for attempt in incorrect_attempts:
        question = Question.query.get(attempt.question_id)
        if not question:
            continue
            
        quiz = Quiz.query.get(question.quiz_id)
        quiz_name = quiz.name if quiz else f"Quiz #{question.quiz_id}"
        
        incorrect_questions.append({
            'id': question.id,
            'quiz_name': quiz_name,
            'question_statement': question.question_statement,
            'user_answer': attempt.user_answer or "No answer provided",
            'correct_answer': question.correct_option,
            'explanation': "The correct answer was " + question.correct_option  # Basic explanation
        })
    
    # Get instructor comments for the user
    comments = []
    user_scores_ids = [score.id for score in user_scores]
    
    if user_scores_ids:
        score_comments = ScoreComment.query.filter(
            ScoreComment.score_id.in_(user_scores_ids)
        ).order_by(ScoreComment.created_at.desc()).all()
        
        for comment in score_comments:
            admin = User.query.get(comment.admin_id)
            score = Score.query.get(comment.score_id)
            
            if not score or not admin:
                continue
                
            quiz = Quiz.query.get(score.quiz_id)
            quiz_name = quiz.name if quiz else f"Quiz #{score.quiz_id}"
            
            comments.append({
                'quiz_name': quiz_name,
                'comment_text': comment.comment_text,
                'admin_name': admin.full_name or admin.username,
                'created_at': comment.created_at
            })
    
    # Calculate overall statistics
    user_avg_score = (total_correct / total_questions * 100) if total_questions > 0 else 0
    user_avg_time = total_time_spent / len(user_scores) / 60 if user_scores else 0  # Convert to minutes
    
    # Get class averages for comparison
    class_avg_score_raw = db.session.query(func.avg(Score.total_scored)).filter(
        Score.user_id != user_id
    ).scalar() or 0
    
    class_avg_time_raw = db.session.query(func.avg(Score.time_spent)).filter(
        Score.user_id != user_id
    ).scalar() or 0
    
    # Calculate percentage for class average
    avg_possible_score = db.session.query(
        func.avg(func.sum(Question.marks))
    ).join(
        Quiz, Question.quiz_id == Quiz.id
    ).group_by(
        Quiz.id
    ).scalar() or 1
    
    class_avg_score = (class_avg_score_raw / avg_possible_score * 100) if avg_possible_score > 0 else 0
    class_avg_time = class_avg_time_raw / 60 if class_avg_time_raw else 0  # Convert to minutes
    
    # Get total available quizzes
    total_quizzes = Quiz.query.count()
    
    return render_template("user_summary.html",
                          quiz_labels=quiz_labels,
                          quiz_scores=quiz_scores,
                          class_avg_scores=class_avg_scores,
                          quiz_attempts=quiz_attempts,
                          subject_labels=subject_labels,
                          subject_scores=subject_scores,
                          user_avg_score=user_avg_score,
                          user_avg_time=user_avg_time,
                          class_avg_score=class_avg_score,
                          class_avg_time=class_avg_time,
                          quiz_count=len(user_scores),
                          total_quizzes=total_quizzes,
                          avg_time_per_question=avg_time_per_question,
                          class_avg_time_per_question=class_avg_time_per_question,
                          time_consuming_topics=time_consuming_topics,
                          time_efficient_topics=time_efficient_topics,
                          incorrect_questions=incorrect_questions,
                          comments=comments)


@app_routes.route("/user/attempt_quiz/<int:quiz_id>", methods=["GET", "POST"])
def attempt_quiz(quiz_id):
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    quiz = Quiz.query.get_or_404(quiz_id)
    now = datetime.now()
    
    # Check if quiz is within scheduled time
    if quiz.start_time and now < quiz.start_time:
        flash("This quiz is not yet available.", "warning")
        return redirect(url_for("app_routes.user_dashboard"))
    if quiz.end_time and now > quiz.end_time:
        flash("This quiz is no longer available.", "warning")
        return redirect(url_for("app_routes.user_dashboard"))
    
    questions = sorted(quiz.questions, key=lambda q: q.id)
    total_pages = len(questions)
    
    if total_pages == 0:
        flash("This quiz has no questions.", "warning")
        return redirect(url_for("app_routes.user_dashboard"))
    
    page = request.args.get("page", 1, type=int)
    key = f"quiz_{quiz.id}_answers"
    
    if key not in session:
        session[key] = {}
    
    if request.method == "POST":
        answer = request.form.getlist("answer")
        session[key][str(questions[page-1].id)] = answer
        session.modified = True
        
        action = request.form.get("action")
        if action == "next" and page < total_pages:
            return redirect(url_for("app_routes.attempt_quiz", quiz_id=quiz.id, page=page+1))
        elif action == "prev" and page > 1:
            return redirect(url_for("app_routes.attempt_quiz", quiz_id=quiz.id, page=page-1))
        elif action == "submit":
            total_score = 0.0
            for q in questions:
                user_answer = session[key].get(str(q.id), [])
                correct_options = set(q.correct_option.split(","))
                selected_options = set(user_answer)
                
                if q.question_type == "multiselect":
                    if len(correct_options) > 0:
                        marks_scored = q.marks * (len(correct_options & selected_options) / len(correct_options))
                    else:
                        marks_scored = 0
                else:
                    marks_scored = q.marks if set(user_answer) == correct_options else 0
                
                total_score += max(marks_scored, 0)
            
            user_id = session.get("user_id")
            new_score = Score(quiz_id=quiz.id, user_id=user_id, total_scored=total_score, time_spent=0)
            db.session.add(new_score)
            db.session.commit()
            
            flash(f"You scored {total_score} out of a maximum of {sum(q.marks for q in questions)}", "success")
            session.pop(key, None)
            return redirect(url_for("app_routes.user_summary"))
    
    current_question = questions[page-1]
    return render_template("attempt_quiz.html", quiz=quiz, question=current_question, page=page, total_pages=total_pages)

@app_routes.route("/quiz_timeout", methods=["POST"])
def quiz_timeout():
    """Handle quiz timeout by redirecting to dashboard with appropriate message"""
    quiz_id = request.form.get("quiz_id")
    flash("Your quiz time has expired.", "warning")
    return redirect(url_for("app_routes.user_dashboard"))

@app_routes.route("/admin/add_score_comment/<int:score_id>", methods=["POST"])
def add_score_comment(score_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    score = Score.query.get_or_404(score_id)
    comment = request.form.get("comment", "").strip()
    
    if comment:
        new_comment = ScoreComment(
            score_id=score_id,
            admin_id=session['user_id'],
            comment_text=comment
        )
        db.session.add(new_comment)
        db.session.commit()
        flash("Comment added successfully!", "success")
    else:
        flash("Comment cannot be empty!", "warning")
    
    return redirect(url_for("app_routes.admin_summary"))

# Add route for viewing attempt details
@app_routes.route("/admin/view_attempt_details/<int:score_id>")
def view_attempt_details(score_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    score = Score.query.get_or_404(score_id)
    user = User.query.get(score.user_id)
    quiz = Quiz.query.get(score.quiz_id)
    
    if not user or not quiz:
        flash("User or quiz not found.", "danger")
        return redirect(url_for("app_routes.admin_summary"))
    
    question_attempts = QuestionAttempt.query.filter_by(score_id=score_id).all()
    question_details = []
    
    for attempt in question_attempts:
        question = Question.query.get(attempt.question_id)
        if not question:
            continue
        
        is_correct = attempt.is_correct
        question_details.append({
            'question': question.question_statement,
            'correct_answer': question.correct_option,
            'user_answer': attempt.user_answer,
            'is_correct': is_correct,
            'time_spent': attempt.time_spent,
            'marks': question.marks
        })
    
    return render_template("attempt_details.html", 
                          score=score,
                          user=user,
                          quiz=quiz,
                          question_details=question_details)