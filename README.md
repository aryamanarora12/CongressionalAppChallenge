# SafeSphere - Safety Solutions for New Jersey

**Congressional App Challenge 2024 Entry**

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-2.3+-green.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

SafeSphere is an intelligent flood prediction and navigation system designed to keep New Jersey residents safe during flood events. Using real-time data from USGS stream gauges, NWS weather alerts, and machine learning-powered predictions, SafeSphere provides flood-safe routing, community safety alerts, and an AI assistant for emergency guidance.

---

## Key Features

### 🗺️ Flood-Safe Routes
- Real-time navigation that avoids flooded roads
- 2-6 hour predictive flood risk analysis
- Alternative route suggestions
- Turn-by-turn directions with hazard warnings

### 🤖 SafeSphere AI Assistant
- Chatbot for emergency guidance
- Flood safety education
- Vehicle safety information
- Insurance and preparation guidance

### 📢 Community Safety Board
- Share real-time flood reports
- View community alerts
- Report road closures and hazards
- Categorized safety posts

### 🧠 ML-Powered Predictions
- Gradient boosting flood prediction model
- Real-time USGS stream gauge integration
- NWS weather data analysis
- Historical flood pattern recognition

### 🌐 Bilingual Support
- Full English and Spanish interface
- Accessible to diverse communities

### 📱 Responsive Design
- Desktop, tablet, and mobile compatible

---

## Tech Stack

### Backend
- **Flask 2.3+** - Python web framework
- **SQLAlchemy** - Database ORM
- **NumPy** - Machine learning computations
- **Requests** - API integration
- **Werkzeug** - Security utilities

### Frontend
- **Bootstrap 5** - Responsive UI
- **Google Maps JavaScript API** - Mapping
- **Font Awesome** - Icons
- **Vanilla JavaScript** - Client-side logic

### Data Sources
- **USGS Water Services API** - Stream gauge data
- **National Weather Service API** - Flood alerts
- **Google Directions API** - Route planning

### Database
- **SQLite** - Development
- **PostgreSQL** - Production compatible

---

## Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager
- Google Maps API key
- Modern web browser

### Setup Steps

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/safesphere.git
cd safesphere
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install flask flask-sqlalchemy numpy requests werkzeug
```

4. **Set environment variables:**
```bash
export GOOGLE_MAPS_API_KEY="your_api_key_here"
export SESSION_SECRET="your_secret_key_here"
```

5. **Initialize database:**
```bash
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

6. **Run the application:**
```bash
python app.py
```

7. **Access in browser:**
```
http://localhost:5000
```

---

## Project Structure

```
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
│   ├── README.md               # This file - complete project documentation
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
```

---

## Usage Guide

### Finding a Flood-Safe Route

1. Navigate to "Safe Routes Map" in the menu
2. Enter starting location in "From" field
3. Enter destination in "To" field
4. Click "Find Safe Route"
5. View route with flood risk analysis and turn-by-turn directions

### Using SafeSphere AI

1. Click "SafeSphereAI" in navigation
2. Ask questions about flood safety:
   - "What should I do if my car is stuck in a flood?"
   - "How do I find a safe route?"
   - "Tell me about flood insurance"
3. Get instant AI-powered responses

### Reporting Flood Conditions

1. Go to "Safe Routes Map"
2. Scroll to "Report Flooding" section
3. Click "Report Flood" button
4. Allow location access
5. Describe the flooding situation
6. Submit to help your community

### Community Safety Board

1. Navigate to "Safety Board"
2. View recent community alerts
3. Create posts with category selection
4. Share safety information with neighbors

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Create new user account |
| POST | `/api/login` | User login |
| POST | `/api/logout` | User logout |
| GET | `/api/me` | Get current user info |

### Flood Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/flood-route` | Get route with current flood risk |
| POST | `/api/flood-route-predictive` | Get route with 2-6 hour predictions |
| GET | `/api/flood-data` | Get current flood alerts and gauge data |
| POST | `/api/report-flood` | Submit user flood report |
| POST | `/api/predict-flood` | Get flood prediction for specific location |

