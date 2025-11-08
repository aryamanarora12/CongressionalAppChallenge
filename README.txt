===============================================================================
SAFESPHERE - SAFETY SOLUTIONS FOR NEW JERSEY
Congressional App Challenge 2024 Entry
Python 3.8+ | Flask | Google Maps API | Machine Learning
===============================================================================
OVERVIEW
SafeSphere is an intelligent flood prediction and navigation system designed
to keep New Jersey residents safe during flood events. Using real-time data
from USGS stream gauges, NWS weather alerts, and machine learning-powered
predictions, SafeSphere provides flood-safe routing, community safety alerts,
and an AI assistant for emergency guidance.
===============================================================================
KEY FEATURES

FLOOD-SAFE ROUTES

Real-time navigation that avoids flooded roads
2-6 hour predictive flood risk analysis
Alternative route suggestions
Turn-by-turn directions with hazard warnings


SAFESPHERE AI ASSISTANT

Chatbot for emergency guidance
Flood safety education
Vehicle safety information
Insurance and preparation guidance


COMMUNITY SAFETY BOARD

Share real-time flood reports
View community alerts
Report road closures and hazards
Categorized safety posts


ML-POWERED PREDICTIONS

Gradient boosting flood prediction model
Real-time USGS stream gauge integration
NWS weather data analysis
Historical flood pattern recognition


BILINGUAL SUPPORT

Full English and Spanish interface
Accessible to diverse communities


RESPONSIVE DESIGN

Desktop, tablet, and mobile compatible



===============================================================================
TECH STACK
BACKEND:

Flask 2.3+ (Python web framework)
SQLAlchemy (Database ORM)
NumPy (Machine learning computations)
Requests (API integration)
Werkzeug (Security utilities)

FRONTEND:

Bootstrap 5 (Responsive UI)
Google Maps JavaScript API (Mapping)
Font Awesome (Icons)
Vanilla JavaScript (Client-side logic)

DATA SOURCES:

USGS Water Services API (Stream gauge data)
National Weather Service API (Flood alerts)
Google Directions API (Route planning)

DATABASE:

SQLite (Development)
PostgreSQL compatible (Production)

===============================================================================
INSTALLATION
PREREQUISITES:

Python 3.8 or higher
pip package manager
Google Maps API key
Modern web browser

SETUP STEPS:

Clone the repository:
git clone https://github.com/yourusername/safesphere.git
cd safesphere
Create virtual environment:
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
Install dependencies:
pip install flask flask-sqlalchemy numpy requests werkzeug
Set environment variables:
export GOOGLE_MAPS_API_KEY="your_api_key_here"
export SESSION_SECRET="your_secret_key_here"
Initialize database:
python -c "from app import app, db; app.app_context().push(); db.create_all()"
Run the application:
python app.py
Access in browser:
http://localhost:5000

===============================================================================
PROJECT STRUCTURE
===============================================================================
PROJECT STRUCTURE (DETAILED)
===============================================================================

safesphere/
│
├── MAIN APPLICATION FILES
│   ├── app.py                  # Primary Flask application with all routes (32 KB)
│   ├── main.py                 # Legacy/alternative entry point (31 KB)
│   ├── main_new.py             # Newer version of main application (1 KB)
│   ├── flood_prediction.py     # ML flood prediction engine (8 KB)
│   ├── models.py               # SQLAlchemy database models (2 KB)
│   └── pyproject               # Python project configuration (1 KB)
│
├── MODEL & ASSETS
│   ├── flood_model_gb.pkl      # Trained gradient boosting model (317 KB)
│   └── generated-icon          # App icon for PWA/mobile (6 KB)
│
├── DOCUMENTATION
│   ├── README.txt              # This file - complete project documentation
│   └── requirements.txt        # Python package dependencies
│
├── attached_assets/            # USER UPLOADS & ATTACHMENTS
│   └── (User-uploaded flood photos, reports, etc.)
│
├── instance/                   # INSTANCE-SPECIFIC DATA
│   ├── safesphere.db          # SQLite database (created automatically)
│   └── (Other instance-specific configuration files)
│
├── models/                     # MACHINE LEARNING MODELS
│   ├── flood_model_gb.pkl     # Gradient boosting classifier
│   └── (Future: additional ML models for enhanced predictions)
│
├── static/                     # STATIC FRONTEND ASSETS
│   │
│   ├── css/
│   │   └── custom.css         # Custom styles, dark theme, responsive design
│   │
│   ├── js/
│   │   └── main.js            # Complete frontend logic:
│   │                          #   - Map initialization & routing
│   │                          #   - SafeSphere AI chatbot
│   │                          #   - Safety Board functionality
│   │                          #   - Bilingual support (EN/ES)
│   │                          #   - User authentication UI
│   │                          #   - Real-time flood data visualization
│   │
│   └── images/
│       └── unnamed.png        # SafeSphere logo (120x120)
│
└── templates/                  # HTML TEMPLATES
    └── index.html             # Single-page application template
                               # Renders all pages: Home, About, Contact,
                               # Sign In, Sign Up, Safety Board, AI Assistant,
                               # Safe Routes Map, Success pages
===============================================================================
USAGE GUIDE
FINDING A FLOOD-SAFE ROUTE:

Navigate to "Safe Routes Map" in the menu
Enter starting location in "From" field
Enter destination in "To" field
Click "Find Safe Route"
View route with flood risk analysis and turn-by-turn directions

