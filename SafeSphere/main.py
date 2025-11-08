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

logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

# SQLAlchemy setup
db = SQLAlchemy(model_class=Base)

# Create app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Database - FORCED to SQLite due to disabled Neon endpoint
# To use PostgreSQL: remove/re-add database in Replit Database tool to get new credentials
import os
db_path = os.path.join(os.getcwd(), "instance", "safesphere.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_recycle": 300, "pool_pre_ping": True}

db.init_app(app)

# Flood Safety Configuration
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
USGS_BASE_URL = "https://waterservices.usgs.gov/nwis/iv/"
NWS_BASE_URL = "https://api.weather.gov"

# ---------------- Flood Safety Service ----------------
class FloodDataService:
    def __init__(self):
        self.flood_alerts = []
        self.stream_gauges = []
        self.user_reports = []
        self.last_update = None

    def fetch_nws_alerts(self):
        """Fetch current flood alerts for New Jersey"""
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

            print(f"Fetched {len(self.flood_alerts)} NWS flood alerts")
            return True

        except Exception as e:
            print(f"Error fetching NWS alerts: {e}")
            return False

    def fetch_usgs_stream_data(self):
        """Fetch USGS stream gauge data for NJ"""
        try:
            params = {
                'stateCd': 'nj',
                'parameterCd': '00065',  # Gauge height only
                'format': 'json',
                'period': 'PT1H'  # Last 1 hour
            }

            response = requests.get(USGS_BASE_URL, params=params, timeout=15)
            print(response)
            response.raise_for_status()

            data = response.json()

            # Check if we have the expected structure
            if 'value' not in data:
                print("Unexpected USGS API response structure")
                print(f"Response s: {list(data.s())}")
                return False

            time_series = data.get('value', {}).get('timeSeries', [])

            self.stream_gauges = []

            for series in time_series:
                try:
                    source_info = series.get('sourceInfo', {})
                    site_code = source_info.get('siteCode', [{}])[0].get('value', '')
                    site_name = source_info.get('siteName', '')

                    # Get coordinates
                    geo_location = source_info.get('geoLocation', {}).get('geogLocation', {})
                    lat = float(geo_location.get('latitude', 0))
                    lng = float(geo_location.get('longitude', 0))

                    # Skip if no valid coordinates
                    if lat == 0 or lng == 0:
                        continue

                    # Get latest value
                    values = series.get('values', [{}])[0].get('value', [])
                    if values:
                        latest_value = values[-1]
                        try:
                            value = float(latest_value.get('value', 0))
                        except (ValueError, TypeError):
                            continue

                        date_time = latest_value.get('dateTime', '')

                        # Get parameter info
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
                    print(f"Error processing gauge data: {e}")
                    continue

            print(f"Fetched {len(self.stream_gauges)} USGS stream gauges")
            return True

        except Exception as e:
            print(f"Error fetching USGS data: {e}")
            return False

    def _assess_flood_risk(self, value: float, param_code: str) -> str:
        """Simple flood risk assessment based on parameter values"""
        if param_code == '00065':  # Gauge height in feet
            if value > 8:  # Adjusted thresholds for NJ streams
                return 'high'
            elif value > 5:
                return 'medium'
            else:
                return 'low'
        elif param_code == '00060':  # Discharge in cubic feet per second
            if value > 2000:  # Adjusted for NJ stream sizes
                return 'high'
            elif value > 800:
                return 'medium'
            else:
                return 'low'
        return 'low'  # Default to low risk

    def update_data(self):
        """Update all flood data sources"""
        try:
            print("Updating flood data...")
            nws_success = self.fetch_nws_alerts()
            usgs_success = self.fetch_usgs_stream_data()

            if nws_success or usgs_success:
                self.last_update = datetime.now()
                return True
            return False
        except Exception as e:
            print(f"Error updating data: {e}")
            return False

    def should_update(self) -> bool:
        """Check if data should be updated (every 30 minutes)"""
        if not self.last_update:
            return True
        return datetime.now() - self.last_update > timedelta(minutes=30)

    def add_user_report(self, lat: float, lng: float, description: str, user_email: str = 'anonymous'):
        """Add a user-reported flood incident"""
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

