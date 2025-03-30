import os
import random
from flask import Blueprint, render_template, redirect, url_for, request, session, flash, current_app, jsonify
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from models import db, User, Subject, Chapter, Quiz, Question, Score, QuestionAttempt, ScoreComment, UserStrength
from sqlalchemy import func, case
import bleach
from datetime import datetime, timedelta
from sqlalchemy import func
app_routes = Blueprint("app_routes", __name__)

# Configuration for image uploads
UPLOAD_FOLDER = "static/uploads"
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Context processor to inject responsive design elements
@app_routes.context_processor
def inject_responsive_elements():
    is_mobile = request.user_agent.platform in ['android', 'iphone'] or \
                'mobile' in request.user_agent.string.lower()
    
    return {
        'is_mobile': is_mobile,
        'current_year': datetime.now().year
    }  # Fixed: Added missing closing brace

#########################
# COMMON ROUTES
#########################

@app_routes.route("/")
def index():
    return render_template("login.html")  # Login page is default landing page

@app_routes.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        try:
            username = request.form.get("username", "").strip()
            password = request.form.get("password")
            
            user = User.query.filter_by(username=username).first()
            
            if user and user.password == password:
                session['user_id'] = user.id
                session['role'] = user.role
                session['username'] = user.username
                
                # Update last login timestamp
                user.last_login = datetime.now()
                db.session.commit()
                
                flash("Login successful!", "success")
                if user.role == "admin":
                    return redirect(url_for("app_routes.admin_dashboard"))
                else:
                    return redirect(url_for("app_routes.user_dashboard"))
            else:
                flash("Invalid credentials!", "danger")
        except Exception as e:
            flash(f"An error occurred during login: {str(e)}", "danger")
    
    return render_template("login.html")

@app_routes.route("/logout")
def logout():
    try:
        session.clear()
        flash("Logged out successfully.", "info")
    except Exception as e:
        flash(f"Error during logout: {str(e)}", "danger")
    
    return redirect(url_for("app_routes.login"))

@app_routes.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        try:
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
            
            # Sanitize inputs
            full_name = bleach.clean(full_name) if full_name else None
            contact_no = bleach.clean(contact_no) if contact_no else None
            
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
        except Exception as e:
            db.session.rollback()
            flash(f"An error occurred during registration: {str(e)}", "danger")
    
    return render_template("register.html")

@app_routes.route("/reset_password", methods=["GET", "POST"])
def reset_password():
    if request.method == "POST":
        try:
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
        except Exception as e:
            flash(f"An error occurred during password reset: {str(e)}", "danger")
    
    return render_template("reset_password.html")

#########################
# ADMIN-SIDE ROUTES
#########################

@app_routes.route("/admin/dashboard")
def admin_dashboard():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        # Query all subjects
        subjects = Subject.query.all()
        
        total_users = User.query.filter_by(role="user").count()
        total_quizzes = Quiz.query.count()
        total_questions = Question.query.count()
        
        avg_score_query = db.session.query(func.avg(Score.total_scored)).scalar()
        try:
            avg_score = float(avg_score_query) if avg_score_query is not None else 0.0
        except Exception as e:
            avg_score = 0.0
        
        return render_template(
            "admin_dashboard.html", 
            subjects=subjects,
            total_users=total_users,
            total_quizzes=total_quizzes,
            total_questions=total_questions,
            avg_score=avg_score
        )
    except Exception as e:
        flash(f"Error loading dashboard: {str(e)}", "danger")
        return redirect(url_for("app_routes.login"))

from sqlalchemy.orm import joinedload

@app_routes.route("/admin/quiz_management")
def quiz_management():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        # Eager-load subjects with their chapters, quizzes, and quiz questions
        subjects = Subject.query.options(
            joinedload(Subject.chapters)
            .joinedload(Chapter.quizzes)
            .joinedload(Quiz.questions)
        ).all()
        
        return render_template("quiz_management.html", subjects=subjects)
    except Exception as e:
        flash(f"Error loading quiz management: {str(e)}", "danger")
        return redirect(url_for("app_routes.admin_dashboard"))




