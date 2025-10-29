from main import db
from flask_login import UserMixin


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    def __init__(self, email, password_hash, username=None):
        self.email = email
        self.password_hash = password_hash
        self.username = username or email.split('@')[0]


class SafetyPost(db.Model):
    __tablename__ = "safety_posts"
    id = db.Column(db.Integer, primary_key=True)
    user_email = db.Column(db.String(120), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), nullable=False, default="General")
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def __init__(self, user_email, title, body, category="General"):
        self.user_email = user_email
        self.title = title
        self.body = body
        self.category = category


class SafetyComment(db.Model):
    __tablename__ = "safety_comments"
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("safety_posts.id", ondelete="CASCADE"), nullable=False)
    user_email = db.Column(db.String(120), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def __init__(self, post_id, user_email, body):
        self.post_id = post_id
        self.user_email = user_email
        self.body = body