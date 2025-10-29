import os
import logging
import requests
import json
import math
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash, check_password_hash
from flood_prediction import flood_predictor

# Enhanced logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class Base(DeclarativeBase):
    pass

# SQLAlchemy setup
db = SQLAlchemy(model_class=Base)

# Create app
app = Flask(__name__)

# FIXED: Better session configuration
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production-12345")
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True if using HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Database - FORCED to SQLite due to disabled Neon endpoint
# To use PostgreSQL: remove/re-add database in Replit Database tool to get new credentials
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///instance/safesphere.db"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_recycle": 300, "pool_pre_ping": True}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

# Flood Safety Configuration
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "AIzaSyCyZB2GPM0pOlfuE1F8UyKDZWmsk-Os2Rw")
USGS_BASE_URL = "https://waterservices.usgs.gov/nwis/iv/"
NWS_BASE_URL = "https://api.weather.gov"

# [Keep all your FloodDataService class and flood_service instance as is]
class FloodDataService:
    def __init__(self):
        self.flood_alerts = []
        self.stream_gauges = []
        self.user_reports = []
        self.last_update = None

    def fetch_nws_alerts(self):
        try:
            url = f"{NWS_BASE_URL}/alerts"
            params = {
                'area': 'NJ',
                'event': 'Flood Warning,Flash Flood Warning,Flood Watch,Flash Flood Watch'
            }
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            alerts = response.json().get('features', [])
            self.flood_alerts = []

            for alert in alerts:
                properties = alert.get('properties', {})
                geometry = alert.get('geometry', {})

                self.flood_alerts.append({
                    'id': properties.get('id', ''),
                    'event': properties.get('event', ''),
                    'severity': properties.get('severity', ''),
                    'description': properties.get('description', ''),
                    'areas': properties.get('areaDesc', ''),
                    'geometry': geometry,
                    'expires': properties.get('expires', '')
                })

            logger.info(f"Fetched {len(self.flood_alerts)} NWS flood alerts")
            return True

        except Exception as e:
            logger.error(f"Error fetching NWS alerts: {e}")
            return False

    def fetch_usgs_stream_data(self):
        try:
            params = {
                'stateCd': 'nj',
                'parameterCd': '00065',
                'format': 'json',
                'period': 'PT1H'
            }

            response = requests.get(USGS_BASE_URL, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()

            if 'value' not in data:
                logger.warning("Unexpected USGS API response structure")
                return False

            time_series = data.get('value', {}).get('timeSeries', [])
            self.stream_gauges = []

            for series in time_series:
                try:
                    source_info = series.get('sourceInfo', {})
                    site_code = source_info.get('siteCode', [{}])[0].get('value', '')
                    site_name = source_info.get('siteName', '')

                    geo_location = source_info.get('geoLocation', {}).get('geogLocation', {})
                    lat = float(geo_location.get('latitude', 0))
                    lng = float(geo_location.get('longitude', 0))

                    if lat == 0 or lng == 0:
                        continue

                    values = series.get('values', [{}])[0].get('value', [])
                    if values:
                        latest_value = values[-1]
                        try:
                            value = float(latest_value.get('value', 0))
                        except (ValueError, TypeError):
                            continue

                        date_time = latest_value.get('dateTime', '')
                        variable = series.get('variable', {})
                        param_code = variable.get('variableCode', [{}])[0].get('value', '')
                        param_name = variable.get('variableName', '')
                        unit = variable.get('unit', {}).get('unitAbbreviation', '')

                        self.stream_gauges.append({
                            'site_code': site_code,
                            'site_name': site_name,
                            'latitude': lat,
                            'longitude': lng,
                            'parameter_code': param_code,
                            'parameter_name': param_name,
                            'value': value,
                            'unit': unit,
                            'date_time': date_time,
                            'flood_risk': self._assess_flood_risk(value, param_code)
                        })
                except Exception as e:
                    logger.error(f"Error processing gauge data: {e}")
                    continue

            logger.info(f"Fetched {len(self.stream_gauges)} USGS stream gauges")
            return True

        except Exception as e:
            logger.error(f"Error fetching USGS data: {e}")
            return False

    def _assess_flood_risk(self, value: float, param_code: str) -> str:
        if param_code == '00065':
            if value > 8:
                return 'high'
            elif value > 5:
                return 'medium'
            else:
                return 'low'
        elif param_code == '00060':
            if value > 2000:
                return 'high'
            elif value > 800:
                return 'medium'
            else:
                return 'low'
        return 'low'

    def update_data(self):
        try:
            logger.info("Updating flood data...")
            nws_success = self.fetch_nws_alerts()
            usgs_success = self.fetch_usgs_stream_data()

            if nws_success or usgs_success:
                self.last_update = datetime.now()
                return True
            return False
        except Exception as e:
            logger.error(f"Error updating data: {e}")
            return False

    def should_update(self) -> bool:
        if not self.last_update:
            return True
        return datetime.now() - self.last_update > timedelta(minutes=30)

    def add_user_report(self, lat: float, lng: float, description: str, user_email: str = 'anonymous'):
        report = {
            'id': len(self.user_reports) + 1,
            'latitude': lat,
            'longitude': lng,
            'description': description,
            'user_email': user_email,
            'timestamp': datetime.now().isoformat(),
            'verified': False
        }
        self.user_reports.append(report)
        return report

flood_service = FloodDataService()

# [Keep your helper functions]
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    a = (math.sin(delta_lat/2) * math.sin(delta_lat/2) +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lng/2) * math.sin(delta_lng/2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# Import models AFTER db is initialized
from models import User, SafetyPost, SafetyComment

def get_google_route(origin: str, destination: str, **kwargs):
    try:
        base_url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            'origin': origin,
            'destination': destination,
            'key': GOOGLE_MAPS_API_KEY,
            'departure_time': 'now'
        }
        if kwargs.get('avoid'):
            params['avoid'] = kwargs['avoid']
        if kwargs.get('alternatives'):
            params['alternatives'] = 'true'
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error getting Google route: {e}")
        return None

def analyze_route_flood_risk(route_data: Dict) -> Dict:
    if not route_data or 'routes' not in route_data:
        return {'risk_level': 'unknown', 'warnings': [], 'affected_segments': []}

    route = route_data['routes'][0]
    legs = route.get('legs', [])
    risk_level = 'low'
    warnings = []
    affected_segments = []

    for alert in flood_service.flood_alerts:
        if alert['severity'] in ['Severe', 'Extreme']:
            warnings.append({
                'type': 'flood_alert',
                'message': f"{alert['event']}: {alert['areas']}",
                'severity': alert['severity']
            })
            risk_level = 'high'

    high_risk_gauges = [g for g in flood_service.stream_gauges if g['flood_risk'] == 'high']
    if high_risk_gauges:
        for gauge in high_risk_gauges[:3]:
            warnings.append({
                'type': 'high_water',
                'message': f"High water levels detected near {gauge['site_name']}",
                'location': {'lat': gauge['latitude'], 'lng': gauge['longitude']}
            })
            if risk_level == 'low':
                risk_level = 'medium'

    for report in flood_service.user_reports:
        for leg in legs:
            start_lat = leg['start_location']['lat']
            start_lng = leg['start_location']['lng']
            end_lat = leg['end_location']['lat']
            end_lng = leg['end_location']['lng']
            start_dist = calculate_distance(report['latitude'], report['longitude'], start_lat, start_lng)
            end_dist = calculate_distance(report['latitude'], report['longitude'], end_lat, end_lng)
            if start_dist < 5 or end_dist < 5:
                warnings.append({
                    'type': 'user_report',
                    'message': f"Reported flooding: {report['description'][:50]}...",
                    'location': {'lat': report['latitude'], 'lng': report['longitude']}
                })
                if risk_level == 'low':
                    risk_level = 'medium'

    return {
        'risk_level': risk_level,
        'warnings': warnings,
        'affected_segments': affected_segments
    }

def analyze_route_flood_risk_with_prediction(route_data: Dict, hours_ahead: int = 3) -> Dict:
    if not route_data or 'routes' not in route_data:
        return {
            'risk_level': 'unknown', 
            'warnings': [], 
            'affected_segments': [],
            'predictions': []
        }

    route = route_data['routes'][0]
    legs = route.get('legs', [])

    route_points = []
    for leg in legs:
        route_points.append((
            leg['start_location']['lat'],
            leg['start_location']['lng']
        ))
        for i, step in enumerate(leg.get('steps', [])[::3]):
            route_points.append((
                step['start_location']['lat'],
                step['start_location']['lng']
            ))
        route_points.append((
            leg['end_location']['lat'],
            leg['end_location']['lng']
        ))

    predictions = flood_predictor.predict_route_segments(route_points, hours_ahead)

    high_risk_segments = [p for p in predictions if p['risk_level'] == 'high']
    medium_risk_segments = [p for p in predictions if p['risk_level'] == 'medium']

    if predictions:
        avg_risk_score = np.mean([p['risk_score'] for p in predictions])
        max_risk_score = max(p['risk_score'] for p in predictions)
    else:
        avg_risk_score = 0
        max_risk_score = 0

    if max_risk_score >= 0.7 or len(high_risk_segments) > len(predictions) * 0.3:
        risk_level = 'high'
    elif max_risk_score >= 0.4 or len(medium_risk_segments) > len(predictions) * 0.5:
        risk_level = 'medium'
    else:
        risk_level = 'low'

    warnings = []
    affected_segments = []

    for i, prediction in enumerate(predictions):
        if prediction['risk_level'] in ['high', 'medium']:
            affected_segments.append({
                'index': i,
                'location': prediction['location'],
                'risk_level': prediction['risk_level'],
                'risk_score': prediction['risk_score'],
                'key_factors': prediction.get('key_factors', [])
            })
            if prediction['risk_level'] == 'high':
                factors_str = ', '.join(prediction.get('key_factors', ['Multiple risk factors']))[:100]
                warnings.append({
                    'type': 'predicted_flood',
                    'severity': 'high',
                    'message': f"High flood risk predicted in {hours_ahead} hours: {factors_str}",
                    'location': prediction['location'],
                    'confidence': prediction.get('confidence', 0.5)
                })

    for alert in flood_service.flood_alerts:
        if alert['severity'] in ['Severe', 'Extreme']:
            warnings.append({
                'type': 'current_alert',
                'message': f"{alert['event']}: {alert['areas']}",
                'severity': alert['severity']
            })
            if risk_level == 'low':
                risk_level = 'medium'

    high_risk_gauges = [g for g in flood_service.stream_gauges if g['flood_risk'] == 'high']
    for gauge in high_risk_gauges[:3]:
        warnings.append({
            'type': 'high_water_current',
            'message': f"Current high water: {gauge['site_name']}",
            'location': {'lat': gauge['latitude'], 'lng': gauge['longitude']}
        })

    return {
        'risk_level': risk_level,
        'warnings': warnings,
        'affected_segments': affected_segments,
        'predictions': predictions,
        'avg_risk_score': float(avg_risk_score),
        'max_risk_score': float(max_risk_score),
        'prediction_time': predictions[0]['prediction_time'] if predictions else None,
        'hours_ahead': hours_ahead
    }

# FIXED: Better database initialization
def init_db():
    with app.app_context():
        try:
            logger.info(f"📊 Initializing database with URI: {app.config['SQLALCHEMY_DATABASE_URI'][:50]}...")
            db.create_all()
            logger.info("✅ Database tables created successfully")
        except Exception as e:
            logger.error(f"❌ Database initialization error: {e}")
            # Don't raise - allow app to continue

# Initialize database on startup
try:
    with app.app_context():
        init_db()
except Exception as e:
    logger.error(f"Failed to initialize database: {e}")

# CRITICAL: Add JSON error handlers to prevent HTML error pages
@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 Error: {error}")
    db.session.rollback()
    return jsonify({"ok": False, "error": "Internal server error"}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"ok": False, "error": "Not found"}), 404