@app_routes.route("/admin/summary", methods=["GET"])
def admin_summary():
    # Retrieve filter parameters from query string
    username_filter = request.args.get("username_filter")
    quiz_filter = request.args.get("quiz_filter")
    subject_filter = request.args.get("subject_filter")
    date_filter = request.args.get("date_filter")
    sort_by = request.args.get("sort_by", "user")
    
    # Base query for quiz attempts (adjust field names as per your model)
    query = db.session.query(
        Score.id.label("score_id"),
        Score.total_scored,
        Score.time_spent,
        Score.time_stamp_of_attempt,
        Score.completion_status,
        User.id.label("user_id"),
        User.username,
        Quiz.id.label("quiz_id"),
        Quiz.name.label("quiz_name"),
        Subject.id.label("subject_id"),
        Subject.name.label("subject_name")
    ).join(User, User.id == Score.user_id
    ).join(Quiz, Quiz.id == Score.quiz_id
    ).join(Chapter, Chapter.id == Quiz.chapter_id
    ).join(Subject, Subject.id == Chapter.subject_id)
    
    # Apply filters based on parameters
    if username_filter:
        query = query.filter(User.id == username_filter)
    if quiz_filter:
        query = query.filter(Quiz.id == quiz_filter)
    if subject_filter:
        query = query.filter(Subject.id == subject_filter)
    if date_filter:
        today = datetime.now().date()
        if date_filter == "today":
            query = query.filter(func.date(Score.time_stamp_of_attempt) == today)
        elif date_filter == "week":
            week_ago = today - timedelta(days=7)
            query = query.filter(func.date(Score.time_stamp_of_attempt) >= week_ago)
        elif date_filter == "month":
            month_ago = today - timedelta(days=30)
            query = query.filter(func.date(Score.time_stamp_of_attempt) >= month_ago)
    
    # Sorting options
    if sort_by == "user":
        query = query.order_by(User.username)
    elif sort_by == "quiz":
        query = query.order_by(Quiz.name)
    elif sort_by == "subject":
        query = query.order_by(Subject.name)
    elif sort_by == "score":
        query = query.order_by(Score.total_scored.desc())
    elif sort_by == "date" or sort_by == "last_attempt":
        query = query.order_by(Score.time_stamp_of_attempt.desc())
    
    quiz_attempts = query.all()
    
    # Global statistics for graphs view
    avg_score = db.session.query(func.avg(Score.total_scored)).scalar() or 0.0
    avg_time = (db.session.query(func.avg(Score.time_spent)).scalar() or 0.0) / 60
    quiz_count = Quiz.query.count()
    student_count = User.query.filter_by(role="user").count()
    
    # For chart data, aggregate as needed (example below)
    # Aggregate average score per user:
    user_scores = {}
    for a in quiz_attempts:
        user_scores.setdefault(a.username, []).append(a.total_scored)
    chart_labels = list(user_scores.keys())
    chart_data = [sum(scores)/len(scores) for scores in user_scores.values()]
    
    # Similarly, aggregate subject-based data:
    subject_scores = {}
    for a in quiz_attempts:
        subject_scores.setdefault(a.subject_name, []).append(a.total_scored)
    chart_subject_labels = list(subject_scores.keys())
    chart_subject_data = [sum(scores)/len(scores) for scores in subject_scores.values()]
    
    # Completion rates (group by completion status)
    completion_rates = {}
    for a in quiz_attempts:
        status = a.completion_status
        completion_rates[status] = completion_rates.get(status, 0) + 1
    chart_completion_labels = list(completion_rates.keys())
    chart_completion_data = [completion_rates[status] for status in chart_completion_labels]
    
    # Difficulty analysis (assuming you have a QuestionAttempt model to join with)
    difficulties = ["Easy", "Medium", "Hard"]
    diff_stats = {d: {"attempted": 0, "correct": 0} for d in difficulties}
    all_attempts = QuestionAttempt.query.join(Score, QuestionAttempt.score_id == Score.id)\
                        .filter(Score.user_id.isnot(None)).all()
    for at in all_attempts:
        q = Question.query.get(at.question_id)
        if q and q.difficulty in difficulties:
            diff_stats[q.difficulty]["attempted"] += 1
            if at.is_correct:
                diff_stats[q.difficulty]["correct"] += 1
    difficulty_order = difficulties
    attempted_list = [diff_stats[d]["attempted"] for d in difficulties]
    correct_list = [diff_stats[d]["correct"] for d in difficulties]
    
    # For filter dropdowns
    users = User.query.all()
    quizzes = Quiz.query.all()
    subjects = Subject.query.all()
    
    return render_template("admin_summary.html", 
                           quiz_attempts=quiz_attempts,
                           users=users,
                           quizzes=quizzes,
                           subjects=subjects,
                           username_filter=username_filter,
                           quiz_filter=quiz_filter,
                           subject_filter=subject_filter,
                           date_filter=date_filter,
                           sort_by=sort_by,
                           avg_score=avg_score,
                           avg_time=avg_time,
                           quiz_count=quiz_count,
                           student_count=student_count,
                           chart_labels=chart_labels,
                           chart_data=chart_data,
                           chart_subject_labels=chart_subject_labels,
                           chart_subject_data=chart_subject_data,
                           chart_completion_labels=chart_completion_labels,
                           chart_completion_data=chart_completion_data,
                           difficulty_order=difficulty_order,
                           attempted_list=attempted_list,
                           correct_list=correct_list)



@app_routes.route("/admin/add_subject", methods=["GET", "POST"])
def add_subject():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        if request.method == "POST":
            name = request.form.get("name", "").strip()
            description = request.form.get("description", "").strip()
            
            if not name:
                flash("Subject name is required.", "danger")
                return render_template("add_subject.html")
            
            # Sanitize inputs
            name = bleach.clean(name)
            description = bleach.clean(description)
            
            new_subject = Subject(name=name, description=description)
            db.session.add(new_subject)
            db.session.commit()
            
            flash("Subject added successfully!", "success")
            return redirect(url_for("app_routes.admin_dashboard"))
    except Exception as e:
        db.session.rollback()
        flash(f"Error adding subject: {str(e)}", "danger")
    
    return render_template("add_subject.html")

@app_routes.route("/admin/add_chapter", methods=["GET", "POST"])
def add_chapter():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        subject_id_prefill = request.args.get("subject_id")
        subjects = Subject.query.all()
        
        if request.method == "POST":
            subject_id = request.form.get("subject_id")
            name = request.form.get("name", "").strip()
            description = request.form.get("description", "").strip()
            
            if not name or not subject_id:
                flash("Chapter name and subject are required.", "danger")
                return render_template("add_chapter.html", subjects=subjects, subject_id_prefill=subject_id_prefill)
            
            # Sanitize inputs
            name = bleach.clean(name)
            description = bleach.clean(description)
            
            new_chapter = Chapter(name=name, subject_id=subject_id, description=description)
            db.session.add(new_chapter)
            db.session.commit()
            
            flash("Chapter added successfully!", "success")
            return redirect(url_for("app_routes.admin_dashboard"))
    except Exception as e:
        db.session.rollback()
        flash(f"Error adding chapter: {str(e)}", "danger")
    
    return render_template("add_chapter.html", subjects=subjects, subject_id_prefill=subject_id_prefill)

