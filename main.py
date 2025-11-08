from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import google.generativeai as genai
import httpx
from fastapi.responses import StreamingResponse
import json
import asyncio
import traceback
from datetime import datetime
import requests



# Configure Gemini AI
genai.configure(api_key="AIzaSyBtQk3Y4cpzXUg-NQQZbjvuWdCpGZMjt4s")
model = genai.GenerativeModel('gemini-2.5-flash')

# Helper function để dùng Gemini tìm giờ mở cửa
async def get_place_hours_with_gemini(place_name: str, address: str) -> Dict:
    """
    Sử dụng Gemini AI để tìm kiếm thông tin giờ mở cửa/đóng cửa của địa điểm
    """
    try:
        prompt = f"""
Hãy tìm kiếm thông tin về địa điểm sau trên Google Maps hoặc các nguồn trực tuyến:

Tên: {place_name}
Địa chỉ: {address}

Nhiệm vụ:
1. Tìm giờ mở cửa và đóng cửa của địa điểm này
2. Xác định địa điểm có mở cửa vào các ngày trong tuần không
3. Nếu là di tích lịch sử, bảo tàng, công viên thì thường mở cửa giờ nào
4. Nếu không tìm thấy thông tin chính xác, hãy ước lượng dựa trên loại hình địa điểm

Trả về ĐÚNG format JSON sau (KHÔNG thêm text khác):
{{
    "found": true,
    "place_name": "Tên chính xác của địa điểm",
    "opening_hours": {{
        "monday": "08:00 - 17:00",
        "tuesday": "08:00 - 17:00",
        "wednesday": "08:00 - 17:00",
        "thursday": "08:00 - 17:00",
        "friday": "08:00 - 17:00",
        "saturday": "08:00 - 17:00",
        "sunday": "08:00 - 17:00"
    }},
    "is_open_now": true,
    "weekday_text": [
        "Thứ Hai: 08:00 - 17:00",
        "Thứ Ba: 08:00 - 17:00",
        "Thứ Tư: 08:00 - 17:00",
        "Thứ Năm: 08:00 - 17:00",
        "Thứ Sáu: 08:00 - 17:00",
        "Thứ Bảy: 08:00 - 17:00",
        "Chủ Nhật: 08:00 - 17:00"
    ],
    "notes": "Ghi chú về giờ mở cửa (nếu có)",
    "source": "Google Maps / Website chính thức / Ước lượng"
}}

Nếu KHÔNG tìm thấy hoặc không chắc chắn, trả về:
{{
    "found": false,
    "place_name": "{place_name}",
    "message": "Không tìm thấy thông tin giờ mở cửa",
    "estimated_hours": "08:00 - 17:00 (ước lượng)",
    "notes": "Nên gọi điện xác nhận trước khi đến"
}}
"""
        
        response = model.generate_content(prompt)
        ai_text = response.text
        
        # Parse JSON từ response
        import json
        if "```json" in ai_text:
            ai_text = ai_text.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_text:
            ai_text = ai_text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(ai_text)
        return result
        
    except Exception as e:
        print(f"Error getting place hours with Gemini: {str(e)}")
        return {
            "found": False,
            "place_name": place_name,
            "error": str(e),
            "message": "Lỗi khi tìm kiếm thông tin",
            "estimated_hours": "08:00 - 17:00 (ước lượng)"
        }



app = FastAPI(title="Vietmap Places Search API with AI")

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
        fields_to_keep = ["ref_id", "distance", "address", "name", "display", "categories"]
        
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

class PlaceForSchedule(BaseModel):
    ref_id: str
    name: str
    address: str
    distance: float
    url: Optional[str] = None

class ScheduleRequest(BaseModel):
    places: List[PlaceForSchedule]
    start_time: Optional[str] = "09:00"  # Thời gian bắt đầu mặc định
    visit_date: Optional[str] = None  # Ngày tham quan (format: YYYY-MM-DD)


