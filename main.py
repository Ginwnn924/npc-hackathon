from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
# import google.generativeai as genai
import httpx
import os
from dotenv import load_dotenv
load_dotenv()
from datetime import datetime, timedelta
import math
import google.generativeai as genai
# try to import OR-Tools
try:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    ORTOOLS_AVAILABLE = True
except Exception:
    ORTOOLS_AVAILABLE = False


# Configure Gemini AI
genai.configure(api_key="AIzaSyBtQk3Y4cpzXUg-NQQZbjvuWdCpGZMjt4s")



app = FastAPI(title="Vietmap Places Search API with AI")

# CORS configuration: cho phép frontend Next.js chạy ở localhost:3000 gọi API
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # Thêm domain production ở đây nếu cần, ví dụ: "https://yourdomain.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mapping categories -> keywords (đổi tên từ data -> CATEGORY_MAPPING)
CATEGORY_MAPPING = {
    "1001": ["Quán Giải Khát"],
    "1002": ["Nhà Hàng Quán Ăn"],
    "1003": ["Khu Ăn Uống"],
    "2000": ["Khách Sạn", "Nhà Nghỉ"],
    "2001": ["Khách Sạn"],
    "2002": ["Nhà Nghỉ"],
    "3004": ["Cửa Hàng Cửa Tiệm"],
    "4004": ["Du Lịch"],
    "4001-3": ["Văn Hóa", "Trung Tâm Văn Hóa Thể Thao"],
    "4001-4": ["Văn Hóa", "Thư Viện"],
    "4001-5": ["Văn Hóa", "Bảo Tàng"],
    "4002-2": ["Giải Trí", "Công Viên"],
    "4002-6": ["Giải Trí", "Bar Pub"],
    "4002-10": ["Giải Trí", "Bida"],
    "4002-11": ["Giải Trí", "Karaoke"],
    "4002-14": ["Giải Trí", "Khu Vui Chơi Giải Trí"],
    "4003-1": ["Làm Đẹp", "Hair Salon"],
    "4003-2": ["Làm Đẹp", "Spa"],
    "4003-3": ["Làm Đẹp", "Xông Hơi Massage"],
    "4004-1": ["Du Lịch", "Di Tích Văn Hóa Lịch Sử"],
    "4004-2": ["Du Lịch", "Danh Lam Thắng Cảnh"],
    "4004-3": ["Du Lịch", "Vườn Quốc Gia"],
    "4004-5": ["Du Lịch", "Khu Du Lịch"],
    "4004-6": ["Du Lịch", "Bãi Biển"],
    "4004-7": ["Du Lịch", "Địa Danh"],
    "4004-8": ["Du Lịch", "Điểm Du Lịch"]
}

# Models
class Location(BaseModel):
    lat: float
    lng: float

class SearchRequest(BaseModel):
    location: Location
    categories: List[str]

class Place(BaseModel):
    name: str
    address: str

class AIRecommendationRequest(BaseModel):
    location: Location
    user_query: str  # e.g., "Tìm quán cafe lãng mạn", "Nơi ăn tối cho gia đình"
    max_results: Optional[int] = 5


class SelectedPlace(BaseModel):
    name: Optional[str]
    address: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    visit_minutes: Optional[int] = 30


class ScheduleRequest(BaseModel):
    start_location: Location
    places: List[SelectedPlace]
    start_time: Optional[str] = "08:00"  # hh:mm
    end_time: Optional[str] = "18:00"

# Helper function for AI
async def get_ai_recommendation(user_query: str, places_data: list) -> dict:
    """
    Sử dụng Gemini AI để phân tích query của user và recommend địa điểm phù hợp
    """
    if not model:
        return {
            "ai_enabled": False,
            "message": "AI service not configured",
            "recommendations": places_data[:5]
        }
    
    try:
        # Tạo prompt cho AI
        places_summary = "\n".join([
            f"{i+1}. {p.get('name', 'N/A')} - {p.get('address', 'N/A')} (Distance: {p.get('distance', 0)}m)"
            for i, p in enumerate(places_data[:20])
        ])
        
        prompt = f"""
                Bạn là một trợ lý du lịch thông minh. Người dùng đang tìm kiếm: "{user_query}"

                Dưới đây là danh sách các địa điểm gần đó:
                {places_summary}

                Hãy phân tích yêu cầu của người dùng và:
                1. Chọn ra 3-5 địa điểm PHÙ HỢP NHẤT
                2. Giải thích ngắn gọn tại sao những địa điểm này phù hợp
                3. Sắp xếp theo mức độ phù hợp (không nhất thiết theo khoảng cách)

                Trả về dưới dạng JSON với format:
                {{
                "analysis": "Phân tích ngắn gọn về yêu cầu",
                "recommendations": [
                    {{
                    "rank": 1,
                    "place_name": "Tên địa điểm",
                    "reason": "Lý do recommend"
                    }}
                ]
                }}
                """
        
        response = model.generate_content(prompt)
        ai_text = response.text
        
        # Parse JSON từ response
        import json
        # Tìm JSON trong response (có thể có markdown code block)
        if "```json" in ai_text:
            ai_text = ai_text.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_text:
            ai_text = ai_text.split("```")[1].split("```")[0].strip()
        
        ai_result = json.loads(ai_text)
        
        return {
            "ai_enabled": True,
            "analysis": ai_result.get("analysis", ""),
            "recommendations": ai_result.get("recommendations", []),
            "raw_places": places_data
        }
        
    except Exception as e:
        print(f"AI Error: {str(e)}")
        return {
            "ai_enabled": True,
            "error": str(e),
            "recommendations": places_data[:5]
        }



