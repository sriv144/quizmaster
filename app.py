from flask import Flask
from routes import app_routes
from models import db
import os
from jinja2 import ChoiceLoader, FileSystemLoader

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///quiz_master.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configure template loader to handle subfolders
template_dirs = [
    os.path.join(app.root_path, 'templates'),
    os.path.join(app.root_path, 'templates/authentication'),
    os.path.join(app.root_path, 'templates/admin'),
    os.path.join(app.root_path, 'templates/user')
]

app.jinja_loader = ChoiceLoader([
    FileSystemLoader(template_dirs)
])

# Initialize database
db.init_app(app)

# Register blueprints
app.register_blueprint(app_routes)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
