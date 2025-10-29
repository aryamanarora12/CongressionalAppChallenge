# flood_prediction.py - Realistic probabilities

import numpy as np
from datetime import datetime, timedelta
from typing import List, Tuple, Dict
import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FloodPredictor:
    """
    Realistic flood prediction with lower, more accurate probabilities.
    NJ floods are rare events - typical risk should be very low.
    """

    def __init__(self):
        self.last_update = None

    def predict_route_segments(self, route_points: List[Tuple[float, float]], hours_ahead: int = 3) -> List[Dict]:
        """
        Predict risk for route segments - called by main.py
        """
        predictions = []

        for i, (lat, lng) in enumerate(route_points):
            prediction = self.predict_flood_risk(lat, lng, hours_ahead)
            prediction['segment_index'] = i
            predictions.append(prediction)

        return predictions

    def predict_flood_risk(self, latitude: float, longitude: float, hours_ahead: int = 3) -> Dict:
        current_time = datetime.now()
        prediction_time = current_time + timedelta(hours=hours_ahead)

        # Get real data
        gauge_height = self.get_stream_gauge(latitude, longitude)
        precipitation = self.get_precipitation(latitude, longitude)
        risk_score = 0.02  
        if gauge_height > 15: 
            risk_score += 0.50
        elif gauge_height > 12: 
            risk_score += 0.30
        elif gauge_height > 10: 
            risk_score += 0.15
        elif gauge_height > 8: 
            risk_score += 0.08
        elif gauge_height > 6:  
            risk_score += 0.03
        if precipitation > 4:  
            risk_score += 0.40
        elif precipitation > 3:  
            risk_score += 0.20
        elif precipitation > 2: 
            risk_score += 0.10
        elif precipitation > 1:  
            risk_score += 0.03
        if 39.35 < latitude < 39.38 and -74.44 < longitude < -74.41:
            risk_score += 0.05
        # Hoboken (historically flood-prone)
        elif 40.73 < latitude < 40.76 and -74.04 < longitude < -74.02:
            risk_score += 0.05
        # Toms River area
        elif 39.95 < latitude < 40.00 and -74.20 < longitude < -74.18:
            risk_score += 0.03

        # Time of year factor (hurricane season)
        month = prediction_time.month
        if month in [8, 9, 10]:  # Aug-Oct hurricane season
            risk_score += 0.02

        # Cap at reasonable maximum (even worst case rarely exceeds 80%)
        risk_score = min(0.80, risk_score)

        # Determine risk level with realistic thresholds
        if risk_score >= 0.50:  # 50%+ is high risk (very rare)
            risk_level = 'high'
        elif risk_score >= 0.15:  # 15%+ is medium risk
            risk_level = 'medium'
        else:  # < 15% is low risk (most common)
            risk_level = 'low'

        # Generate realistic explanations
        key_factors = []

        if gauge_height > 8:
            key_factors.append(f"Stream gauge elevated: {gauge_height:.1f} ft")
        elif gauge_height > 6:
            key_factors.append(f"Stream gauge above normal: {gauge_height:.1f} ft")

        if precipitation > 2:
            key_factors.append(f"Heavy rain forecast: {precipitation:.1f} inches")
        elif precipitation > 1:
            key_factors.append(f"Moderate rain expected: {precipitation:.1f} inches")

        # Most of the time, conditions are normal
        if not key_factors:
            if risk_score < 0.05:
                key_factors.append("Normal conditions - minimal flood risk")
            else:
                key_factors.append("Slightly elevated conditions")

        # Return format expected by frontend
        return {
            'location': {'lat': latitude, 'lng': longitude},
            'risk_level': risk_level,
            'risk_score': float(risk_score),
            'confidence': 0.70,  # Reasonable confidence
            'prediction_time': prediction_time.isoformat(),
            'hours_ahead': hours_ahead,
            'key_factors': key_factors[:3],
            'current_time': current_time.isoformat()
        }

    def get_stream_gauge(self, lat: float, lng: float) -> float:
        """
        Get real USGS stream gauge.
        Normal levels are typically 2-5 feet.
        """
        try:
            params = {
                'format': 'json',
                'stateCd': 'nj',
                'parameterCd': '00065',
                'siteStatus': 'active'
            }

            response = requests.get(
                'https://waterservices.usgs.gov/nwis/iv/',
                params=params,
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()

                closest_height = 3.5  # Normal level
                min_distance = float('inf')

                if 'value' in data and 'timeSeries' in data['value']:
                    for series in data['value']['timeSeries']:
                        try:
                            site_info = series.get('sourceInfo', {})
                            geo = site_info.get('geoLocation', {}).get('geogLocation', {})
                            gauge_lat = float(geo.get('latitude', 0))
                            gauge_lng = float(geo.get('longitude', 0))

                            if gauge_lat and gauge_lng:
                                dist = np.sqrt((lat - gauge_lat)**2 + (lng - gauge_lng)**2)

                                values = series.get('values', [{}])[0].get('value', [])
                                if values and dist < min_distance:
                                    height = float(values[-1].get('value', 3.5))
                                    if 0 < height < 50:  # Sanity check
                                        closest_height = height
                                        min_distance = dist
                        except:
                            continue

                return closest_height

        except Exception as e:
            logger.debug(f"USGS error: {e}")

        # Return normal level
        return 3.5

    def get_precipitation(self, lat: float, lng: float) -> float:
        """
        Get realistic precipitation amounts.
        Most days have 0 precipitation.
        """
        try:
            response = requests.get(
                f'https://api.weather.gov/points/{lat},{lng}',
                timeout=3
            )

            if response.status_code == 200:
                data = response.json()
                forecast_url = data.get('properties', {}).get('forecast')

                if forecast_url:
                    forecast_resp = requests.get(forecast_url, timeout=3)
                    if forecast_resp.status_code == 200:
                        forecast_data = forecast_resp.json()
                        periods = forecast_data.get('properties', {}).get('periods', [])

                        if periods:
                            forecast_text = periods[0].get('detailedForecast', '').lower()

                            # More realistic precipitation estimates
                            if 'flood' in forecast_text:
                                return 4.0  # Actual flood warning
                            elif 'heavy rain' in forecast_text:
                                return 2.5
                            elif 'thunderstorm' in forecast_text:
                                return 1.5
                            elif 'rain' in forecast_text or 'shower' in forecast_text:
                                return 0.8
                            elif 'drizzle' in forecast_text or 'light rain' in forecast_text:
                                return 0.2
                            else:
                                return 0.0  # No rain

        except Exception as e:
            logger.debug(f"Weather error: {e}")

        # Most days have no significant precipitation
        return 0.0

# Global instance for main.py
flood_predictor = FloodPredictor()