# Global flood data service
flood_service = FloodDataService()

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in kilometers"""
    R = 6371  # Earth's radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = (math.sin(delta_lat/2) * math.sin(delta_lat/2) +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lng/2) * math.sin(delta_lng/2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c

def get_google_route(origin: str, destination: str, **kwargs):
    """Get route from Google Directions API with optional parameters"""
    try:
        base_url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            'origin': origin,
            'destination': destination,
            '': GOOGLE_MAPS_API_,
            'departure_time': 'now'  # For real-time traffic
        }

        # Add optional parameters
        if kwargs.get('avoid'):
            params['avoid'] = kwargs['avoid']
        if kwargs.get('alternatives'):
            params['alternatives'] = 'true'

        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()

        return response.json()
    except Exception as e:
        print(f"Error getting Google route: {e}")
        return None

def analyze_route_flood_risk(route_data: Dict) -> Dict:
    """Analyze flood risk along a route"""
    if not route_data or 'routes' not in route_data:
        return {'risk_level': 'unknown', 'warnings': [], 'affected_segments': []}

    route = route_data['routes'][0]
    legs = route.get('legs', [])

    risk_level = 'low'
    warnings = []
    affected_segments = []

    # Check route against flood alerts
    for alert in flood_service.flood_alerts:
        if alert['severity'] in ['Severe', 'Extreme']:
            warnings.append({
                'type': 'flood_alert',
                'message': f"{alert['event']}: {alert['areas']}",
                'severity': alert['severity']
            })
            risk_level = 'high'

    # Check route against stream gauges (simplified - check if route passes near high-risk gauges)
    high_risk_gauges = [g for g in flood_service.stream_gauges if g['flood_risk'] == 'high']
    if high_risk_gauges:
        for gauge in high_risk_gauges[:3]:  # Limit to top 3 for performance
            warnings.append({
                'type': 'high_water',
                'message': f"High water levels detected near {gauge['site_name']}",
                'location': {'lat': gauge['latitude'], 'lng': gauge['longitude']}
            })
            if risk_level == 'low':
                risk_level = 'medium'

    # Check user reports near route
    for report in flood_service.user_reports:
        # Simple proximity check (within 5km of start/end points)
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
    """
    Analyze flood risk along a route using both current data and predictions
    """
    if not route_data or 'routes' not in route_data:
        return {
            'risk_level': 'unknown', 
            'warnings': [], 
            'affected_segments': [],
            'predictions': []
        }

    route = route_data['routes'][0]
    legs = route.get('legs', [])

    # Extract waypoints along the route for prediction
    route_points = []
    for leg in legs:
        # Add start point
        route_points.append((
            leg['start_location']['lat'],
            leg['start_location']['lng']
        ))

        # Add intermediate points from steps (sample every 3rd step to avoid too many predictions)
        for i, step in enumerate(leg.get('steps', [])[::3]):
            route_points.append((
                step['start_location']['lat'],
                step['start_location']['lng']
            ))

        # Add end point
        route_points.append((
            leg['end_location']['lat'],
            leg['end_location']['lng']
        ))

    # Get predictions for route segments
    predictions = flood_predictor.predict_route_segments(route_points, hours_ahead)

    # Analyze predictions to determine overall risk
    high_risk_segments = [p for p in predictions if p['risk_level'] == 'high']
    medium_risk_segments = [p for p in predictions if p['risk_level'] == 'medium']

    # Calculate aggregate risk score
    if predictions:
        avg_risk_score = np.mean([p['risk_score'] for p in predictions])
        max_risk_score = max(p['risk_score'] for p in predictions)
    else:
        avg_risk_score = 0
        max_risk_score = 0

    # Determine overall risk level
    if max_risk_score >= 0.7 or len(high_risk_segments) > len(predictions) * 0.3:
        risk_level = 'high'
    elif max_risk_score >= 0.4 or len(medium_risk_segments) > len(predictions) * 0.5:
        risk_level = 'medium'
    else:
        risk_level = 'low'

    warnings = []
    affected_segments = []

    # Add prediction-based warnings
    for i, prediction in enumerate(predictions):
        if prediction['risk_level'] in ['high', 'medium']:
            affected_segments.append({
                'index': i,
                'location': prediction['location'],
                'risk_level': prediction['risk_level'],
                'risk_score': prediction['risk_score'],
                '_factors': prediction.get('_factors', [])
            })

            # Add warning for high-risk segments
            if prediction['risk_level'] == 'high':
                factors_str = ', '.join(prediction.get('_factors', ['Multiple risk factors']))[:100]
                warnings.append({
                    'type': 'predicted_flood',
                    'severity': 'high',
                    'message': f"High flood risk predicted in {hours_ahead} hours: {factors_str}",
                    'location': prediction['location'],
                    'confidence': prediction.get('confidence', 0.5)
                })

    # Also check current conditions (existing logic)
    for alert in flood_service.flood_alerts:
        if alert['severity'] in ['Severe', 'Extreme']:
            warnings.append({
                'type': 'current_alert',
                'message': f"{alert['event']}: {alert['areas']}",
                'severity': alert['severity']
            })
            if risk_level == 'low':
                risk_level = 'medium'

    # Check current gauge readings
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

# ---------------- Models ----------------
from models import User, SafetyPost, SafetyComment

# Database initialization function
def init_db():
    """Initialize database tables if they don't exist"""
    with app.app_context():
        db.create_all()

