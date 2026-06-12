from slowapi import Limiter
from fastapi import Request

def get_real_ip(request: Request) -> str:
    # Check for X-Forwarded-For header (comma-separated list, first is client IP)
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    
    # Check for X-Real-IP header
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip
        
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_real_ip)