@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {e}")
    import traceback
    traceback.print_exc()
    db.session.rollback()
    return jsonify({"ok": False, "error": str(e)}), 500

# Routes
@app.route("/")
def index():
    return render_template("index.html", active_page=None)

@app.route("/about")
def about():
    return render_template("index.html", active_page="about")

@app.route("/contact")
def contact():
    return render_template("index.html", active_page="contact")

@app.route("/signin")
def signin():
    return render_template("index.html", active_page="signin")

@app.route("/ai")
def ai():
    return render_template("index.html", active_page="ai")

@app.route("/routes")
def routes():
    return render_template("index.html", active_page="routes")

@app.route("/alerts")
def alerts():
    return render_template("index.html", active_page="alerts")

@app.get("/login")
def login_page():
    return render_template("index.html", active_page="signin")

@app.get("/signup")
def signup_page():
    return render_template("index.html", active_page="signup")

@app.get("/login/success")
def login_success_page():
    return render_template("index.html", active_page="login_success")

@app.get("/signup/success")
def signup_success_page():
    return render_template("index.html", active_page="signup_success")

@app.get("/board")
def board_page():
    return render_template("index.html", active_page="board")

# FIXED: Enhanced API endpoints with better error handling
@app.post("/api/signup")
def api_signup():
    try:
        data = request.get_json(silent=True)
        if not data:
            logger.error("No JSON data received in signup")
            return jsonify({"ok": False, "error": "No data provided"}), 400

        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        logger.info(f"Signup attempt for email: {email}")

        if not email or not password:
            logger.error("Missing email or password")
            return jsonify({"ok": False, "error": "Missing email or password"}), 400

        existing_user = db.session.scalar(db.select(User).filter_by(email=email))
        if existing_user:
            logger.warning(f"Email already registered: {email}")
            return jsonify({"ok": False, "error": "Email already registered"}), 409

        user = User(email=email, password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()

        session["user"] = email
        session.permanent = True

        logger.info(f"✅ User created successfully: {email}")
        return jsonify({"ok": True, "email": email})

    except Exception as e:
        logger.error(f"Signup error: {e}")
        db.session.rollback()
        return jsonify({"ok": False, "error": "Server error during signup"}), 500

@app.post("/api/login")
def api_login():
    try:
        data = request.get_json(silent=True)
        if not data:
            logger.error("No JSON data received in login")
            return jsonify({"ok": False, "error": "No data provided"}), 400

        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        logger.info(f"Login attempt for email: {email}")

        if not email or not password:
            logger.error("Missing email or password")
            return jsonify({"ok": False, "error": "Missing email or password"}), 400

        user = db.session.scalar(db.select(User).filter_by(email=email))

        if not user:
            logger.warning(f"User not found: {email}")
            return jsonify({"ok": False, "error": "Invalid credentials"}), 401

        if not check_password_hash(user.password_hash, password):
            logger.warning(f"Invalid password for user: {email}")
            return jsonify({"ok": False, "error": "Invalid credentials"}), 401

        session["user"] = email
        session.permanent = True

        logger.info(f"✅ User logged in successfully: {email}")
        return jsonify({"ok": True, "email": email})

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"ok": False, "error": "Server error during login"}), 500