@app_routes.route("/admin/edit_chapter/<int:chapter_id>", methods=["GET", "POST"])  # Fixed: Added URL parameter
def edit_chapter(chapter_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        chapter = Chapter.query.get_or_404(chapter_id)
        subjects = Subject.query.all()
        
        if request.method == "POST":
            subject_id = request.form.get("subject_id")
            name = request.form.get("name", "").strip()
            description = request.form.get("description", "").strip()
            
            if not name or not subject_id:
                flash("Chapter name and subject are required.", "danger")
                return render_template("edit_chapter.html", chapter=chapter, subjects=subjects)
            
            # Sanitize inputs
            name = bleach.clean(name)
            description = bleach.clean(description)
            
            chapter.name = name
            chapter.subject_id = subject_id
            chapter.description = description
            db.session.commit()
            
            flash("Chapter updated successfully!", "success")
            return redirect(url_for("app_routes.admin_dashboard"))
    except Exception as e:
        db.session.rollback()
        flash(f"Error updating chapter: {str(e)}", "danger")
    
    return render_template("edit_chapter.html", chapter=chapter, subjects=subjects)

@app_routes.route("/admin/delete_chapter/<int:chapter_id>", methods=["GET", "POST"])  # Fixed: Added URL parameter and POST method
def delete_chapter(chapter_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        chapter = Chapter.query.get_or_404(chapter_id)
        
        # Check if there are quizzes associated with this chapter
        quizzes = Quiz.query.filter_by(chapter_id=chapter_id).first()
        if quizzes:
            flash("Cannot delete chapter with associated quizzes.", "warning")
            return redirect(url_for("app_routes.admin_dashboard"))
        
        db.session.delete(chapter)
        db.session.commit()
        
        flash("Chapter deleted successfully!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Error deleting chapter: {str(e)}", "danger")
    
    return redirect(url_for("app_routes.admin_dashboard"))

@app_routes.route("/admin/add_quiz", methods=["GET", "POST"])
def add_quiz():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        subjects = Subject.query.all()
        
        if request.method == "POST":
            name = request.form.get("name", "").strip()
            chapter_id = request.form.get("chapter_id")
            
            start_time_str = request.form.get("start_time")
            end_time_str = request.form.get("end_time")
            
            if not name or not chapter_id:
                flash("Quiz name and chapter are required.", "danger")
                return render_template("add_quiz.html", subjects=subjects)
            
            # Sanitize inputs
            name = bleach.clean(name)
            
            # Parse dates if provided
            start_time = None
            end_time = None
            
            if start_time_str:
                try:
                    start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                except ValueError:
                    flash("Invalid start time format.", "warning")
            
            if end_time_str:
                try:
                    end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
                except ValueError:
                    flash("Invalid end time format.", "warning")
            
            # Create quiz
            new_quiz = Quiz(
                name=name,
                chapter_id=chapter_id,
                start_time=start_time,
                end_time=end_time,
                created_by=session.get("user_id")
            )
            
            db.session.add(new_quiz)
            db.session.commit()
            
            flash("Quiz added successfully!", "success")
            return redirect(url_for("app_routes.quiz_management"))
    except Exception as e:
        db.session.rollback()
        flash(f"Error adding quiz: {str(e)}", "danger")
    
    # Get all chapters grouped by subject for the dropdown
    chapters_by_subject = {}
    for subject in subjects:
        chapters_by_subject[subject.id] = Chapter.query.filter_by(subject_id=subject.id).all()
    
    return render_template("add_quiz.html", subjects=subjects, chapters_by_subject=chapters_by_subject)


@app_routes.route("/admin/add_question/<int:quiz_id>", methods=["GET", "POST"])
def add_question(quiz_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))

    try:
        quiz = Quiz.query.get_or_404(quiz_id)
        if request.method == "POST":
            action = request.form.get("action")
            if action != "close":
                question_text = request.form.get("question_text", "").strip()
                difficulty = request.form.get("difficulty", "Medium").strip()
                question_type = request.form.get("question_type", "single").strip()
                marks = request.form.get("marks", "1").strip()
                solution_text = request.form.get("solution_text", "").strip()

                # Sanitize inputs
                question_text = bleach.clean(question_text)
                solution_text = bleach.clean(solution_text)

                if not question_text:
                    flash("Question text is required.", "danger")
                    return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)

                # Validate and convert marks
                try:
                    marks = int(marks)
                except ValueError:
                    flash("Invalid marks value. Please enter a number.", "danger")
                    return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)

                options = []
                correct_option = None

                # Handle different question types
                if question_type == "integer":
                    # Now use the "correct_answer" field from the form
                    correct_answer = request.form.get("correct_answer", "").strip()
                    if not correct_answer:
                        flash("Please enter the correct integer answer.", "danger")
                        return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)
                    try:
                        correct_answer = int(correct_answer)  # Validate conversion
                    except ValueError:
                        flash("Invalid integer answer. Please enter a valid number.", "danger")
                        return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)
                    # Store as string for consistency
                    correct_option = str(correct_answer)

                elif question_type in ["single", "multiselect"]:
                    options = [
                        bleach.clean(request.form.get(f"option{i}", "").strip())
                        for i in range(1, 6)
                        if request.form.get(f"option{i}", "").strip()
                    ]

                    if question_type == "multiselect":
                        correct_options = request.form.getlist("correct_options")
                        if not correct_options:
                            flash("Please select at least one correct option.", "danger")
                            return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)
                        correct_option = ",".join(correct_options)
                    else:
                        correct_option = request.form.get("correct_option", "").strip()
                        if not correct_option:
                            flash("Please select the correct option.", "danger")
                            return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)

                image_path = None
                if "image" in request.files:
                    file = request.files["image"]
                    if file and file.filename and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        file_path = os.path.join(UPLOAD_FOLDER, filename)
                        file.save(file_path)
                        image_path = os.path.join("uploads", filename)

                new_question = Question(
                    quiz_id=quiz_id,
                    question_statement=question_text,
                    option1=options[0] if len(options) > 0 else None,
                    option2=options[1] if len(options) > 1 else None,
                    option3=options[2] if len(options) > 2 else None,
                    option4=options[3] if len(options) > 3 else None,
                    option5=options[4] if len(options) > 4 else None,
                    correct_option=correct_option,  # Already stored as a string
                    difficulty=difficulty,
                    question_type=question_type,
                    marks=marks,
                    image_path=image_path,
                    explanation=solution_text
                )

                db.session.add(new_question)
                db.session.commit()

                flash("Question added successfully!", "success")
                if action == "save_next":
                    return redirect(url_for("app_routes.add_question", quiz_id=quiz_id))
                else:
                    return redirect(url_for("app_routes.quiz_management"))
            else:
                return redirect(url_for("app_routes.quiz_management"))

        return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)
    except Exception as e:
        db.session.rollback()
        flash(f"Error adding question: {str(e)}", "danger")
        return render_template("add_question.html", quiz=quiz, quiz_id=quiz_id)