@app.post("/schedule")
async def create_schedule(request: ScheduleRequest):
    """
    Stream kết quả lập lịch - gửi từng địa điểm ngay khi AI xử lý xong
    """
    async def event_stream():
        try:
            # B1: Bắt đầu
            yield f"data: {json.dumps({'status': 'processing', 'message': 'Bắt đầu lập lịch tham quan...'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.3)
            
            # B2: Lấy giờ mở cửa cho từng địa điểm
            places_with_hours = []
            for idx, place in enumerate(request.places, start=1):
                msg = f"🔍 Đang lấy giờ mở cửa cho {place.name} ({idx}/{len(request.places)})..."
                yield f"data: {json.dumps({'status': 'fetching_hours', 'place': place.name, 'message': msg, 'progress': idx, 'total': len(request.places)}, ensure_ascii=False)}\n\n"
                
                # Giả lập lấy giờ mở cửa (thay bằng API thật)
                hours_info = {
                    "found": True,
                    "opening_hours": {
                        "monday": "08:00 - 17:00",
                        "tuesday": "08:00 - 17:00",
                        "wednesday": "08:00 - 17:00",
                        "thursday": "08:00 - 17:00",
                        "friday": "08:00 - 17:00",
                        "saturday": "08:00 - 17:00",
                        "sunday": "08:00 - 17:00"
                    },
                    "is_open_now": True,
                    "weekday_text": [
                        "Thứ Hai: 08:00 - 17:00",
                        "Thứ Ba: 08:00 - 17:00",
                        "Thứ Tư: 08:00 - 17:00",
                        "Thứ Năm: 08:00 - 17:00",
                        "Thứ Sáu: 08:00 - 17:00",
                        "Thứ Bảy: 08:00 - 17:00",
                        "Chủ Nhật: 08:00 - 17:00"
                    ],
                    "notes": "Giờ mở cửa bình thường",
                    "source": "Google Maps"
                }
                
                place_info = {
                    "ref_id": place.ref_id,
                    "name": place.name,
                    "address": place.address,
                    "distance": place.distance,
                    "url": place.url,
                    "found": True,
                    "opening_hours": hours_info.get('opening_hours', {}),
                    "is_open_now": hours_info.get('is_open_now', None),
                    "weekday_text": hours_info.get('weekday_text', []),
                    "notes": hours_info.get('notes', ''),
                    "source": hours_info.get('source', 'Google Maps')
                }
                places_with_hours.append(place_info)
                
                yield f"data: {json.dumps({'status': 'place_hours_ready', 'data': place_info}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.2)
            
            # B3: Thông báo bắt đầu lập lịch bằng AI
            yield f"data: {json.dumps({'status': 'ai_start', 'message': f'Bắt đầu lập lịch cho {len(places_with_hours)} địa điểm...', 'total_places': len(places_with_hours)}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.5)
            
            # B4: Lập lịch TỪNG địa điểm và stream ngay
            schedule_items = []
            
            for idx, place in enumerate(places_with_hours, start=1):
                # Thông báo đang xử lý địa điểm này
                msg = f"🤖 AI đang lập lịch cho {place['name']} ({idx}/{len(places_with_hours)})"
                yield f"data: {json.dumps({'status': 'ai_processing_place', 'place': place['name'], 'message': msg, 'progress': idx, 'total': len(places_with_hours)}, ensure_ascii=False)}\n\n"
                
                # Tạo prompt cho TỪNG địa điểm
                prompt = create_single_place_schedule_prompt(request, place, idx, len(places_with_hours), schedule_items)
                
                try:
                    response = model.generate_content(prompt)
                    ai_text = response.text
                    
                    # Clean markdown
                    ai_text = ai_text.strip()
                    if ai_text.startswith("```json"):
                        ai_text = ai_text[7:]
                    if ai_text.startswith("```"):
                        ai_text = ai_text[3:]
                    if ai_text.endswith("```"):
                        ai_text = ai_text[:-3]
                    ai_text = ai_text.strip()
                    
                    # Parse JSON
                    place_schedule = json.loads(ai_text)
                    schedule_items.append(place_schedule)
                    
                    # Stream NGAY kết quả địa điểm này
                    yield f"data: {json.dumps({'status': 'place_scheduled', 'place': place['name'], 'data': place_schedule, 'progress': idx, 'total': len(places_with_hours)}, ensure_ascii=False)}\n\n"
                    
                except json.JSONDecodeError as e:
                    error_item = {
                        "order": idx,
                        "ref_id": place['ref_id'],
                        "place_name": place['name'],
                        "error": f"Lỗi parse JSON: {str(e)}",
                        "raw_text": ai_text
                    }
                    schedule_items.append(error_item)
                    yield f"data: {json.dumps({'status': 'place_error', 'place': place['name'], 'error': str(e), 'progress': idx, 'total': len(places_with_hours)}, ensure_ascii=False)}\n\n"
                
                await asyncio.sleep(0.3)
            
            # B5: Tổng kết lịch trình
            yield f"data: {json.dumps({'status': 'generating_summary', 'message': 'Đang tạo tổng kết lịch trình...'}, ensure_ascii=False)}\n\n"
            
            # Tạo prompt tổng kết
            summary_prompt = create_summary_prompt(request, schedule_items, places_with_hours)
            summary_response = model.generate_content(summary_prompt)
            summary_text = summary_response.text.strip()
            
            if summary_text.startswith("```json"):
                summary_text = summary_text[7:]
            if summary_text.startswith("```"):
                summary_text = summary_text[3:]
            if summary_text.endswith("```"):
                summary_text = summary_text[:-3]
            summary_text = summary_text.strip()
            
            try:
                summary_data = json.loads(summary_text)
            except:
                summary_data = {
                    "total_duration_hours": 8.0,
                    "estimated_end_time": "17:00",
                    "general_recommendations": ["Xác nhận giờ mở cửa trước khi đến"],
                    "alternative_order": ""
                }
            
            # B6: Gửi kết quả cuối cùng
            final_result = {
                "success": True,
                "visit_date": request.visit_date if hasattr(request, 'visit_date') else datetime.now().strftime("%Y-%m-%d"),
                "start_time": request.start_time,
                "places_count": len(request.places),
                "places_with_hours_found": len([p for p in places_with_hours if p.get('found')]),
                "schedule": {
                    "schedule": schedule_items,
                    **summary_data
                },
                "raw_places_info": places_with_hours
            }
            
            yield f"data: {json.dumps({'status': 'completed', 'message': 'Hoàn tất lập lịch!', 'result': final_result}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'status': 'done'}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            error_detail = traceback.format_exc()
            yield f"data: {json.dumps({'status': 'error', 'message': f'Lỗi: {str(e)}', 'detail': error_detail}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

