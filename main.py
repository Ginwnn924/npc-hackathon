from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import httpx

app = FastAPI(title="Vietmap Places Search API")

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

# Endpoint
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
        
        filtered_results = [
            {key: item.get(key) for key in fields_to_keep}
            for item in unique_results.values()
        ]
        filtered_results.sort(key=lambda x: x.get("distance", 0))

        return filtered_results[:10]
        
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi gọi Vietmap API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi không xác định: {str(e)}")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)