# Endpoints
@app.post("/search")
async def search_places(request: SearchRequest):
    """
    Tìm kiếm địa điểm dựa trên location và categories
    """
    # Lấy keywords từ categories
    keywords = []
    for code in request.categories:
        if code in CATEGORY_MAPPING:  # Dùng CATEGORY_MAPPING thay vì data
            keywords.extend(CATEGORY_MAPPING[code])
    
    # Loại bỏ trùng lặp
    keywords = list(dict.fromkeys(keywords))
    
    if not keywords:
        raise HTTPException(status_code=400, detail="Không tìm thấy keywords cho categories đã cho")
    
    # Kết hợp keywords thành text parameter
    text_param = " ".join(keywords)
    
    # Gọi Vietmap API
    # Gọi Vietmap API
    url = "https://maps.vietmap.vn/api/search/v3"

    try:
        all_results = []
        
        # Gọi API cho từng category
        async with httpx.AsyncClient() as client:
            for category in request.categories:
                params = {
                    "apikey": "4760087f980b480d9efaf4fb02c649ac9f69fc462c01d149",
                    "text": '%2',
                    "focus": f"{request.location.lat},{request.location.lng}",
                    "circle_center": f"{request.location.lat},{request.location.lng}",
                    "circle_radius": 20000,
                    "cats": category  # Mỗi lần 1 category
                }
                
                request_obj = client.build_request("GET", url, params=params)
                full_url = str(request_obj.url)
                print(f"Full URL cho category {category}: {full_url}")
                
                response = await client.get(url, params=params, timeout=30.0)
                response.raise_for_status()
                
                result_data = response.json()
                
                # Nếu là list thì extend vào all_results
                if isinstance(result_data, list):
                    all_results.extend(result_data)
        
        # Loại bỏ trùng lặp dựa trên ref_id
        unique_results = {}
        for item in all_results:
            ref_id = item.get("ref_id")
            if ref_id and ref_id not in unique_results:
                unique_results[ref_id] = item
        
        # Chỉ giữ lại các field cần thiết
        fields_to_keep = ["ref_id", "distance", "address", "name", "display"]
        
        filtered_results = []

        for item in unique_results.values():
            new_dict = {}
            for key in fields_to_keep:
                new_dict[key] = item.get(key)
            new_dict['url'] = f"https://www.google.com/maps/search/?api=1&query={item.get('display', '').replace(' ', '+')}"
            filtered_results.append(new_dict)
        # filtered_results.sort(key=lambda x: x.get("distance", 0))

        # return filtered_results[:10]
        return filtered_results
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi gọi Vietmap API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi không xác định: {str(e)}")


    async def _find_place_by_text(client: httpx.AsyncClient, query: str, api_key: str):
        url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
        params = {'query': query, 'key': api_key}
        resp = await client.get(url, params=params, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()
        results = data.get('results', [])
        if not results:
            return None
        first = results[0]
        loc = first.get('geometry', {}).get('location', {})
        return {
            'name': first.get('name'),
            'address': first.get('formatted_address'),
            'lat': loc.get('lat'),
            'lng': loc.get('lng'),
            'place_id': first.get('place_id')
        }


    async def _distance_matrix(client: httpx.AsyncClient, locations: list, api_key: str):
        # locations: list of (lat,lng) tuples
        origins = [f"{lat},{lng}" for lat, lng in locations]
        destinations = origins
        url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
        params = {
            'origins': '|'.join(origins),
            'destinations': '|'.join(destinations),
            'key': api_key,
            'units': 'metric'
        }
        resp = await client.get(url, params=params, timeout=30.0)
        resp.raise_for_status()
        data = resp.json()
        # parse durations in seconds
        rows = data.get('rows', [])
        n = len(rows)
        matrix = [[0] * n for _ in range(n)]
        for i, row in enumerate(rows):
            elements = row.get('elements', [])
            for j, elem in enumerate(elements):
                if elem.get('status') != 'OK':
                    matrix[i][j] = int(1e9)
                else:
                    matrix[i][j] = int(elem.get('duration', {}).get('value', 0))
        return matrix


    @app.post('/schedule')
    async def build_schedule(req: ScheduleRequest):
        """
        Build a schedule: resolve place locations via Google Places if necessary, fetch travel times via Distance Matrix,
        then compute an optimized visit order (uses OR-Tools when available, otherwise a nearest-neighbor fallback).
        Returns arrival/departure times for each place.
        """
        api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        if not api_key:
            raise HTTPException(status_code=400, detail='GOOGLE_MAPS_API_KEY not configured')

        places = []
        async with httpx.AsyncClient() as client:
            # resolve places lat/lng
            for p in req.places:
                if p.lat is not None and p.lng is not None:
                    places.append({'name': p.name or '', 'address': p.address or '', 'lat': p.lat, 'lng': p.lng, 'visit_minutes': p.visit_minutes or 30})
                else:
                    # try text search by name or address
                    q = p.name or p.address
                    if not q:
                        raise HTTPException(status_code=400, detail='Place must have a name/address or lat/lng')
                    found = await _find_place_by_text(client, q, api_key)
                    if not found:
                        raise HTTPException(status_code=404, detail=f'Không tìm thấy địa điểm: {q}')
                    places.append({'name': found.get('name'), 'address': found.get('address'), 'lat': found.get('lat'), 'lng': found.get('lng'), 'visit_minutes': p.visit_minutes or 30})

            # build locations array (start + places)
            locations = [(req.start_location.lat, req.start_location.lng)] + [(p['lat'], p['lng']) for p in places]

            # get travel time matrix (seconds)
            matrix = await _distance_matrix(client, locations, api_key)

        n = len(locations)

        # create route order: start at 0, visit 1..n-1
        order = []
        if ORTOOLS_AVAILABLE and n > 1:
            manager = pywrapcp.RoutingIndexManager(n, 1, 0)
            routing = pywrapcp.RoutingModel(manager)

            def distance_callback(from_index, to_index):
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                return matrix[from_node][to_node]

            transit_callback_index = routing.RegisterTransitCallback(distance_callback)
            routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

            search_parameters = pywrapcp.DefaultRoutingSearchParameters()
            search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
            search_parameters.time_limit.FromSeconds(5)

            solution = routing.SolveWithParameters(search_parameters)
            if solution:
                index = routing.Start(0)
                while not routing.IsEnd(index):
                    node = manager.IndexToNode(index)
                    order.append(node)
                    index = solution.Value(routing.NextVar(index))
                # add final end node
                order.append(manager.IndexToNode(index))
            else:
                # fallback to sequential
                order = list(range(n))
        else:
            # greedy nearest neighbor
            unvisited = set(range(1, n))
            cur = 0
            order.append(0)
            while unvisited:
                next_node = min(unvisited, key=lambda x: matrix[cur][x])
                order.append(next_node)
                unvisited.remove(next_node)
                cur = next_node

        # compute arrival/departure times
        def parse_hhmm(s):
            t = datetime.strptime(s, '%H:%M')
            return t.hour * 60 + t.minute

        start_minutes = parse_hhmm(req.start_time)
        current_minutes = start_minutes
        result = []
        for idx_pos, node in enumerate(order[1:]):
            prev = order[idx_pos]
            travel_seconds = matrix[prev][node]
            travel_minutes = math.ceil(travel_seconds / 60)
            arrival = current_minutes + travel_minutes
            place = places[node - 1]
            visit = place.get('visit_minutes', 30)
            departure = arrival + visit
            result.append({
                'index': node,
                'name': place.get('name'),
                'address': place.get('address'),
                'lat': place.get('lat'),
                'lng': place.get('lng'),
                'arrival_time': f"{arrival // 60:02d}:{arrival % 60:02d}",
                'departure_time': f"{departure // 60:02d}:{departure % 60:02d}",
                'travel_seconds_from_prev': travel_seconds
            })
            current_minutes = departure

        return {
            'ordered': result,
            'method': 'ortools' if ORTOOLS_AVAILABLE else 'greedy'
        }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)