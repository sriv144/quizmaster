# app.py
from flask import Flask
from models import db
from routes import app_routes

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///quiz_master.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = "your_secret_key"  # change for production

db.init_app(app)
app.register_blueprint(app_routes)

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)