@app_routes.route("/admin/edit_quiz/<int:quiz_id>", methods=["GET", "POST"])
def edit_quiz(quiz_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    quiz = Quiz.query.get_or_404(quiz_id)
    
    if request.method == "POST":
        quiz.name = request.form.get("name", "").strip()
        
        # Get the start_time and end_time strings from the form
        start_time_str = request.form.get("start_time")
        end_time_str = request.form.get("end_time")
        
        # Convert the string values to datetime objects
        if start_time_str:
            try:
                quiz.start_time = datetime.fromisoformat(start_time_str)
            except ValueError:
                flash("Invalid start time format. Please try again.", "warning")
        else:
            quiz.start_time = None

        if end_time_str:
            try:
                quiz.end_time = datetime.fromisoformat(end_time_str)
            except ValueError:
                flash("Invalid end time format. Please try again.", "warning")
        else:
            quiz.end_time = None

        db.session.commit()
        flash("Quiz updated successfully!", "success")
        return redirect(url_for("app_routes.quiz_management"))
    
    return render_template("edit_quiz.html", quiz=quiz)



@app_routes.route("/admin/delete_quiz/<int:quiz_id>", methods=["POST"])
def delete_quiz(quiz_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))

    quiz = Quiz.query.get_or_404(quiz_id)  # Fetch quiz or return 404

    # Delete the quiz
    db.session.delete(quiz)
    db.session.commit()
    
    flash("Quiz deleted successfully!", "success")
    return redirect(url_for("app_routes.quiz_management"))


@app_routes.route("/admin/edit_question/<int:question_id>", methods=["GET", "POST"])  # Fixed: Added URL parameter
def edit_question(question_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        question = Question.query.get_or_404(question_id)
        
        if request.method == "POST":
            question_statement = request.form.get("question_statement", "").strip()
            option1 = request.form.get("option1", "").strip()
            option2 = request.form.get("option2", "").strip()
            option3 = request.form.get("option3", "").strip()
            option4 = request.form.get("option4", "").strip()
            difficulty = request.form.get("difficulty") or "Medium"
            question_type = request.form.get("question_type") or "single"
            marks = int(request.form.get("marks", 1))
            explanation = request.form.get("explanation", "").strip()
            
            if not question_statement or not option1 or not option2:
                flash("Question and at least two options are required.", "danger")
                return render_template("edit_question.html", question=question)
            
            # Sanitize inputs
            question_statement = bleach.clean(question_statement)
            option1 = bleach.clean(option1)
            option2 = bleach.clean(option2)
            option3 = bleach.clean(option3)
            option4 = bleach.clean(option4)
            explanation = bleach.clean(explanation)
            
            question.question_statement = question_statement
            question.option1 = option1
            question.option2 = option2
            question.option3 = option3
            question.option4 = option4
            question.difficulty = difficulty
            question.question_type = question_type
            question.marks = marks
            question.explanation = explanation
            
            # Handle different question types properly
            if question_type == "multiselect":
                selected = request.form.getlist("correct_options")
                if not selected:
                    flash("Please select at least one correct option", "danger")
                    return render_template("edit_question.html", question=question)
                question.correct_option = ",".join(selected)
            else:
                correct_option = request.form.get("correct_options")
                if not correct_option:
                    flash("Please select the correct option", "danger")
                    return render_template("edit_question.html", question=question)
                question.correct_option = correct_option
            
            # Handle image upload if present
            if "image" in request.files:
                file = request.files["image"]
                if file and file.filename and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(UPLOAD_FOLDER, filename)
                    file.save(file_path)
                    question.image_path = os.path.join("uploads", filename)  # Store relative path
            
            db.session.commit()
            
            flash("Question updated successfully!", "success")
            return redirect(url_for("app_routes.quiz_management"))
    except Exception as e:
        db.session.rollback()
        flash(f"Error updating question: {str(e)}", "danger")
    
    return render_template("edit_question.html", question=question)

@app_routes.route("/admin/delete_question/<int:question_id>", methods=["GET", "POST"])  # Fixed: Added URL parameter and POST method
def delete_question(question_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        question = Question.query.get_or_404(question_id)
        quiz_id = question.quiz_id
        
        # Check if the question has been used in any attempts
        has_attempts = db.session.query(QuestionAttempt).filter_by(question_id=question_id).first() is not None
        
        if has_attempts:
            flash("Cannot delete question as it has already been used in quiz attempts.", "warning")
            return redirect(url_for("app_routes.quiz_management"))
        
        db.session.delete(question)
        db.session.commit()
        
        flash("Question deleted successfully!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Error deleting question: {str(e)}", "danger")
    
    return redirect(url_for("app_routes.quiz_management"))

@app_routes.route("/admin/view_users")
def view_users():
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    user_id = request.args.get("user_id")
    if user_id:
        user = User.query.get(user_id)
        if not user:
            flash("User not found.", "danger")
            return redirect(url_for("app_routes.view_users"))
        # Get all quiz attempts for the given user
        attempts = Score.query.filter_by(user_id=user_id).order_by(Score.time_stamp_of_attempt.desc()).all()
        # For each attempt, calculate percentage and max possible score
        detailed_attempts = []
        for attempt in attempts:
            quiz = Quiz.query.get(attempt.quiz_id)
            if not quiz:
                continue
            questions = Question.query.filter_by(quiz_id=quiz.id).all()
            max_score = sum(q.marks for q in questions) if questions else 0
            percentage = (attempt.total_scored / max_score * 100) if max_score > 0 else 0
            detailed_attempts.append({
                'quiz_name': quiz.name,
                'score': attempt.total_scored,
                'max_score': max_score,
                'percentage': percentage,
                'time_spent': round(attempt.time_spent / 60, 1) if attempt.time_spent else 0,  # in minutes
                'date': attempt.time_stamp_of_attempt,
                'score_id': attempt.id
            })
        return render_template("view_users.html", user=user, attempts=detailed_attempts)
    else:
        # No user selected, display list of all users.
        users = User.query.all()
        return render_template("view_users.html", users=users)


@app_routes.route("/admin/add_score_comment_form/<int:score_id>", methods=["GET"])
def add_score_comment_form(score_id):
    """Render the feedback form for a given quiz attempt."""
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))

    score = Score.query.get_or_404(score_id)
    return render_template("add_score_comment.html", score=score)