# Call initialization on first request
@app.before_request
def before_first_request():
    """Create database tables before first request"""
    if not hasattr(app, '_db_initialized'):
        try:
            init_db()
            app._db_initialized = True
        except Exception as e:
            print(f"Database initialization error: {e}")

# ---------------- Routes (pages) ----------------
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

@app.post("/signup")
def alias_signup():
    return api_signup()

@app.post("/login")
def alias_login():
    return api_login()

@app.post("/logout")
def alias_logout():
    return api_logout()

@app.get("/me")
def alias_me():
    return api_me()

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

# ---------------- JSON API (auth minimal) ----------------
@app.post("/api/signup")
def api_signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"ok": False, "error": "Missing email or password"}), 400

    if db.session.scalar(db.select(User).filter_by(email=email)):
        return jsonify({"ok": False, "error": "Email already registered"}), 409

    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    session["user"] = email
    return jsonify({"ok": True, "email": email})

@app.post("/api/login")
def api_login(): 
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = db.session.scalar(db.select(User).filter_by(email=email))
    if user and check_password_hash(user.password_hash, password):
        session["user"] = email
        return jsonify({"ok": True, "email": email})
    return jsonify({"ok": False, "error": "Invalid credentials"}), 401

@app.post("/api/logout")
def api_logout():
    session.pop("user", None)
    return jsonify({"ok": True})

@app.get("/api/me")
def api_me():
    if "user" in session:
        return jsonify({"ok": True, "email": session["user"]})
    return jsonify({"ok": False}), 401

# ==== Safety Board APIs ====
@app.get("/api/board/posts")
def api_board_list_posts():
    posts = db.session.execute(
        db.select(SafetyPost).order_by(SafetyPost.created_at.desc())
    ).scalars().all()

    # Preload comments per post
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

@app.post("/api/board/posts")
def api_board_create_post():
    if "user" not in session:
        return jsonify({"ok": False, "error": "Login required"}), 401
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

@app.post("/api/board/posts/<int:post_id>/comments")
def api_board_create_comment(post_id):
    if "user" not in session:
        return jsonify({"ok": False, "error": "Login required"}), 401
    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"ok": False, "error": "Comment required"}), 400
    # ensure post exists
    post = db.session.get(SafetyPost, post_id)
    if not post:
        return jsonify({"ok": False, "error": "Post not found"}), 404
    comment = SafetyComment(post_id=post_id, user_email=session["user"], body=body)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"ok": True, "id": comment.id})