@app.post("/api/logout")
def api_logout():
    try:
        email = session.get("user")
        session.pop("user", None)
        logger.info(f"User logged out: {email}")
        return jsonify({"ok": True})
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({"ok": False, "error": "Logout failed"}), 500

@app.get("/api/me")
def api_me():
    try:
        if "user" in session:
            logger.debug(f"User session active: {session['user']}")
            return jsonify({"ok": True, "email": session["user"]})
        logger.debug("No active session")
        return jsonify({"ok": False}), 401
    except Exception as e:
        logger.error(f"Session check error: {e}")
        return jsonify({"ok": False, "error": "Session error"}), 500

# Safety Board APIs
@app.get("/api/board/posts")
def api_board_list_posts():
    try:
        posts = db.session.execute(
            db.select(SafetyPost).order_by(SafetyPost.created_at.desc())
        ).scalars().all()

        post_ids = [p.id for p in posts]
        comments = []
        if post_ids:
            comments = db.session.execute(
                db.select(SafetyComment).where(SafetyComment.post_id.in_(post_ids)).order_by(SafetyComment.created_at.asc())
            ).scalars().all()

        comments_by_post = {}
        for c in comments:
            comments_by_post.setdefault(c.post_id, []).append({
                "id": c.id,
                "user_email": c.user_email.split("@")[0],
                "body": c.body,
                "created_at": c.created_at.isoformat()
            })

        data = []
        current_user = session.get("user")
        for p in posts:
            data.append({
                "id": p.id,
                "title": p.title,
                "category": p.category,
                "body": p.body,
                "user_email": p.user_email.split("@")[0],
                "created_at": p.created_at.isoformat(),
                "comments": comments_by_post.get(p.id, []),
                "can_delete": current_user == p.user_email
            })
        return jsonify({"ok": True, "data": data})
    except Exception as e:
        logger.error(f"Error loading posts: {e}")
        return jsonify({"ok": False, "error": "Failed to load posts"}), 500