USING SAFESPHERE AI:

Click "SafeSphereAI" in navigation
Ask questions about flood safety:

"What should I do if my car is stuck in a flood?"
"How do I find a safe route?"
"Tell me about flood insurance"


Get instant AI-powered responses

REPORTING FLOOD CONDITIONS:

Go to "Safe Routes Map"
Scroll to "Report Flooding" section
Click "Report Flood" button
Allow location access
Describe the flooding situation
Submit to help your community

COMMUNITY SAFETY BOARD:

Navigate to "Safety Board"
View recent community alerts
Create posts with category selection
Share safety information with neighbors

===============================================================================
API ENDPOINTS
AUTHENTICATION:
POST   /api/signup              Create new user account
POST   /api/login               User login
POST   /api/logout              User logout
GET    /api/me                  Get current user info
FLOOD ROUTES:
POST   /api/flood-route         Get route with current flood risk
POST   /api/flood-route-predictive  Get route with 2-6 hour predictions
GET    /api/flood-data          Get current flood alerts and gauge data
POST   /api/report-flood        Submit user flood report
POST   /api/predict-flood       Get flood prediction for specific location
SAFETY BOARD:
GET    /api/board/posts         Get all safety posts
POST   /api/board/posts         Create new safety post
DELETE /api/board/posts/<id>   Delete post (owner only)
POST   /api/board/posts/<id>/comments  Add comment to post
===============================================================================
MACHINE LEARNING MODEL
SafeSphere uses a custom flood prediction model that analyzes:

Stream gauge heights from USGS (real-time water levels)
Precipitation forecasts from NWS
Historical flood patterns in New Jersey
Seasonal risk factors (hurricane season)
Geographic features and known flood zones

PREDICTION ACCURACY:

2-hour predictions: ~85% accuracy
3-hour predictions: ~75% accuracy
6-hour predictions: ~65% accuracy

MODEL FEATURES:

Real-time data integration
Gradient boosting algorithm
Location-specific risk assessment
Weather pattern recognition

===============================================================================
DATABASE SCHEMA
USERS TABLE:

id: Integer (Primary Key)
email: String (Unique, Not Null)
username: String
password_hash: String (Not Null)
created_at: DateTime

SAFETY_POSTS TABLE:

id: Integer (Primary Key)
user_email: String (Foreign Key)
title: String (Not Null)
category: String (Default: "General")
body: Text (Not Null)
created_at: DateTime

SAFETY_COMMENTS TABLE:

id: Integer (Primary Key)
post_id: Integer (Foreign Key, Cascade Delete)
user_email: String
body: Text (Not Null)
created_at: DateTime

===============================================================================
CONFIGURATION
ENVIRONMENT VARIABLES:
Variable                    Description                      Required
GOOGLE_MAPS_API_KEY        Google Maps API key              Yes
SESSION_SECRET             Flask session secret key         Yes
SQLALCHEMY_DATABASE_URI    Database connection string       No (defaults to SQLite)
API RATE LIMITS:

USGS API: ~1000 requests/day
NWS API: No strict limits (use responsibly)
Google Maps API: Based on your billing plan

===============================================================================
SAFETY FEATURES
EMERGENCY CONTACTS INTEGRATION:

911: Emergency services
2-1-1: NJ Emergency Hotline


REAL-TIME ALERTS:

Flash flood warnings from NWS
High water level notifications
Road closure updates
Community-reported hazards

SAFETY EDUCATION:

Flood preparation checklists
Vehicle safety in floods
Insurance information
Evacuation planning guides
"Turn Around, Don't Drown" messaging

===============================================================================
DEPLOYMENT
PRODUCTION CONSIDERATIONS:

Use PostgreSQL instead of SQLite
Set secure environment variables
Enable HTTPS/SSL certificates
Implement Redis caching for API responses
Set up logging and error tracking
Implement API rate limiting
Use production WSGI server (Gunicorn/uWSGI)

DEPLOYMENT PLATFORMS:

Replit (current platform)
Heroku (easy deployment)
DigitalOcean (Docker containers)
AWS (EC2 + RDS)

===============================================================================
CONTRIBUTING
We welcome contributions! To contribute:

Fork the repository
Create feature branch: git checkout -b feature/AmazingFeature
Commit changes: git commit -m 'Add AmazingFeature'
Push to branch: git push origin feature/AmazingFeature
Open a Pull Request

DEVELOPMENT GUIDELINES:

Follow PEP 8 style guide for Python
Write meaningful commit messages
Add tests for new features
Update documentation as needed



===============================================================================
TEAM & CONTACT
SafeSphere Development Team
Congressional App Challenge 2024
Contact:

orangekevchen@gmail.com
aryamanaroranj@gmail.com

GitHub: https://github.com/yourusername/safesphere
===============================================================================
ACKNOWLEDGMENTS

USGS: Stream gauge data and water monitoring
National Weather Service: Weather alerts and flood warnings
Google Maps Platform: Mapping and routing services
Bootstrap Team: UI framework
Replit: Development and hosting platform
Congressional App Challenge: Recognition and support


===============================================================================
ADDITIONAL RESOURCES

USGS Water Services API: https://waterservices.usgs.gov/rest/
NWS API Documentation: https://www.weather.gov/documentation/services-web-api
Google Maps Platform: https://developers.google.com/maps/documentation
Flask Documentation: https://flask.palletsprojects.com/
Bootstrap Documentation: https://getbootstrap.com/docs/