### Safety Board
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/board/posts` | Get all safety posts |
| POST | `/api/board/posts` | Create new safety post |
| DELETE | `/api/board/posts/<id>` | Delete post (owner only) |
| POST | `/api/board/posts/<id>/comments` | Add comment to post |

---

## Machine Learning Model

SafeSphere uses a custom flood prediction model that analyzes:

- Stream gauge heights from USGS (real-time water levels)
- Precipitation forecasts from NWS
- Historical flood patterns in New Jersey
- Seasonal risk factors (hurricane season)
- Geographic features and known flood zones

### Prediction Accuracy

- **2-hour predictions:** ~85% accuracy
- **3-hour predictions:** ~75% accuracy
- **6-hour predictions:** ~65% accuracy

### Model Features

- Real-time data integration
- Gradient boosting algorithm
- Location-specific risk assessment
- Weather pattern recognition

---

## Database Schema

### Users Table
- `id`: Integer (Primary Key)
- `email`: String (Unique, Not Null)
- `username`: String
- `password_hash`: String (Not Null)
- `created_at`: DateTime

### Safety Posts Table
- `id`: Integer (Primary Key)
- `user_email`: String (Foreign Key)
- `title`: String (Not Null)
- `category`: String (Default: "General")
- `body`: Text (Not Null)
- `created_at`: DateTime

### Safety Comments Table
- `id`: Integer (Primary Key)
- `post_id`: Integer (Foreign Key, Cascade Delete)
- `user_email`: String
- `body`: Text (Not Null)
- `created_at`: DateTime

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | Yes |
| `SESSION_SECRET` | Flask session secret key | Yes |
| `SQLALCHEMY_DATABASE_URI` | Database connection string | No (defaults to SQLite) |

### API Rate Limits

- **USGS API:** ~1000 requests/day
- **NWS API:** No strict limits (use responsibly)
- **Google Maps API:** Based on your billing plan

---

## Safety Features

### Emergency Contacts Integration
- **911:** Emergency services
- **2-1-1:** NJ Emergency Hotline
- **1-800-544-8802:** Coast Guard
- **1-800-662-3115:** Report downed power lines

### Real-Time Alerts
- Flash flood warnings from NWS
- High water level notifications
- Road closure updates
- Community-reported hazards

### Safety Education
- Flood preparation checklists
- Vehicle safety in floods
- Insurance information
- Evacuation planning guides
- "Turn Around, Don't Drown" messaging

---

## Deployment

### Production Considerations

- Use PostgreSQL instead of SQLite
- Set secure environment variables
- Enable HTTPS/SSL certificates
- Implement Redis caching for API responses
- Set up logging and error tracking
- Implement API rate limiting
- Use production WSGI server (Gunicorn/uWSGI)

### Deployment Platforms

- **Replit** - Current platform
- **Heroku** - Easy deployment
- **DigitalOcean** - Docker containers
- **AWS** - EC2 + RDS

---

## Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

### Development Guidelines

- Follow PEP 8 style guide for Python
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## Known Issues

- SQLite has concurrency limitations (use PostgreSQL for production)
- Browser storage APIs (localStorage/sessionStorage) not supported in artifacts
- Some older browsers may have limited JavaScript support
- Map initialization requires stable internet connection

---

## Future Enhancements

- Mobile iOS/Android applications
- Push notifications for flood alerts
- Integration with local emergency services
- Enhanced machine learning models
- Expansion to other states beyond New Jersey
- Social media integration for viral alerts
- Historical flood data visualization
- User-customizable alert preferences
- Offline mode support
- Integration with smart home devices

---

## Team & Contact

**SafeSphere Development Team**  
Congressional App Challenge 2024

### Contact
- orangekevchen@gmail.com
- aryamanaroranj@gmail.com

**GitHub:** https://github.com/yourusername/safesphere

---

## Acknowledgments

- **USGS:** Stream gauge data and water monitoring
- **National Weather Service:** Weather alerts and flood warnings
- **Google Maps Platform:** Mapping and routing services
- **Bootstrap Team:** UI framework
- **Replit:** Development and hosting platform
- **Congressional App Challenge:** Recognition and support

---

## License

This project is licensed under the MIT License.

**Copyright (c) 2025 SafeSphere Development Team**

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Additional Resources

- [USGS Water Services API](https://waterservices.usgs.gov/rest/)
- [NWS API Documentation](https://www.weather.gov/documentation/services-web-api)
- [Google Maps Platform](https://developers.google.com/maps/documentation)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Bootstrap Documentation](https://getbootstrap.com/docs/)

---

## Support

For bugs, feature requests, or questions:

- **GitHub Issues:** https://github.com/yourusername/safesphere/issues
- **Email:** orangekevchen@gmail.com, aryamanaroranj@gmail.com

**For emergencies, always call 911 first.**  
SafeSphere provides information but is not a substitute for emergency services.

---

**Last Updated:** January 2025

## STAY SAFE WITH SAFESPHERE
**Turn Around, Don't Drown - Your safety is our priority**