@app.post("/api/board/posts")
def api_board_create_post():
    if "user" not in session:
        return jsonify({"ok": False, "error": "Login required"}), 401
    try:
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        body = (data.get("body") or "").strip()
        category = (data.get("category") or "General").strip() or "General"
        if not title or not body:
            return jsonify({"ok": False, "error": "Title and body are required"}), 400
        post = SafetyPost(user_email=session["user"], title=title, body=body, category=category)
        db.session.add(post)
        db.session.commit()
        return jsonify({"ok": True, "id": post.id})
    except Exception as e:
        logger.error(f"Error creating post: {e}")
        db.session.rollback()
        return jsonify({"ok": False, "error": "Failed to create post"}), 500

@app.post("/api/board/posts/<int:post_id>/comments")
def api_board_create_comment(post_id):
    if "user" not in session:
        return jsonify({"ok": False, "error": "Login required"}), 401
    try:
        data = request.get_json(silent=True) or {}
        body = (data.get("body") or "").strip()
        if not body:
            return jsonify({"ok": False, "error": "Comment required"}), 400
        post = db.session.get(SafetyPost, post_id)
        if not post:
            return jsonify({"ok": False, "error": "Post not found"}), 404
        comment = SafetyComment(post_id=post_id, user_email=session["user"], body=body)
        db.session.add(comment)
        db.session.commit()
        return jsonify({"ok": True, "id": comment.id})
    except Exception as e:
        logger.error(f"Error creating comment: {e}")
        db.session.rollback()
        return jsonify({"ok": False, "error": "Failed to create comment"}), 500