@app_routes.route("/admin/add_score_comment/<int:score_id>", methods=["GET", "POST"])
def add_score_comment(score_id):
    """
    Handle feedback submission.
    - GET requests redirect to the feedback form.
    - POST requests process the submitted feedback.
    """
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    # If a GET request is made to the POST route, redirect to the form.
    if request.method == "GET":
        return redirect(url_for("app_routes.add_score_comment_form", score_id=score_id))
    
    try:
        score = Score.query.get_or_404(score_id)
        comment_text = request.form.get("comment_text", "").strip()
        is_private = request.form.get("is_private") == "1"

        if not comment_text:
            flash("Comment cannot be empty.", "danger")
            return redirect(url_for("app_routes.add_score_comment_form", score_id=score.id))

        # Sanitize input to prevent XSS
        comment_text = bleach.clean(comment_text)

        new_comment = ScoreComment(
            score_id=score.id,
            admin_id=session.get("user_id"),
            comment_text=comment_text,
            is_private=is_private,
            created_at=datetime.now()
        )

        db.session.add(new_comment)
        db.session.commit()

        flash("Comment added successfully.", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Error adding comment: {str(e)}", "danger")

    return redirect(url_for("app_routes.add_score_comment_form", score_id=score.id))


@app_routes.route("/admin/view_attempt_details/<int:score_id>")
def admin_view_attempt_details(score_id):
    if session.get("role") != "admin":
        flash("Access denied! Admins only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        score = Score.query.get_or_404(score_id)
        user = User.query.get(score.user_id)
        quiz = Quiz.query.get(score.quiz_id)
        
        # Collect attempt details along with question and option texts.
        attempt_details = []
        attempts = QuestionAttempt.query.filter_by(score_id=score.id).all()
        for attempt in attempts:
            question = Question.query.get(attempt.question_id)
            if question:
                attempt_details.append({
                    'question': question,
                    'user_answer': attempt.user_answer,
                    'is_correct': attempt.is_correct,
                    'time_spent': attempt.time_spent,
                    'marks': question.marks,
                    'marks_awarded': attempt.marks_awarded,
                    'option1': question.option1,
                    'option2': question.option2,
                    'option3': question.option3,
                    'option4': question.option4,
                    'option5': question.option5,
                    'option6': question.option6
                })
        
        # Get instructor feedback comments
        score_comments = ScoreComment.query.filter_by(score_id=score.id)\
                             .order_by(ScoreComment.created_at.desc()).all()

        return render_template("view_attempt_details.html",
                               score=score,
                               user=user,
                               quiz=quiz,
                               attempt_details=attempt_details,
                               score_comments=score_comments)
    except Exception as e:
        flash(f"Error loading attempt details: {str(e)}", "danger")
        return redirect(url_for("app_routes.admin_summary"))



#########################
# USER-SIDE ROUTES
#########################

@app_routes.route("/user/dashboard", methods=["GET"])
def user_dashboard():
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        now = datetime.now()
        search_query = request.args.get("search")
        
        if search_query:
            quizzes = Quiz.query.filter(Quiz.name.ilike(f"%{search_query}%")).all()
        else:
            quizzes = Quiz.query.all()
        
        user_id = session['user_id']
        quiz_status_list = []
        completed_count = 0
        available_count = 0
        
        for quiz in quizzes:
            score = Score.query.filter_by(quiz_id=quiz.id, user_id=user_id).first()
            if score:
                status = "Completed"
                completed_count += 1
            else:
                if quiz.start_time and now < quiz.start_time:
                    status = "Scheduled"
                elif quiz.end_time and now > quiz.end_time:
                    status = "Overdue"
                else:
                    status = "Available"
                    available_count += 1
            
            quiz_status_list.append({
                'quiz': quiz,
                'status': status
            })
        
        # Calculate average score - ensure it's always a float that can be rounded
        avg_score_query = db.session.query(func.avg(Score.total_scored)).filter_by(user_id=user_id).scalar()
        try:
            avg_score = float(avg_score_query) if avg_score_query is not None else 0.0
        except (TypeError, ValueError):
            avg_score = 0.0
        
        return render_template("user_dashboard.html", 
            quiz_status_list=quiz_status_list,
            completed_count=completed_count,
            available_count=available_count,
            avg_score=avg_score
        )
    except Exception as e:
        flash(f"Error loading dashboard: {str(e)}", "danger")
        return redirect(url_for("app_routes.login"))

@app_routes.route("/user/scores")
def user_scores():
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        user_id = session.get('user_id')
        
        # Get all scores for the current user
        user_scores = Score.query.filter_by(user_id=user_id).order_by(Score.time_stamp_of_attempt.desc()).all()
        
        scores = []
        for score in user_scores:
            quiz = Quiz.query.get(score.quiz_id)
            if not quiz:
                continue
            
            # Calculate score percentage
            questions = Question.query.filter_by(quiz_id=quiz.id).all()
            max_possible_score = sum(q.marks for q in questions) if questions else 0
            score_percentage = (score.total_scored / max_possible_score * 100) if max_possible_score > 0 else 0
            
            # Add data for display
            scores.append({
                'quiz_name': quiz.name,
                'quiz_id': quiz.id,
                'score': score.total_scored,
                'max_score': max_possible_score,
                'percentage': score_percentage,
                'time_spent': score.time_spent / 60 if score.time_spent else 0,  # Convert to minutes
                'date': score.time_stamp_of_attempt,
                'score_id': score.id
            })
        
        return render_template("user_scores.html", scores=scores)
    except Exception as e:
        flash(f"Error loading scores: {str(e)}", "danger")
        return redirect(url_for("app_routes.user_dashboard"))

@app_routes.route("/user/summary")
def user_summary():
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        user_id = session.get("user_id")
        user = User.query.get(user_id)
        user_scores = Score.query.filter_by(user_id=user_id).all()
        
        # 1) Stat Cards Data
        quiz_ids = {score.quiz_id for score in user_scores}
        total_quizzes = len(quiz_ids)
        average_score = user.average_score if user_scores else 0.0
        total_questions_attempted = sum(s.questions_answered for s in user_scores)
        total_correct = sum(s.questions_correct for s in user_scores)
        overall_accuracy = (total_correct / total_questions_attempted * 100) if total_questions_attempted > 0 else 0.0

        # 2) Performance Over Time Data (Line Chart)
        score_timeline = []
        for s in user_scores:
            score_timeline.append({
                "date": s.time_stamp_of_attempt.strftime("%Y-%m-%d"),
                "score": s.accuracy  # assuming Score.accuracy returns a number between 0 and 100
            })
        # If empty, provide a sample point so the chart renders
        if not score_timeline:
            score_timeline = [{"date": "2025-01-01", "score": 0}]

        # 3) Time Spent per Quiz Data (Bar Chart)
        time_spent_data = []
        for s in user_scores:
            quiz_obj = Quiz.query.get(s.quiz_id)
            if quiz_obj:
                minutes_spent = round(s.time_spent / 60, 1)
                time_spent_data.append({
                    "quiz_name": quiz_obj.name,
                    "time_spent": minutes_spent
                })
        if not time_spent_data:
            time_spent_data = [{"quiz_name": "Sample Quiz", "time_spent": 0}]

        # 4) Difficulty Level Analysis Data (Grouped Bar Chart)
        difficulties = ["Easy", "Medium", "Hard"]
        diff_stats = {d: {"attempted": 0, "correct": 0} for d in difficulties}
        all_attempts = (QuestionAttempt.query
                        .join(Score, QuestionAttempt.score_id == Score.id)
                        .filter(Score.user_id == user_id)
                        .all())
        for attempt in all_attempts:
            question = Question.query.get(attempt.question_id)
            if question and question.difficulty in difficulties:
                diff_stats[question.difficulty]["attempted"] += 1
                if attempt.is_correct:
                    diff_stats[question.difficulty]["correct"] += 1
        difficulty_order = difficulties
        attempted_list = [diff_stats[d]["attempted"] for d in difficulties]
        correct_list = [diff_stats[d]["correct"] for d in difficulties]

        # Pass all variables to template
        return render_template(
            "user_summary.html",
            total_quizzes=total_quizzes,
            average_score=average_score,
            total_questions_attempted=total_questions_attempted,
            total_correct=total_correct,
            overall_accuracy=overall_accuracy,
            score_timeline=score_timeline,
            time_spent_data=time_spent_data,
            difficulty_order=difficulty_order,
            attempted_list=attempted_list,
            correct_list=correct_list
        )
    except Exception as e:
        flash(f"Error loading summary: {str(e)}", "danger")
        return redirect(url_for("app_routes.user_dashboard"))


@app_routes.route("/user/attempt_quiz/<int:quiz_id>", methods=["GET", "POST"])
def attempt_quiz(quiz_id):
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        quiz = Quiz.query.get_or_404(quiz_id)
        now = datetime.now()
        
        if quiz.start_time and now < quiz.start_time:
            flash("This quiz is not yet available.", "warning")
            return redirect(url_for("app_routes.user_dashboard"))
        
        if quiz.end_time and now > quiz.end_time:
            flash("This quiz is no longer available.", "warning")
            return redirect(url_for("app_routes.user_dashboard"))
        
        user_id = session.get('user_id')
        existing_score = Score.query.filter_by(quiz_id=quiz_id, user_id=user_id).first()
        
        if existing_score:
            flash("You have already taken this quiz.", "info")
            return redirect(url_for("app_routes.view_attempt_details", quiz_id=quiz_id))
        
        questions = Question.query.filter_by(quiz_id=quiz_id).all()
        
        if not questions:
            flash("This quiz has no questions.", "warning")
            return redirect(url_for("app_routes.user_dashboard"))
        
        time_duration = quiz.time_duration or 0
        end_time = datetime.now() + timedelta(minutes=time_duration)
        
        return render_template("attempt_quiz.html", quiz=quiz, questions=questions, end_time=end_time)
    except Exception as e:
        flash(f"Error loading quiz: {str(e)}", "danger")
        return redirect(url_for("app_routes.user_dashboard"))
    

def search_quizzes():
    if session.get("role") != "user":
        return jsonify({'error': 'Access denied'}), 403
    try:
        search_term = request.args.get('term', '')
        subject_filter = request.args.get('subject', '')
        date_filter = request.args.get('date', '')
        
        query = db.session.query(Quiz.name, Quiz.id)
        
        if search_term:
            query = query.filter(Quiz.name.ilike(f'%{search_term}%'))
        
        if subject_filter:
            query = query.join(Chapter).join(Subject).filter(Subject.id == subject_filter)
        
        if date_filter:
            today = datetime.now().date()
            if date_filter == 'week':
                start_date = today - timedelta(days=7)
            elif date_filter == 'month':
                start_date = today - timedelta(days=30)
            elif date_filter == 'quarter':
                start_date = today - timedelta(days=90)
            else:
                start_date = None
            
            if start_date:
                query = query.filter(Quiz.created_at >= start_date)
        
        results = query.limit(10).all()
        return jsonify([{'id': r.id, 'name': r.name} for r in results])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app_routes.route("/user/submit_quiz/<int:quiz_id>", methods=["POST"])
def submit_quiz(quiz_id):
    def get_option_text(question, token):
        """
        Given a token (which may be a digit or 'optionX'), return the corresponding option text.
        """
        token = token.strip()
        if token.isdigit() or (token.lower().startswith("option") and token[6:].isdigit()):
            if token.lower().startswith("option"):
                index = token[6:]
            else:
                index = token
            if index == "1":
                return question.option1 or ""
            elif index == "2":
                return question.option2 or ""
            elif index == "3":
                return question.option3 or ""
            elif index == "4":
                return question.option4 or ""
            elif index == "5":
                return question.option5 or ""
            else:
                return token
        else:
            return token

    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        quiz = Quiz.query.get_or_404(quiz_id)
        user_id = session.get("user_id")
        now = datetime.now()
        
        # Check if user already took this quiz
        existing_score = Score.query.filter_by(quiz_id=quiz_id, user_id=user_id).first()
        if existing_score:
            flash("You have already taken this quiz.", "info")
            return redirect(url_for("app_routes.view_attempt_details", quiz_id=quiz_id))
        
        # Build dictionary of time spent per question
        times = {}
        for key, value in request.form.items():
            if key.startswith("times["):
                qid = key[6:-1]
                try:
                    times[qid] = int(value)
                except ValueError:
                    times[qid] = 0
        
        total_time_from_form = int(request.form.get("total_time", 0))
        
        total_score = 0
        questions_correct = 0
        questions_answered = 0
        computed_total_time = 0
        
        # Create new score record
        new_score = Score(
            quiz_id=quiz_id,
            user_id=user_id,
            time_spent=0,  # to be updated later
            time_stamp_of_attempt=now,
            completion_status="Completed"
        )
        db.session.add(new_score)
        db.session.commit()  # Generate new_score.id
        
        questions = Question.query.filter_by(quiz_id=quiz_id).all()
        for question in questions:
            qid_str = str(question.id)
            is_correct = False
            marks_awarded = 0
            
            if question.question_type.lower() == "multiselect":
                selected_options = request.form.getlist(f"answers[{question.id}]")
                if selected_options:
                    questions_answered += 1
                    computed_total_time += times.get(qid_str, 0)
                    
                    # Debug: show what tokens are stored
                    stored_tokens = [token.strip() for token in question.correct_option.split(",") if token.strip()]
                    # Convert each token into its option text
                    correct_options = set(get_option_text(question, token).strip().lower() for token in stored_tokens)
                    # Also normalize the user's selected answers
                    selected_set = set(opt.strip().lower() for opt in selected_options)
                    
                    current_app.logger.info(
                        f"[Multiselect] QID {question.id}: stored_tokens={stored_tokens}, correct_options={correct_options}, selected_set={selected_set}"
                    )
                    
                    if correct_options == selected_set:
                        is_correct = True
                        marks_awarded = question.marks
                    else:
                        # Award partial marks: proportional to the number of correctly selected options.
                        if correct_options:
                            common = len(correct_options & selected_set)
                            marks_awarded = question.marks * (common / len(correct_options))
            else:
                # For integer and single-choice (MCQ) questions
                user_answer = request.form.get(f"answers[{question.id}]", "").strip()
                if user_answer:
                    questions_answered += 1
                    computed_total_time += times.get(qid_str, 0)
                    
                    # Determine correct answer text (same logic as before)
                    correct_text = ""
                    stored_value = question.correct_option.strip()
                    if stored_value.isdigit() or (stored_value.lower().startswith("option") and stored_value[6:].isdigit()):
                        if stored_value.lower().startswith("option"):
                            index = stored_value[6:]
                        else:
                            index = stored_value
                        if index == "1":
                            correct_text = question.option1 or ""
                        elif index == "2":
                            correct_text = question.option2 or ""
                        elif index == "3":
                            correct_text = question.option3 or ""
                        elif index == "4":
                            correct_text = question.option4 or ""
                        elif index == "5":
                            correct_text = question.option5 or ""
                        else:
                            correct_text = stored_value
                    else:
                        correct_text = stored_value
                    
                    current_app.logger.info(
                        f"[MCQ] QID {question.id}: user_answer='{user_answer}', correct_text='{correct_text}'"
                    )
                    
                    if user_answer.lower() == correct_text.strip().lower():
                        is_correct = True
                        marks_awarded = question.marks
                    else:
                        is_correct = False
                        marks_awarded = 0
            
            total_score += marks_awarded
            if is_correct:
                questions_correct += 1
            
            # Record each question attempt
            if questions_answered > 0:
                attempt = QuestionAttempt(
                    score_id=new_score.id,
                    question_id=question.id,
                    user_id=user_id,
                    user_answer=(
                        ", ".join(request.form.getlist(f"answers[{question.id}]"))
                        if question.question_type.lower() == "multiselect"
                        else request.form.get(f"answers[{question.id}]", "").strip()
                    ),
                    is_correct=is_correct,
                    marks_awarded=marks_awarded,
                    time_spent=times.get(qid_str, 0)
                )
                db.session.add(attempt)
        
        final_total_time = total_time_from_form if total_time_from_form > 0 else computed_total_time
        
        new_score.total_scored = total_score
        new_score.questions_correct = questions_correct
        new_score.questions_answered = questions_answered
        new_score.total_questions = len(questions)
        new_score.time_spent = final_total_time
        
        db.session.commit()
        
        flash(f"Quiz submitted successfully! You scored {total_score:.1f} points.", "success")
        return redirect(url_for("app_routes.quiz_results", score_id=new_score.id))
    except Exception as e:
        db.session.rollback()
        flash(f"Error submitting quiz: {str(e)}", "danger")
        return redirect(url_for("app_routes.user_dashboard"))



@app_routes.route("/user/quiz_results/<int:score_id>")
def quiz_results(score_id):
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        score = Score.query.get_or_404(score_id)
        
        # Verify the score belongs to the logged-in user
        if score.user_id != session.get("user_id"):
            flash("Access denied! You can only view your own results.", "danger")
            return redirect(url_for("app_routes.user_dashboard"))
        
        quiz = Quiz.query.get(score.quiz_id)
        
        # Calculate performance metrics
        questions = Question.query.filter_by(quiz_id=quiz.id).all()
        total_marks = sum(q.marks for q in questions)
        score_percentage = (score.total_scored / total_marks * 100) if total_marks > 0 else 0
        
        # Get class average for comparison
        avg_score = db.session.query(func.avg(Score.total_scored)).filter(
            Score.quiz_id == quiz.id,
            Score.user_id != score.user_id
        ).scalar() or 0
        avg_percentage = (avg_score / total_marks * 100) if total_marks > 0 else 0
        
        # Get question attempts
        attempts = QuestionAttempt.query.filter_by(score_id=score.id).all()

        # Additional Time Analysis:
        avg_time_per_question = score.time_spent / score.total_questions if score.total_questions > 0 else 0
        times = [a.time_spent for a in attempts if a.time_spent]
        min_time = min(times) if times else 0
        max_time = max(times) if times else 0

        return render_template("quiz_results.html",
            score=score,
            quiz=quiz,
            score_percentage=score_percentage,
            avg_percentage=avg_percentage,
            attempts=attempts,
            avg_time_per_question=avg_time_per_question,
            min_time=min_time,
            max_time=max_time
        )
    except Exception as e:
        flash(f"Error loading quiz results: {str(e)}", "danger")
        return redirect(url_for("app_routes.user_dashboard"))



@app_routes.route("/user/view_attempt_details/<int:quiz_id>")
def view_attempt_details(quiz_id):
    if session.get("role") != "user":
        flash("Access denied! Users only.", "danger")
        return redirect(url_for("app_routes.login"))
    
    try:
        user_id = session.get("user_id")
        score = Score.query.filter_by(quiz_id=quiz_id, user_id=user_id).first()
        
        if not score:
            flash("You haven't attempted this quiz yet.", "info")
            return redirect(url_for("app_routes.user_dashboard"))
        
        quiz = Quiz.query.get_or_404(quiz_id)
        user = User.query.get(user_id)
        
        attempt_details = []
        attempts = QuestionAttempt.query.filter_by(score_id=score.id).all()
        for attempt in attempts:
            question = Question.query.get(attempt.question_id)
            if question:
                attempt_details.append({
                    'question': question,
                    'user_answer': attempt.user_answer,
                    'is_correct': attempt.is_correct,
                    'time_spent': attempt.time_spent,
                    'marks': question.marks,
                    'marks_awarded': attempt.marks_awarded
                })
        
        average_times = db.session.query(
            Question.difficulty,
            func.avg(QuestionAttempt.time_spent).label('avg_time')
        ).join(QuestionAttempt, Question.id == QuestionAttempt.question_id
        ).filter(QuestionAttempt.score_id == score.id
        ).group_by(Question.difficulty
        ).all()
        
        difficulty_order = ['Easy', 'Medium', 'Hard']
        average_times = sorted(
            average_times,
            key=lambda x: difficulty_order.index(x.difficulty) if x.difficulty in difficulty_order else 999
        )
        
        score_comments = ScoreComment.query.filter_by(
            score_id=score.id,
            is_private=False
        ).order_by(ScoreComment.created_at.desc()).all()
        
        return render_template(
            "view_attempt_details.html",
            score=score,
            user=user,
            quiz=quiz,
            attempt_details=attempt_details,
            average_times=average_times,
            score_comments=score_comments
        )
    except Exception as e:
        flash(f"Error loading attempt details: {str(e)}", "danger")
        return redirect(url_for("app_routes.user_dashboard"))

#########################
# API ROUTES (for AJAX)
#########################

@app_routes.route("/api/chapters/<int:subject_id>")  # Fixed: Added URL parameter
def get_chapters(subject_id):
    try:
        chapters = Chapter.query.filter_by(subject_id=subject_id).all()
        return jsonify([{
            'id': chapter.id,
            'name': chapter.name
        } for chapter in chapters])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app_routes.route("/api/quiz_timeout", methods=["POST"])
def quiz_timeout():
    """Handle quiz timeout via AJAX"""
    if session.get("role") != "user":
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        data = request.json
        quiz_id = data.get('quiz_id')
        answers = data.get('answers', {})
        total_time = data.get('total_time', 0)
        
        if not quiz_id:
            return jsonify({'error': 'Missing quiz ID'}), 400
        
        quiz = Quiz.query.get_or_404(quiz_id)
        user_id = session.get('user_id')
        
        # Calculate partial score from answered questions
        questions = Question.query.filter_by(quiz_id=quiz_id).all()
        total_score = 0
        questions_correct = 0
        questions_answered = len(answers)
        
        # Create a new score record
        new_score = Score(
            quiz_id=quiz_id,
            user_id=user_id,
            time_spent=total_time,
            time_stamp_of_attempt=datetime.now(),
            completion_status='Timed Out'
        )
        
        db.session.add(new_score)
        db.session.commit()
        
        # Process answered questions
        for question in questions:
            q_id = str(question.id)
            if q_id in answers and answers[q_id]:
                user_answer = answers[q_id]
                
                # Check if the answer is correct
                is_correct = False
                marks_awarded = 0
                
                if question.question_type == 'multiselect':
                    correct_options = set(question.correct_option.split(','))
                    selected_options = set(user_answer.split(','))
                    
                    if correct_options == selected_options:
                        is_correct = True
                        marks_awarded = question.marks
                    else:
                        if correct_options:
                            common = len(correct_options & selected_options)
                            total = len(correct_options)
                            marks_awarded = question.marks * (common / total)
                else:
                    is_correct = user_answer == question.correct_option
                    marks_awarded = question.marks if is_correct else 0
                
                if is_correct:
                    questions_correct += 1
                
                total_score += marks_awarded
                
                # Record the question attempt
                attempt = QuestionAttempt(
                    score_id=new_score.id,
                    question_id=question.id,
                    user_id=user_id,
                    user_answer=user_answer,
                    is_correct=is_correct,
                    marks_awarded=marks_awarded,
                    attempt_time=datetime.now()
                )
                
                db.session.add(attempt)
        
        # Update the score with calculated values
        new_score.total_scored = total_score
        new_score.questions_correct = questions_correct
        new_score.questions_answered = questions_answered
        new_score.total_questions = len(questions)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Quiz timeout handled successfully',
            'redirect': url_for('app_routes.quiz_results', score_id=new_score.id)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