def create_single_place_schedule_prompt(request: ScheduleRequest, place: dict, idx: int, total: int, previous_schedule: list) -> str:
    """Tạo prompt cho TỪNG địa điểm"""
    
    # Tính thời gian bắt đầu dựa trên địa điểm trước
    if previous_schedule:
        last_item = previous_schedule[-1]
        start_time = last_item.get('end_time', request.start_time)
        travel_time = last_item.get('travel_time_to_next', 0)
        # Tính thời gian bắt đầu = end_time của địa điểm trước + travel_time
        from datetime import datetime, timedelta
        try:
            last_end = datetime.strptime(start_time, "%H:%M")
            new_start = last_end + timedelta(minutes=travel_time)
            suggested_start = new_start.strftime("%H:%M")
        except:
            suggested_start = request.start_time
    else:
        suggested_start = request.start_time
    
    # Thông tin địa điểm trước (để tính khoảng cách)
    previous_place_info = ""
    if previous_schedule:
        last_place = previous_schedule[-1]
        previous_place_info = f"\n- Địa điểm trước: {last_place.get('place_name', 'N/A')}"
    
    hours_info = ""
    if place.get('weekday_text'):
        hours_info = "\n".join(place['weekday_text'])
    else:
        hours_info = "Không có thông tin chính xác"
    
    return f"""Bạn là chuyên gia lập lịch trình du lịch. Hãy tạo lịch chi tiết cho địa điểm thứ {idx}/{total}.

ĐỊA ĐIỂM HIỆN TẠI:
- Tên: {place['name']}
- Địa chỉ: {place['address']}
- Khoảng cách từ điểm xuất phát: {place['distance']:.2f}km
- Giờ mở cửa:
{hours_info}
- Ghi chú: {place.get('notes', 'Không có')}{previous_place_info}

THÔNG TIN CHUYẾN ĐI:
- Ngày: {request.visit_date if hasattr(request, 'visit_date') else 'hôm nay'}
- Thời gian đề xuất bắt đầu địa điểm này: {suggested_start}
- Vị trí: Địa điểm {idx}/{total}

YÊU CẦU:
1. Đề xuất thời gian tham quan HỢP LÝ dựa trên giờ mở cửa
2. Ước tính thời lượng phù hợp với loại địa điểm
3. Tính thời gian di chuyển đến địa điểm tiếp theo (nếu không phải địa điểm cuối)
4. Đưa ra hoạt động nên làm và lưu ý quan trọng

TRẢ VỀ JSON (KHÔNG có markdown, CHỈ JSON):
{{
    "order": {idx},
    "ref_id": "{place['ref_id']}",
    "place_name": "{place['name']}",
    "address": "{place['address']}",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "duration_minutes": 90,
    "travel_time_to_next": 15,
    "notes": "Lưu ý về giờ mở cửa, điều cần chú ý",
    "recommended_activities": ["Hoạt động 1", "Hoạt động 2", "Hoạt động 3"]
}}

CHỈ TRẢ VỀ JSON, KHÔNG TEXT KHÁC."""