@app.delete("/api/board/posts/<int:post_id>")
def api_board_delete_post(post_id):
    if "user" not in session:
        return jsonify({"ok": False, "error": "Login required"}), 401

    post = db.session.get(SafetyPost, post_id)
    if not post:
        return jsonify({"ok": False, "error": "Post not found"}), 404

    if post.user_email != session["user"]:
        return jsonify({"ok": False, "error": "You can only delete your own posts"}), 403

    # SQLite doesn't enforce ON DELETE CASCADE by default — remove comments manually
    db.session.execute(db.delete(SafetyComment).where(SafetyComment.post_id == post_id))
    db.session.delete(post)
    db.session.commit()
    return jsonify({"ok": True})

# ---------------- Flood Safety APIs ----------------
@app.post('/api/flood-route')
def get_safe_route():
    """Get route with flood risk analysis"""
    try:
        data = request.get_json()
        origin = data.get('origin')
        destination = data.get('destination')

        if not origin or not destination:
            return jsonify({'ok': False, 'error': 'Origin and destination required'}), 400

        # Update flood data if needed
        if flood_service.should_update():
            flood_service.update_data()

        # Get primary route
        primary_route = get_google_route(origin, destination)
        if not primary_route:
            return jsonify({'ok': False, 'error': 'Could not get route from Google Maps'}), 500

        # Analyze flood risk
        risk_analysis = analyze_route_flood_risk(primary_route)

        # Get alternative route if primary has high risk
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
        print(f"Error in get_safe_route: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.post('/api/flood-route-predictive')
def get_predictive_safe_route():
    """
    Get route with predictive flood risk analysis 2-6 hours ahead
    """
    try:
        data = request.get_json()
        origin = data.get('origin')
        destination = data.get('destination')
        hours_ahead = data.get('hours_ahead', 3)  # Default 3 hours prediction

        # Validate hours_ahead
        if not 2 <= hours_ahead <= 6:
            hours_ahead = 3

        if not origin or not destination:
            return jsonify({'ok': False, 'error': 'Origin and destination required'}), 400

        # Update flood data if needed
        if flood_service.should_update():
            flood_service.update_data()

        
        primary_route = get_google_route(origin, destination)
        if not primary_route:
            return jsonify({'ok': False, 'error': 'Could not get route from Google Maps'}), 500

        # Analyze flood risk with prediction
        risk_analysis = analyze_route_flood_risk_with_prediction(primary_route, hours_ahead)

        # Find alternative routes if primary has high risk
        alternatives = []
        if risk_analysis['risk_level'] == 'high':
            # Try multiple alternative routes
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

            # Sort alternatives by risk score
            alternatives.sort(key=lambda x: x['flood_risk']['avg_risk_score'])

        # Select best route
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
            'alternatives': alternatives[:2],  # Return top 2 alternatives
            'prediction_hours': hours_ahead,
            'data_last_updated': flood_service.last_update.isoformat() if flood_service.last_update else None
        }

        return jsonify({'ok': True, 'data': result})

    except Exception as e:
        print(f"Error in predictive routing: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.post('/api/predict-flood')
def predict_flood_location():
    """
    Predict flood risk for a specific location
    """
    try:
        data = request.get_json()
        lat = data.get('latitude')
        lng = data.get('longitude')
        hours_ahead = data.get('hours_ahead', 3)

        if not lat or not lng:
            return jsonify({'ok': False, 'error': 'Location required'}), 400

        # Get prediction
        prediction = flood_predictor.predict_flood_risk(lat, lng, hours_ahead)

        return jsonify({'ok': True, 'data': prediction})

    except Exception as e:
        print(f"Error in flood prediction: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.route('/api/flood-data')
def get_flood_data():
    """Get current flood data"""
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
        print(f"Error getting flood data: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

@app.route('/api/report-flood', methods=['POST'])
def report_flood():
    """Accept user reports of flooding"""
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
        print(f"Error processing flood report: {e}")
        return jsonify({'ok': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("Starting SafeSphere application...")
    print("Remember to set your GOOGLE_MAPS_API_KEY environment variable!")

    # Initial data fetch
    flood_service.update_data()

    app.run(host="0.0.0.0", port=5000, debug=True)
