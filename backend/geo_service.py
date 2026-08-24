import math
import requests
from typing import Dict, Any, List, Optional
from .database import get_db
from .models import DuplicateCheckResponse, DuplicateMatch, ReverseGeocodeResponse

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points in meters
    """
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

# Known Indian Smart City reference zones (Guntur / AP / Urban reference grids)
LOCAL_LANDMARK_ZONES = [
    {"name": "Lakshmipuram Main Road", "area": "Lakshmipuram", "city": "Guntur", "district": "Guntur", "state": "Andhra Pradesh", "pincode": "522007", "lat": 16.3142, "lng": 80.4350},
    {"name": "Brodipet 4/2 Cross Road", "area": "Brodipet", "city": "Guntur", "district": "Guntur", "state": "Andhra Pradesh", "pincode": "522002", "lat": 16.3075, "lng": 80.4420},
    {"name": "Arundelpet 6th Line", "area": "Arundelpet", "city": "Guntur", "district": "Guntur", "state": "Andhra Pradesh", "pincode": "522002", "lat": 16.3012, "lng": 80.4385},
    {"name": "Collectorate Office Circle", "area": "Nagarampalem", "city": "Guntur", "district": "Guntur", "state": "Andhra Pradesh", "pincode": "522004", "lat": 16.2980, "lng": 80.4452},
    {"name": "Old Club Road, Near Municipal Corporation", "area": "Kothapet", "city": "Guntur", "district": "Guntur", "state": "Andhra Pradesh", "pincode": "522001", "lat": 16.3060, "lng": 80.4530},
    {"name": "Inner Ring Road Junction", "area": "Autonagar", "city": "Guntur", "district": "Guntur", "state": "Andhra Pradesh", "pincode": "522006", "lat": 16.3280, "lng": 80.4610},
    {"name": "Amaravati Seed Access Road", "area": "Thullur", "city": "Amaravati", "district": "Guntur", "state": "Andhra Pradesh", "pincode": "522237", "lat": 16.5130, "lng": 80.5160},
    {"name": "MG Road, Benz Circle", "area": "Benz Circle", "city": "Vijayawada", "district": "NTR", "state": "Andhra Pradesh", "pincode": "520010", "lat": 16.4975, "lng": 80.6550},
    {"name": "HITEC City Main Boulevard", "area": "Madhapur", "city": "Hyderabad", "district": "Hyderabad", "state": "Telangana", "pincode": "500081", "lat": 17.4474, "lng": 78.3762}
]

def reverse_geocode(lat: float, lng: float) -> ReverseGeocodeResponse:
    """
    Reverse geocode GPS coordinates to a formatted Indian address
    """
    # 1. Check proximity to local landmark zones (< 8000m)
    closest_zone = None
    min_dist = float('inf')
    
    for zone in LOCAL_LANDMARK_ZONES:
        dist = haversine_distance(lat, lng, zone["lat"], zone["lng"])
        if dist < min_dist:
            min_dist = dist
            closest_zone = zone
            
    if closest_zone and min_dist < 6000:
        offset_desc = f"{closest_zone['name']}, {closest_zone['area']}, {closest_zone['city']}, {closest_zone['state']} - {closest_zone['pincode']}"
        return ReverseGeocodeResponse(
            address=offset_desc,
            street=closest_zone["name"],
            area=closest_zone["area"],
            city=closest_zone["city"],
            district=closest_zone["district"],
            state=closest_zone["state"],
            postal_code=closest_zone["pincode"],
            country="India"
        )
    
    # 2. Try OpenStreetMap Nominatim reverse geocoder
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lng}"
        headers = {"User-Agent": "CivicPlatform-SmartMonitoring/2.0"}
        res = requests.get(url, headers=headers, timeout=2.5)
        if res.status_code == 200:
            data = res.json()
            address_obj = data.get("address", {})
            street = address_obj.get("road") or address_obj.get("suburb") or address_obj.get("neighbourhood") or "Municipal Main Road"
            area = address_obj.get("suburb") or address_obj.get("city_district") or "Civic Ward 12"
            city = address_obj.get("city") or address_obj.get("town") or address_obj.get("village") or "Guntur"
            state = address_obj.get("state") or "Andhra Pradesh"
            postal_code = address_obj.get("postcode") or "522002"
            display_name = data.get("display_name", f"{street}, {area}, {city}, {state}")
            
            return ReverseGeocodeResponse(
                address=display_name,
                street=street,
                area=area,
                city=city,
                district=address_obj.get("state_district", city),
                state=state,
                postal_code=postal_code,
                country=address_obj.get("country", "India")
            )
    except Exception as e:
        print(f"Nominatim lookup timed out or failed: {e}")

    # Fallback default formatted location
    return ReverseGeocodeResponse(
        address=f"Near Coordinates ({round(lat, 4)}, {round(lng, 4)}), Guntur, Andhra Pradesh",
        street="Municipal Arterial Road",
        area="Smart City Zone 3",
        city="Guntur",
        district="Guntur",
        state="Andhra Pradesh",
        postal_code="522002",
        country="India"
    )

def check_duplicate_complaints(lat: float, lng: float, issue_type: str, radius_meters: float = 100.0) -> DuplicateCheckResponse:
    """
    Check if a similar complaint already exists within the given radius (meters)
    """
    matches: List[DuplicateMatch] = []
    
    with get_db() as conn:
        cursor = conn.cursor()
        # Query active complaints (not yet resolved or rejected)
        cursor.execute("""
            SELECT complaint_id, issue_type, latitude, longitude, status, image_url, created_at
            FROM complaints
            WHERE status NOT IN ('RESOLVED', 'REJECTED')
        """)
        rows = cursor.fetchall()
        
        for row in rows:
            dist = haversine_distance(lat, lng, row["latitude"], row["longitude"])
            if dist <= radius_meters:
                # Match identical or structurally related issues (e.g. Pothole & Broken Road)
                same_issue = (row["issue_type"].lower() == issue_type.lower()) or \
                             ("road" in row["issue_type"].lower() and "road" in issue_type.lower()) or \
                             ("drain" in row["issue_type"].lower() and "drain" in issue_type.lower())
                
                if same_issue:
                    matches.append(DuplicateMatch(
                        complaint_id=row["complaint_id"],
                        issue_type=row["issue_type"],
                        distance_meters=round(dist, 1),
                        status=row["status"],
                        image_url=row["image_url"],
                        created_at=str(row["created_at"])
                    ))
                    
    # Sort matches by closest distance
    matches.sort(key=lambda m: m.distance_meters)
    
    if matches:
        return DuplicateCheckResponse(
            is_duplicate=True,
            message=f"Similar complaint ({matches[0].issue_type} - {matches[0].complaint_id}) already reported {matches[0].distance_meters}m away.",
            matches=matches
        )
    else:
        return DuplicateCheckResponse(
            is_duplicate=False,
            message="No duplicate complaints detected nearby.",
            matches=[]
        )