def create_summary_prompt(request: ScheduleRequest, schedule_items: list, places_with_hours: list) -> str:
    """Tạo prompt cho phần tổng kết"""
    
    schedule_summary = json.dumps(schedule_items, ensure_ascii=False, indent=2)
    
    return f"""Dựa trên lịch trình đã được lập cho {len(schedule_items)} địa điểm:

{schedule_summary}

Hãy tạo phần tổng kết với:
1. Tổng thời gian dự kiến (giờ)
2. Thời gian kết thúc ước tính
3. Các khuyến nghị chung (ăn uống, di chuyển, trang phục, thời tiết, xác nhận giờ mở cửa)
4. Đề xuất thứ tự thay thế (nếu có)

TRẢ VỀ JSON (KHÔNG markdown):
{{
    "total_duration_hours": 8.0,
    "estimated_end_time": "17:00",
    "general_recommendations": [
        "Khuyến nghị 1",
        "Khuyến nghị 2",
        "Khuyến nghị 3"
    ],
    "alternative_order": "Mô tả cách sắp xếp thay thế nếu có"
}}

CHỈ JSON, KHÔNG TEXT KHÁC."""

# Input model
class ReorderRequest(BaseModel):
    schedule: dict
    prompt: str

async def get_distance_matrix(locations: List[Dict[str, float]]) -> List[List[float]]:
    """
    Gọi VietMap Distance Matrix API để lấy thời gian di chuyển giữa các điểm (phút)
    """
    url = "https://maps.vietmap.vn/api/matrix/v1/driving"
    headers = {"Content-Type": "application/json"}
    body = {
        "points": [{"lng": loc["lng"], "lat": loc["lat"]} for loc in locations],
        "apikey": "4760087f980b480d9efaf4fb02c649ac9f69fc462c01d149"
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        durations = data.get("durations", [])
        # Chuyển sang phút
        durations_minutes = [[round(x / 60, 1) for x in row] for row in durations]
        return durations_minutes

@app.post("/reorder_schedule")
async def reorder_schedule(req: ReorderRequest):
    """
    Reorder lại lịch trình theo prompt người dùng
    và tự động tối ưu tuyến đường (route optimization).
    """
    try:
        schedule_data = req.schedule
        schedule_list = schedule_data.get("schedule", {}).get("schedule", [])
        if not schedule_list:
            raise HTTPException(status_code=400, detail="Không có địa điểm nào trong lịch trình.")

        # Giả định bạn có lưu lat/lng trong raw_places_info
        raw_places = schedule_data.get("raw_places_info", [])
        locations = [{"lat": p.get("lat", 0), "lng": p.get("lng", 0)} for p in raw_places if p.get("lat") and p.get("lng")]

        # Nếu có tọa độ thì tính distance matrix
        distance_matrix = []
        if len(locations) >= 2:
            distance_matrix = await get_distance_matrix(locations)

        # Tạo prompt cho Gemini
        prompt_text = f"""
Bạn là một trợ lý AI chuyên lập lịch du lịch thông minh.

Dưới đây là lịch trình hiện tại của người dùng (dưới dạng JSON):
{json.dumps(schedule_data, ensure_ascii=False, indent=2)}

Nếu có ma trận thời gian di chuyển (đơn vị phút), hãy sử dụng để tối ưu:
{json.dumps(distance_matrix, ensure_ascii=False)}

Yêu cầu người dùng:
{req.prompt}

Nhiệm vụ của bạn:
1. Sắp xếp lại thứ tự các địa điểm trong "schedule.schedule" sao cho tuyến đường ngắn nhất và hợp lý nhất.
2. Đảm bảo phù hợp với ý muốn của người dùng.
3. Cập nhật lại "order", "start_time", "end_time", "travel_time_to_next".
4. Giữ nguyên các thông tin khác (notes, recommended_activities, ...).
5. Trả về toàn bộ JSON đầy đủ, không cắt bớt, không thêm text ngoài JSON.
"""

        # Gọi Gemini
        response = model.generate_content(prompt_text)
        ai_text = response.text.strip()

        # Xử lý nếu có markdown code block
        if ai_text.startswith("```json"):
            ai_text = ai_text[7:]
        if ai_text.startswith("```"):
            ai_text = ai_text[3:]
        if ai_text.endswith("```"):
            ai_text = ai_text[:-3]
        ai_text = ai_text.strip()

        # Parse JSON kết quả
        try:
            reordered = json.loads(ai_text)
        except json.JSONDecodeError as e:
            print("Gemini output parse error:", str(e))
            print("Raw output:\n", ai_text)
            raise HTTPException(status_code=500, detail="Gemini trả về định dạng không hợp lệ")

        # Trả về kết quả cuối cùng
        return {
            "success": True,
            "optimized": True,
            "user_prompt": req.prompt,
            "data": reordered
        }

    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi gọi API Vietmap: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)