@app.delete("/api/board/posts/<int:post_id>")
def api_board_delete_post(post_id):
    if "user" not in session:
        return jsonify({"ok": False, "error": "Login required"}), 401
    try:
        post = db.session.get(SafetyPost, post_id)
        if not post:
            return jsonify({"ok": False, "error": "Post not found"}), 404
        if post.user_email != session["user"]:
            return jsonify({"ok": False, "error": "You can only delete your own posts"}), 403
        db.session.execute(db.delete(SafetyComment).where(SafetyComment.post_id == post_id))
        db.session.delete(post)
        db.session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        logger.error(f"Error deleting post: {e}")
        db.session.rollback()
        return jsonify({"ok": False, "error": "Failed to delete post"}), 500

# [Keep all your flood route APIs exactly as they are - they're working fine]
@app.post('/api/flood-route')
def get_safe_route():
    try:
        data = request.get_json()
        origin = data.get('origin')
        destination = data.get('destination')

        if not origin or not destination:
            return jsonify({'ok': False, 'error': 'Origin and destination required'}), 400

        if flood_service.should_update():
            flood_service.update_data()

        primary_route = get_google_route(origin, destination)
        if not primary_route:
            return jsonify({'ok': False, 'error': 'Could not get route from Google Maps'}), 500

        risk_analysis = analyze_route_flood_risk(primary_route)

        alternative_route = None
        if risk_analysis['risk_level'] == 'high':
            alternative_route = get_google_route(origin, destination, avoid='highways')
            if alternative_route:
                alt_risk_analysis = analyze_route_flood_risk(alternative_route)
                alternative_route['flood_risk'] = alt_risk_analysis

        result = {
            'primary_route': primary_route,
            'flood_risk': risk_analysis,
            'alternative_route': alternative_route,
            'data_last_updated': flood_service.last_update.isoformat() if flood_service.last_update else None
        }

        return jsonify({'ok': True, 'data': result})

    except Exception as e:
        logger.error(f"Error in get_safe_route: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.post('/api/flood-route-predictive')
def get_predictive_safe_route():
    try:
        data = request.get_json()
        origin = data.get('origin')
        destination = data.get('destination')
        hours_ahead = data.get('hours_ahead', 3)

        if not 2 <= hours_ahead <= 6:
            hours_ahead = 3

        if not origin or not destination:
            return jsonify({'ok': False, 'error': 'Origin and destination required'}), 400

        if flood_service.should_update():
            flood_service.update_data()

        primary_route = get_google_route(origin, destination)
        if not primary_route:
            return jsonify({'ok': False, 'error': 'Could not get route from Google Maps'}), 500

        risk_analysis = analyze_route_flood_risk_with_prediction(primary_route, hours_ahead)

        alternatives = []
        if risk_analysis['risk_level'] == 'high':
            alternative_params = [
                {'avoid': 'highways'},
                {'avoid': 'tolls'},
            ]

            for params in alternative_params:
                alt_route = get_google_route(origin, destination, **params)
                if alt_route and alt_route != primary_route:
                    alt_risk = analyze_route_flood_risk_with_prediction(alt_route, hours_ahead)
                    alternatives.append({
                        'route': alt_route,
                        'flood_risk': alt_risk,
                        'avoid_type': params.get('avoid', 'alternative')
                    })

            alternatives.sort(key=lambda x: x['flood_risk']['avg_risk_score'])

        if alternatives and alternatives[0]['flood_risk']['risk_level'] != 'high':
            recommended_route = alternatives[0]['route']
            recommended_risk = alternatives[0]['flood_risk']
            route_type = 'alternative'
        else:
            recommended_route = primary_route
            recommended_risk = risk_analysis
            route_type = 'primary'

        result = {
            'recommended_route': recommended_route,
            'recommended_risk': recommended_risk,
            'route_type': route_type,
            'primary_route': primary_route,
            'primary_risk': risk_analysis,
            'alternatives': alternatives[:2],
            'prediction_hours': hours_ahead,
            'data_last_updated': flood_service.last_update.isoformat() if flood_service.last_update else None
        }

        return jsonify({'ok': True, 'data': result})

    except Exception as e:
        logger.error(f"Error in predictive routing: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.post('/api/predict-flood')
def predict_flood_location():
    try:
        data = request.get_json()
        lat = data.get('latitude')
        lng = data.get('longitude')
        hours_ahead = data.get('hours_ahead', 3)

        if not lat or not lng:
            return jsonify({'ok': False, 'error': 'Location required'}), 400

        prediction = flood_predictor.predict_flood_risk(lat, lng, hours_ahead)
        return jsonify({'ok': True, 'data': prediction})

    except Exception as e:
        logger.error(f"Error in flood prediction: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.route('/api/flood-data')
def get_flood_data():
    try:
        if flood_service.should_update():
            flood_service.update_data()

        data = {
            'alerts': flood_service.flood_alerts,
            'stream_gauges': flood_service.stream_gauges,
            'last_updated': flood_service.last_update.isoformat() if flood_service.last_update else None
        }

        return jsonify({'ok': True, 'data': data})
    except Exception as e:
        logger.error(f"Error getting flood data: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.route('/api/report-flood', methods=['POST'])
def report_flood():
    try:
        data = request.get_json()
        lat = data.get('latitude')
        lng = data.get('longitude')
        description = data.get('description', '')

        if not lat or not lng:
            return jsonify({'ok': False, 'error': 'Location required'}), 400

        user_email = session.get('user') or 'anonymous'
        report = flood_service.add_user_report(lat, lng, description, user_email)

        return jsonify({'ok': True, 'data': {'id': report['id'], 'message': 'Flood report received'}})
    except Exception as e:
        logger.error(f"Error processing flood report: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    logger.info("🚀 Starting SafeSphere application...")
    logger.info("📍 Remember to set your GOOGLE_MAPS_API_KEY environment variable!")

    flood_service.update_data()

    app.run(host="0.0.0.0", port=5000, debug=True)